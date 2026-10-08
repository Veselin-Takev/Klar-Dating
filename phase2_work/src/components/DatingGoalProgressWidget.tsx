import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Target, CheckCircle2, ChevronRight, Award } from "lucide-react";
import { motion } from "motion/react";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const STAGES = [
  { id: 1, title: "Kennenlernphase", description: "Erste Dates & Icebreaker" },
  { id: 2, title: "Dating-Phase", description: "Regelmäßige Treffen" },
  { id: 3, title: "Commitment", description: "Gemeinsame Ziele" }
];

export function DatingGoalProgressWidget() {
  const [journalCount, setJournalCount] = useState(0);

  useEffect(() => {
    async function loadJournalCount() {
      try {
        const reflections = JSON.parse(klarStorage.getItem('klar_date_reflections') || '[]');
        const journals = JSON.parse(klarStorage.getItem('klar_journal_entries') || '[]');
        const generalJournals = JSON.parse(klarStorage.getItem('klar_journal') || '[]');
        const logs = JSON.parse(klarStorage.getItem('klar_reflection_logs') || '[]');

        let firestoreCount = 0;
        if (auth.currentUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists() && Array.isArray(userDoc.data().moodHistory)) {
              firestoreCount = userDoc.data().moodHistory.length;
            }
          } catch {
            // fallback
          }
        }

        const total = reflections.length + journals.length + generalJournals.length + logs.length + firestoreCount;
        setJournalCount(total);
      } catch {
        setJournalCount(0);
      }
    }

    loadJournalCount();
  }, []);

  const getProgress = () => {
    if (journalCount === 0) return { percent: 0, stage: 1, label: "Startbereit" };
    if (journalCount < 3) return { percent: 25, stage: 1, label: "Phase 1" };
    if (journalCount < 7) return { percent: 65, stage: 2, label: "Phase 2" };
    return { percent: 100, stage: 3, label: "Ziel erreicht" };
  };

  const progress = getProgress();

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm overflow-hidden relative h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Target size={18} className="text-brand dark:text-brand-light" />
            Dein Dating-Ziel
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Basierend auf {journalCount} Tagebucheinträgen
          </p>
        </div>
        <div className="bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
          <Award size={12} /> {progress.label}
        </div>
      </div>

      <div className="relative pt-4 pb-2">
        <div className="absolute top-6 left-[10%] right-[10%] h-1 bg-stone-100 dark:bg-stone-800 rounded-full z-0">
          <motion.div
            className="h-full bg-brand dark:bg-brand-light rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress.percent}%` }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          />
        </div>

        <div className="flex justify-between relative z-10">
          {STAGES.map((stage,  ) => {
            const completed = stage.id < progress.stage;
            const active = stage.id === progress.stage;

            return (
              <div key={stage.id} className="flex flex-col items-center gap-2 w-1/3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-500 ${
                  completed
                    ? 'bg-brand border-brand dark:bg-brand-light dark:border-brand-light text-white dark:text-stone-900'
                    : active
                      ? 'bg-white dark:bg-stone-800 border-brand dark:border-brand-light text-brand dark:text-brand-light ring-4 ring-brand/10 dark:ring-brand-light/10'
                      : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-400'
                }`}>
                  {completed ? <CheckCircle2 size={16} /> : <span className="text-xs font-bold">{stage.id}</span>}
                </div>
                <div className="text-center">
                  <p className={`text-xs font-bold ${active ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>
                    {stage.title}
                  </p>
                  <p className="text-[9px] text-stone-400 dark:text-stone-500 mt-0.5 max-w-[80px] mx-auto leading-tight">
                    {stage.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-brand dark:text-brand-light uppercase tracking-wider block mb-0.5">Nächster Meilenstein</span>
          <span className="text-xs font-medium text-stone-700 dark:text-stone-300">Noch 2 Dates bis zum Commitment</span>
        </div>
        <ChevronRight size={16} className="text-stone-400" />
      </div>
    </div>
  );
}
