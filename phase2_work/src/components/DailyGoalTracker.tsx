import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Target, CheckCircle2, Plus, Minus } from "lucide-react";

export function DailyGoalTracker() {
  const [goal, setGoal] = useState(3);
  const [progress, setProgress] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const updateProgress = () => {
    const today = new Date().toDateString();
    const savedDate = klarStorage.getItem('klar_goal_date');

    if (savedDate !== today) {
      klarStorage.setItem('klar_goal_date', today);
      klarStorage.setItem('klar_daily_interactions', "0");
      setProgress(0);
    } else {
      const currentProgress = parseInt(klarStorage.getItem('klar_daily_interactions') || "0", 10);
      setProgress(currentProgress);
    }

    const savedGoal = klarStorage.getItem('klar_daily_goal');
    if (savedGoal) {
      setGoal(parseInt(savedGoal, 10));
    }
  };

  useEffect(() => {
    updateProgress();

    const handleInteraction = () => {
      updateProgress();
    };

    window.addEventListener('klar_interaction_updated', handleInteraction);
    return () => window.removeEventListener('klar_interaction_updated', handleInteraction);
  }, []);

  const handleSaveGoal = () => {
    klarStorage.setItem('klar_daily_goal', goal.toString());
    setIsEditing(false);
  };

  const percent = Math.min(100, Math.round((progress / Math.max(1, goal)) * 100));

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
          <Target size={16} className="text-brand dark:text-brand-light" />
          Tägliche Interaktionen
        </h3>
        {isEditing ? (
          <button onClick={handleSaveGoal} className="text-xs font-medium text-brand dark:text-brand-light px-2 py-1 bg-brand/10 dark:bg-brand-light/10 rounded-lg">
            Speichern
          </button>
        ) : (
          <button onClick={() => setIsEditing(true)} className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
            Bearbeiten
          </button>
        )}
      </div>

      {isEditing && (
        <div className="flex items-center justify-between bg-stone-50 dark:bg-stone-950 p-2 rounded-xl mb-3">
          <span className="text-xs text-stone-600 dark:text-stone-400">Sinnvolle Gespräche:</span>
          <div className="flex items-center gap-3">
            <button aria-label="Tagesziel verringern" onClick={() => setGoal(Math.max(1, goal - 1))} className="p-1 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm">
              <Minus size={14} />
            </button>
            <span className="font-semibold w-4 text-center text-stone-900 dark:text-stone-100">{goal}</span>
            <button aria-label="Tagesziel erhöhen" onClick={() => setGoal(goal + 1)} className="p-1 rounded-full bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 shadow-sm">
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-stone-100 dark:text-stone-800"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-brand dark:text-brand-light transition-all duration-500 ease-out"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${percent}, 100`}
              strokeLinecap="round"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
              {progress}/{goal}
            </span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
            Dein Tagesziel
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Bleib dran für bedeutungsvolle Kontakte.
          </p>
        </div>
      </div>

      {progress >= goal && !isEditing && (
        <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-1 font-medium">
          <CheckCircle2 size={14} /> Ziel für heute erreicht!
        </p>
      )}
    </div>
  );
}
