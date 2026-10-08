import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { CheckCircle2, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { erreichte } from "../lib/meilensteine";
import { leseRohdaten } from "./Meilensteine";

export function SuccessSummaryWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [totalTasks, setTotalTasks] = useState(0);
  const [totalMilestones, setTotalMilestones] = useState(0);

  useEffect(() => {
    const loadSummary = () => {
      try {
        // Load total tasks
        const savedCompleted = JSON.parse(klarStorage.getItem('klar_wheel_completed_tasks') || '[]') as number[];
        setTotalTasks(savedCompleted.length);

        // ── 14.08.2026: ZWEITE ZIELLISTE ENTFERNT ────────────────────
        // Hier stand eine eigene Kopie der Meilensteine samt Zielwerten —
        // fuenf Schluessel, fuenf Zahlen, unabhaengig von der Liste in
        // `DatingMilestones`. Zwei Listen, die dasselbe behaupten sollen,
        // laufen auseinander: `stats_conversations_started` stand hier mit
        // Ziel 3, wird aber nirgends in der App geschrieben — die Zahl
        // konnte also nie steigen.
        //
        // Jetzt gilt `src/lib/meilensteine.ts` als einzige Wahrheit.
        setTotalMilestones(erreichte(leseRohdaten()).length);
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    };

    loadSummary();

    // 14.08.2026: `setInterval(loadSummary, 2000)` entfernt. Alle zwei
    // Sekunden sechs Speicherschluessel zu lesen, dauerhaft und auf jeder
    // Seite, auf der dieser Baustein steht, ist keine Aktualisierung,
    // sondern eine Dauerschleife. `storage` (anderes Fenster) und `focus`
    // (Rueckkehr zur App) decken die Faelle ab, in denen sich wirklich
    // etwas geaendert haben kann.
    window.addEventListener('wheelTaskCompleted', loadSummary);
    window.addEventListener('storage', loadSummary);
    window.addEventListener('focus', loadSummary);

    return () => {
      window.removeEventListener('wheelTaskCompleted', loadSummary);
      window.removeEventListener('storage', loadSummary);
      window.removeEventListener('focus', loadSummary);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-4 mb-6 shadow-sm flex items-center justify-between"
    >
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex-1 border-r border-stone-100 dark:border-stone-700 px-2">
        <div className="flex items-center gap-1.5 mb-1 justify-center">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Aufgaben</span>
        </div>
        <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 text-center">
          {totalTasks}
        </div>
      </div>

      <div className="flex-1 px-2">
        <div className="flex items-center gap-1.5 mb-1 justify-center">
          <Trophy size={14} className="text-amber-500" />
          <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">Meilensteine</span>
        </div>
        <div className="text-2xl font-bold text-stone-900 dark:text-stone-100 text-center">
          {totalMilestones}
        </div>
      </div>
    </motion.div>
  );
}
