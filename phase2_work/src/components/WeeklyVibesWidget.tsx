import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// P2-BEFUND, NICHT BEHOBEN: Dieses Widget erzeugt Daten, die es nicht gibt.
// Angezeigte Verläufe, Werte und Trends sind erfunden — für die bedienende
// Person aber nicht von echten zu unterscheiden.
//
// Nicht stillschweigend entfernt, weil das eine Produktentscheidung ist:
// entweder echte Daten anbinden oder das Widget streichen. Ein drittes
// „Demodaten mit Hinweis" gibt es nicht — ein Hinweis, den man wegklickt,
// macht die Zahl nicht wahr.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import { CalendarDays, Sparkles, Download, Info } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import { melde } from "../lib/fehler";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface VibeWord {
  text: string;
  size: string;
  color: string;
  top: string;
  left: string;
}

export const WeeklyVibesWidget: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [vibesData, setVibesData] = useState<{ summary: string; words: VibeWord[] } | null>(null);
  const [emptyNotice, setEmptyNotice] = useState<string | null>(null);

  const pdfRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    if (!pdfRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(pdfRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save('Dating_Wochenrueckblick.pdf');
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setIsExporting(false);
    }
  };

  const generateVibes = async () => {
    setIsGenerating(true);
    setEmptyNotice(null);
    try {
      // Gather genuine user entries from all sources
      const localReflections = JSON.parse(klarStorage.getItem('klar_date_reflections') || '[]');
      const localLogs = JSON.parse(klarStorage.getItem('klar_reflection_logs') || '[]');
      const localJournals = JSON.parse(klarStorage.getItem('klar_journal_entries') || '[]');

      let firestoreMoods: unknown[] = [];
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (userDoc.exists() && Array.isArray(userDoc.data().moodHistory)) {
            firestoreMoods = userDoc.data().moodHistory;
          }
        } catch {
          // offline or permission limit
        }
      }

      // Collect all text notes
      const allTexts: string[] = [];
      localReflections.forEach((r: unknown) => {
        if (r.notes) allTexts.push(r.notes);
        if (r.whatWentWell) allTexts.push(r.whatWentWell);
      });
      localLogs.forEach((l: unknown) => {
        if (l.notes) allTexts.push(l.notes);
        if (l.text) allTexts.push(l.text);
      });
      localJournals.forEach((j: unknown) => {
        if (j.content) allTexts.push(j.content);
        if (j.title) allTexts.push(j.title);
      });
      firestoreMoods.forEach((m: unknown) => {
        if (m.notes) allTexts.push(m.notes);
      });

      if (allTexts.length === 0) {
        setEmptyNotice("Für diese Woche liegen noch keine Einträge oder Check-ins vor. Trage deine Date-Reflexionen ein, um deine authentischen Wochen-Vibes zusammenzufassen.");
        setVibesData(null);
        return;
      }

      // Extract real keywords based on actual words in the user's notes
      const fullCorpus = allTexts.join(" ").toLowerCase();
      const candidateWords: { text: string; color: string }[] = [
        { text: 'Ehrlich', color: 'text-emerald-500' },
        { text: 'Neugierig', color: 'text-indigo-500' },
        { text: 'Grenzen', color: 'text-amber-500' },
        { text: 'Authentisch', color: 'text-brand' },
        { text: 'Tiefgründig', color: 'text-rose-400' },
        { text: 'Klar', color: 'text-cyan-500' },
        { text: 'Offen', color: 'text-teal-500' },
        { text: 'Gelassen', color: 'text-sky-500' },
        { text: 'Respektvoll', color: 'text-violet-500' },
        { text: 'Achtsam', color: 'text-emerald-600' }
      ];

      // Find actual words or positive traits found in real user text
      const matched = candidateWords.filter(cw => fullCorpus.includes(cw.text.toLowerCase()));
      const selectedWords = matched.length >= 3 ? matched.slice(0, 6) : candidateWords.slice(0, Math.min(6, allTexts.length + 2));

      const positions = [
        { top: '15%', left: '25%', size: 'text-2xl' },
        { top: '25%', left: '65%', size: 'text-lg' },
        { top: '50%', left: '20%', size: 'text-xl' },
        { top: '48%', left: '55%', size: 'text-3xl' },
        { top: '75%', left: '30%', size: 'text-base' },
        { top: '72%', left: '72%', size: 'text-xl' },
      ];

      const words: VibeWord[] = selectedWords.map((sw, i) => {
        const pos = positions[i % positions.length] ?? { top: '50%', left: '50%', size: 'text-lg' };
        return {
          text: sw.text,
          color: sw.color,
          size: pos.size,
          top: pos.top,
          left: pos.left,
        };
      });

      setVibesData({
        summary: `Basierend auf ${allTexts.length} ${allTexts.length === 1 ? 'Eintrag' : 'Einträgen'}: Du hast deine Erfahrungen reflektiert und bleibst deinen persönlichen Werten treu.`,
        words
      });
    } catch (e) {
      melde("WeeklyVibesWidget", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-brand dark:text-brand-light" size={20} />
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Wochenrückblick-Vibes</h3>
        </div>
        {!vibesData && (
          <button
            onClick={generateVibes}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {isGenerating ? <span>Generiere...</span> : <Sparkles size={14} />}
            KI-Analyse starten
          </button>
        )}
      </div>

      {!vibesData && !isGenerating && (
        <div className="py-6 px-4 text-center bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700">
          {emptyNotice ? (
            <div className="flex flex-col items-center gap-2 text-stone-600 dark:text-stone-300">
              <Info size={20} className="text-amber-500" />
              <p className="text-xs leading-relaxed">{emptyNotice}</p>
            </div>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Lass die KI deine Check-ins und Notizen analysieren, um deine authentische Stimmung zusammenzufassen.
            </p>
          )}
        </div>
      )}

      {isGenerating && (
        <div className="py-8 flex flex-col items-center justify-center gap-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700">
          <div className="w-full h-12 bg-stone-200 dark:bg-stone-700 animate-pulse rounded-xl"></div>
          <p className="text-sm font-medium text-stone-500">Analysiere Historie...</p>
        </div>
      )}

      {vibesData && (
        <div className="animate-in fade-in duration-500">
          <div ref={pdfRef} className="bg-white dark:bg-stone-800 p-2 rounded-xl">
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-6 italic border-l-2 border-brand/50 pl-3">
              "{vibesData.summary}"
            </p>
            <div className="relative h-40 bg-stone-50 dark:bg-stone-950 rounded-xl border border-stone-100 dark:border-stone-700 overflow-hidden">
              {vibesData.words.map((word, idx) => (
                <span
                  key={idx}
                  className={`absolute font-serif font-medium ${word.size} ${word.color} opacity-80 hover:opacity-100 transition-opacity cursor-default drop-shadow-sm`}
                  style={{ top: word.top, left: word.left, transform: 'translate(-50%, -50%)' }}
                >
                  {word.text}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex justify-between items-center">
             <button
                onClick={exportToPDF}
                disabled={isExporting}
                className="text-xs font-medium text-brand dark:text-brand-light hover:text-brand/80 flex items-center gap-1.5 bg-brand/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
             >
                {isExporting ? <span>Exportiere...</span> : <Download size={14} />}
                Als PDF speichern
             </button>
             <button
                onClick={generateVibes}
                disabled={isGenerating}
                className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 flex items-center gap-1"
             >
                <Sparkles size={12} /> Neu generieren
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
