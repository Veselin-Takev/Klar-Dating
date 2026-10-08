import { klarStorage } from '../lib/userScopedStorage';
import { useState } from "react";
import { FileText, FileSpreadsheet, DownloadCloud } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface DateHistoryEntry {
  id: string;
  matchName: string;
  title: string;
  date: string;
  rating?: number;
  note?: string;
}

interface DateReflection {
  id: string;
  date: string;
  positive: string;
  negative: string;
  learned: string;
}

export function DataExportWidget() {
  const [isExporting, setIsExporting] = useState(false);
  const [auskunftLaeuft, setAuskunftLaeuft] = useState(false);
  const [auskunftFehler, setAuskunftFehler] = useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // DSG-04 (Final Audit 08.08.2026) — Auskunft nach Art. 15 / Art. 20
  //
  // BEFUND: Dieses Widget las zwei klarStorage-Schlüssel und nannte das
  // Ergebnis „Daten Export". Enthalten waren Date-Historie und Journal —
  // nicht enthalten: Profil, Nachrichten, Verbindungen, Kontingent,
  // Einwilligungen, also praktisch alles, was tatsächlich gespeichert ist.
  // Eine Antwort auf ein Auskunftsersuchen wäre materiell unvollständig
  // gewesen.
  //
  // Die beiden vorhandenen Ausgaben bleiben — sie sind eine nützliche
  // Funktion, nur eben keine Auskunft. Der Text unten sagt das jetzt.
  // Daneben steht der echte Vollexport vom Server.
  // ═══════════════════════════════════════════════════════════════════════
  const auskunftLaden = async () => {
    setAuskunftFehler(null);
    setAuskunftLaeuft(true);
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klar-auskunft-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // GEGENPRÜFUNG: revokeObjectURL stand direkt hinter click(). Manche
      // Browser brechen den Download dadurch ab. Erst freigeben, wenn er
      // angelaufen ist.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      // Kein stiller Ausfall: Wer eine Auskunft anfordert, muss erfahren,
      // dass sie nicht zustande kam — sonst hält er sie für erledigt.
      console.error("Auskunft fehlgeschlagen", e);
      setAuskunftFehler("Die Auskunft konnte nicht erstellt werden. Bitte erneut versuchen.");
    } finally {
      setAuskunftLaeuft(false);
    }
  };

  const getHistory = (): DateHistoryEntry[] => {
    const saved = klarStorage.getItem("klar_date_history");
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  };

  const getReflections = (): DateReflection[] => {
    const saved = klarStorage.getItem("klar_date_reflections");
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch {
      return [];
    }
  };

  const exportCSV = () => {
    const history = getHistory();
    const reflections = getReflections();

    if (history.length === 0 && reflections.length === 0) {
      alert("Keine Daten zum Exportieren vorhanden.");
      return;
    }

    setIsExporting(true);

    try {
      let csvContent = "Typ,Datum,Verbindung,Titel/Positiv,Bewertung/Negativ,Notiz/Gelernt\n";

      // Add History
      history.forEach(entry => {
        const type = '"Date-Historie"';
        const date = `"${entry.date}"`;
        const verbindung = `"${entry.matchName.replace(/"/g, '""')}"`;
        const title = `"${entry.title.replace(/"/g, '""')}"`;
        const rating = entry.rating ? `"${entry.rating} Sterne"` : '""';
        const note = entry.note ? `"${entry.note.replace(/"/g, '""')}"` : '""';

        csvContent += `${type},${date},${verbindung},${title},${rating},${note}\n`;
      });

      // Add Reflections
      reflections.forEach(ref => {
        const type = '"Journal-Eintrag"';
        const date = `"${ref.date}"`;
        const verbindung = '""';
        const pos = `"${ref.positive.replace(/"/g, '""')}"`;
        const neg = `"${ref.negative.replace(/"/g, '""')}"`;
        const learned = `"${ref.learned.replace(/"/g, '""')}"`;

        csvContent += `${type},${date},${verbindung},${pos},${neg},${learned}\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `klar_dating_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = () => {
    const history = getHistory();
    const reflections = getReflections();

    if (history.length === 0 && reflections.length === 0) {
      alert("Keine Daten zum Exportieren vorhanden.");
      return;
    }

    setIsExporting(true);

    try {
      const doc = new jsPDF();
      doc.setFont("helvetica");

      // Title
      doc.setFontSize(20);
      doc.text("Klar - Dating Historie & Journal", 14, 22);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generiert am: ${new Date().toLocaleDateString('de-DE')}`, 14, 30);

      let currentY = 40;

      // History Table
      if (history.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Date Historie", 14, currentY);

        const historyData = history.map(h => [
          h.date,
          h.matchName,
          h.title,
          h.rating ? `${h.rating}/5` : '-',
          h.note || '-'
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Datum', 'Verbindung', 'Titel', 'Rating', 'Notiz']],
          body: historyData,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229] }, // Brand color roughly
          styles: { fontSize: 9 }
        });

        currentY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 15;
      }

      // Reflections Table
      if (reflections.length > 0) {
        // Add new page if not enough space
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("Dating Journal", 14, currentY);

        const reflectionData = reflections.map(r => [
          r.date,
          r.positive,
          r.negative,
          r.learned
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [['Datum', 'Positiv', 'Negativ', 'Gelernt']],
          body: reflectionData,
          theme: 'grid',
          headStyles: { fillColor: [139, 92, 246] }, // Violet color
          styles: { fontSize: 9 }
        });
      }

      doc.save(`klar_dating_export_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (e) {
      console.error("PDF Export failed:", e);
      alert("Fehler beim Erstellen des PDFs.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <DownloadCloud size={18} className="text-blue-500" />
            Daten Export
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Lade deine gesamte Date-Historie herunter
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-3">
        <button
          onClick={exportPDF}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <FileText size={18} className="text-rose-500" />
          Als PDF exportieren
        </button>

        <button
          onClick={exportCSV}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <FileSpreadsheet size={18} className="text-emerald-500" />
          Als CSV exportieren
        </button>

        <p className="text-[10px] text-center text-stone-400 mt-2">
          PDF und CSV enthalten deine Date-Historie und deine Journal-Einträge —
          nicht dein Profil, deine Nachrichten oder deine Verbindungen.
        </p>

        <div className="mt-4 pt-4 border-t border-stone-200 dark:border-stone-700">
          <button
            onClick={auskunftLaden}
            disabled={auskunftLaeuft}
            className="w-full flex items-center justify-center gap-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <DownloadCloud size={18} />
            {auskunftLaeuft ? "Wird zusammengestellt…" : "Vollständige Auskunft (JSON)"}
          </button>
          {auskunftFehler && (
            <p role="alert" className="text-xs text-center mt-2 text-warn">{auskunftFehler}</p>
          )}
          <p className="text-[10px] text-center text-stone-400 mt-2">
            Alles, was zu deinem Konto gespeichert ist: Profil, eigene Nachrichten,
            Verbindungen, Kontingent, Einwilligungen. Art. 15 und Art. 20 DSGVO.
            Nachrichten anderer Personen sind nicht enthalten — das sind deren Daten.
          </p>
        </div>
      </div>
    </div>
  );
}
