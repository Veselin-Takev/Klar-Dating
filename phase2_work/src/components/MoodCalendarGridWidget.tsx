import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

// ── LEER HEISST UNSICHTBAR (14.08.2026) ─────────────────────────────────
// BEFUND: Bei einem frischen Konto zeigte diese Karte ein leeres Raster ueber
// 30 Tage — eine graue Flaeche, die aussieht wie ein Fehler und keiner ist.
// Zusammen mit den anderen leeren Karten war die Profilseite gleichzeitig
// sehr lang und fast leer: der schlechteste erste Eindruck, den sie machen
// kann. Siehe klar/27-profilseite-layout, Abschnitt 4.
//
// Diese Karte ist eine REINE ANZEIGE — sie liest `klar_reflection_logs` und
// bietet keine Eingabe. Sie auszublenden nimmt also niemandem einen Weg.
// (Bei Karten MIT Eingabe waere dasselbe ein Fehler: Wer nichts eingetragen
// hat, kaeme nie an die Stelle, an der man etwas eintraegt.)
type ReflectionLog = { date?: unknown; mood?: unknown };
type MoodGridDay = { date: string; colorClass: string };
function parseLogs(raw: string | null): ReflectionLog[] {
  if (!raw) return [];
  try { const parsed: unknown = JSON.parse(raw); return Array.isArray(parsed) ? parsed.filter((v): v is ReflectionLog => !!v && typeof v === 'object' && !Array.isArray(v)) : []; } catch { return []; }
}
export function MoodCalendarGridWidget() {
  const [grid, setGrid] = useState<MoodGridDay[]>([]);
  const [hatDaten, setHatDaten] = useState(false);

  useEffect(() => {
    const saved = klarStorage.getItem('klar_reflection_logs');
    const logs = parseLogs(saved);

    const newGrid = [];
    // Show last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('de-DE');

      const dayLogs = logs.filter(l => { const rawDate=l.date; return (typeof rawDate==='string'||typeof rawDate==='number') && new Date(rawDate).toLocaleDateString('de-DE')===dateStr; });
      let colorClass = "bg-stone-100 dark:bg-stone-800"; // none

      if (dayLogs.length > 0) {
        // Average mood
        let score = 0;
        dayLogs.forEach((l) => {
          if (l.mood === 'good') score += 1;
          else if (l.mood === 'bad') score -= 1;
        });
        if (score > 0) colorClass = "bg-emerald-400 dark:bg-emerald-500";
        else if (score < 0) colorClass = "bg-rose-400 dark:bg-rose-500";
        else colorClass = "bg-amber-400 dark:bg-amber-500";
      }

      newGrid.push({
        date: dateStr,
        colorClass
      });
    }
    setGrid(newGrid);
    // Nicht aus `newGrid` ableitbar: Das Raster hat IMMER 30 Eintraege, auch
    // wenn keiner davon eine Stimmung traegt. Die Frage „gibt es ueberhaupt
    // etwas" beantwortet nur die Quelle.
    setHatDaten(logs.length > 0);
  }, []);

  if (!hatDaten) return null;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-2xl">
          <Calendar size={24} />
        </div>
        <div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100">Stimmungs-Grid</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Deine Dates der letzten 60 Tage</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {grid.map((day, idx) => (
          <div
            key={idx}
            className={`w-3 h-3 rounded-sm ${day.colorClass}`}
            title={day.date}
          ></div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4 text-xs text-stone-500">
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-stone-100 dark:bg-stone-800"></div> Keine Dates</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-emerald-400 dark:bg-emerald-500"></div> Gut</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-amber-400 dark:bg-amber-500"></div> Neutral</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-rose-400 dark:bg-rose-500"></div> Schlecht</div>
      </div>
    </div>
  );
}
