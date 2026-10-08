import { klarStorage } from '../lib/userScopedStorage';
import { useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

export function VibeSummaryPDFGenerator() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();

      // Theme colors
      const brandColor = [79, 70, 229]; // Indigo-600

      // Header
      doc.setFillColor(brandColor[0] || 79, brandColor[1] || 70, brandColor[2] || 229);
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("Dein Klar Vibe-Summary", 105, 25, { align: "center" });

      // Collect Data
      const datingMoodsStr = klarStorage.getItem('klar_dating_moods');
      const dailyVibeStr = klarStorage.getItem('klar_daily_vibe');

      type MoodRecord = { mood: string };
      type VibeRecord = { focusMessage?: string };
      let moods: MoodRecord[] = [];
      let lastVibe: VibeRecord | null = null;

      if (datingMoodsStr) {
        try {
          const parsed: unknown = JSON.parse(datingMoodsStr);
          moods = Array.isArray(parsed) ? parsed.filter((item): item is MoodRecord => !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).mood === 'string') : [];
        } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      }
      if (dailyVibeStr) {
        try {
          const parsed: unknown = JSON.parse(dailyVibeStr);
          lastVibe = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as VibeRecord : null;
        } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      }

      // Content
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Zusammenfassung deiner Stimmungen", 20, 60);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      if (moods.length > 0) {
        const moodCounts = moods.reduce<Record<string, number>>((acc, curr) => {
          acc[curr.mood] = (acc[curr.mood] || 0) + 1;
          return acc;
        }, {});

        let y = 70;
        doc.text(`Du hast ${moods.length} Stimmungen im letzten Monat erfasst.`, 20, y);
        y += 10;
        Object.entries(moodCounts).forEach(([mood, count]) => {
          const label = mood === 'excited' ? 'Begeistert' :
                        mood === 'relaxed' ? 'Entspannt' :
                        mood === 'neutral' ? 'Neutral' :
                        mood === 'nervous' ? 'Nervös' : 'Frustriert';
          doc.text(`- ${label}: ${count} Mal`, 25, y);
          y += 8;
        });
      } else {
        doc.text("Es wurden noch keine Stimmungen erfasst.", 20, 70);
      }

      if (lastVibe) {
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("Letzter KI-Fokus", 20, 130);

        doc.setFontSize(12);
        doc.setFont("helvetica", "italic");

        const focusText = lastVibe.focusMessage || "Kein Fokus gesetzt.";
        const splitText = doc.splitTextToSize(`"${focusText}"`, 170);
        doc.text(splitText, 20, 140);
      }

      // Footer
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(`Generiert am ${new Date().toLocaleDateString()} von Klar`, 105, 280, { align: "center" });

      doc.save(`Klar_Vibe_Summary_${new Date().toISOString().split('T')[0] || ''}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={isGenerating}
      className="w-full bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-stone-800 dark:text-stone-200 rounded-3xl p-4 shadow-sm flex items-center justify-between border border-stone-200 dark:border-stone-700"
    >
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center gap-3">
        <div className="bg-white dark:bg-stone-800 p-2 rounded-xl shadow-sm">
          <Download size={20} className="text-brand dark:text-brand-light" />
        </div>
        <div className="text-left">
          <h3 className="font-bold text-sm">Vibe-Summary als PDF</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Exportiere deine monatliche Zusammenfassung</p>
        </div>
      </div>
      {isGenerating ? (
        <Sparkles size={16} className="text-brand " />
      ) : (
        <Download size={16} className="text-stone-400" />
      )}
    </button>
  );
}
