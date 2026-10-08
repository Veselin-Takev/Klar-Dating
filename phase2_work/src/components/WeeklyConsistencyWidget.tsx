import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { CheckCircle2, Flame, Award, Calendar } from "lucide-react";
import { motion } from "motion/react";

export function WeeklyConsistencyWidget() {
  const [streak, setStreak] = useState(0);
  const [, setLastCheckIn] = useState<string | null>(null);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  useEffect(() => {
    const savedStreak = klarStorage.getItem("klar_weekly_streak");
    const savedLastCheckIn = klarStorage.getItem("klar_last_checkin");

    if (savedStreak) setStreak(parseInt(savedStreak, 10));
    if (savedLastCheckIn) setLastCheckIn(savedLastCheckIn);

    const today = new Date().toDateString();
    if (savedLastCheckIn === today) {
      setHasCheckedInToday(true);
    } else if (savedLastCheckIn) {
      // Check if the streak is broken
      const lastDate = new Date(savedLastCheckIn);
      const currentDate = new Date();
      // Normalize to midnight
      lastDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);

      const diffTime = currentDate.getTime() - lastDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        // Streak broken
        setStreak(0);
        klarStorage.setItem("klar_weekly_streak", "0");
      }
    }
  }, []);

  const handleCheckIn = () => {
    if (hasCheckedInToday) return;

    const newStreak = streak + 1;
    const today = new Date().toDateString();

    setStreak(newStreak);
    setLastCheckIn(today);
    setHasCheckedInToday(true);

    klarStorage.setItem("klar_weekly_streak", newStreak.toString());
    klarStorage.setItem("klar_last_checkin", today);
  };

  const visualStreak = Math.min(streak, 7);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Calendar size={20} className="text-orange-500" />
            Weekly Consistency
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Bleib dran für 7 Tage
          </p>
        </div>
        <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-2.5 py-1 rounded-full border border-orange-200 dark:border-orange-800/50">
          <Flame size={14} className={streak > 0 ? "fill-current text-orange-500 " : "text-orange-300"} />
          <span className="text-xs font-bold">{streak} {streak === 1 ? 'Tag' : 'Tage'}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 mt-2">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => (
          <div key={day} className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 ${
              day <= visualStreak
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
            }`}>
              {day <= visualStreak ? <CheckCircle2 size={16} /> : day}
            </div>
          </div>
        ))}
      </div>

      {streak >= 7 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 p-3 rounded-2xl flex items-center gap-3 mb-4"
        >
          <div className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg">
            <Award size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900 dark:text-amber-100">7-Tage-Badge erreicht!</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Du hast diese Woche jeden Tag an deinen Zielen gearbeitet.</p>
          </div>
        </motion.div>
      )}

      <div className="mt-auto pt-2">
        <button
          onClick={handleCheckIn}
          disabled={hasCheckedInToday}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
            hasCheckedInToday
              ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed'
              : 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 hover:bg-opacity-90 shadow-md'
          }`}
        >
          {hasCheckedInToday ? (
            <>
              <CheckCircle2 size={18} />
              Heute bereits eingecheckt
            </>
          ) : (
            <>
              Check-in für heute
            </>
          )}
        </button>
      </div>
    </div>
  );
}
