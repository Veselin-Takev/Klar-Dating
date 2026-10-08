import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Sparkles, Calendar, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

export function DateMoodStreakWidget() {
  const [streak, setStreak] = useState(0);
  const [hasLoggedToday, setHasLoggedToday] = useState(false);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_reflections");
    if (!saved) return;
    try {
      const parsed: unknown = JSON.parse(saved);
      const reflections = Array.isArray(parsed) ? parsed.filter((value): value is { date: string } => !!value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Record<string, unknown>).date === 'string') : [];
      if (!Array.isArray(reflections) || reflections.length === 0) return;

      const parseDate = (d: string) => {
        if (!d) return new Date("");
        const parts = d.split('.');
        if (parts.length === 3) {
          return new Date(parseInt(parts[2] || "", 10), parseInt(parts[1] || "", 10) - 1, parseInt(parts[0] || "", 10));
        }
        return new Date(d);
      };

      // Get unique dates sorted descending
      const dates = [...new Set(reflections.map((r) => r.date).filter(Boolean))]
        .map(d => parseDate(d))
        .filter(d => !isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime());

      if (dates.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let currentStreak = 0;

      // check if today is logged
      const firstDate = dates[0] as Date;
      firstDate.setHours(0, 0, 0, 0);

      if (firstDate.getTime() === today.getTime()) {
        setHasLoggedToday(true);
      } else if (firstDate.getTime() !== yesterday.getTime()) {
        // No streak
        setStreak(0);
        return;
      }

      // Calculate streak
      const expectedDate = new Date(firstDate);
      for (const d of dates) {
        d.setHours(0,0,0,0);
        if (d.getTime() === expectedDate.getTime()) {
          currentStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }

      setStreak(currentStreak);

    } catch (e) {
      melde("DateMoodStreakWidget", e);
    }
  }, []);

  return (
    <div className=" from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-800 rounded-3xl p-6 shadow-sm h-full flex flex-col justify-center items-center text-center relative z-10 overflow-hidden text-white">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Sparkles size={64} />
      </div>

      <h3 className="font-semibold text-indigo-100 flex items-center gap-2 mb-2">
        <Calendar size={18} />
        Reflexions-Streak
      </h3>

      <div className="flex items-end justify-center gap-2 my-2">
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="text-5xl font-black tracking-tight"
        >
          {streak}
        </motion.span>
        <span className="text-lg font-medium text-indigo-200 mb-1">
          {streak === 1 ? 'Tag' : 'Tage'}
        </span>
      </div>

      <p className="text-sm font-medium text-indigo-100/90 mt-2 px-2">
        {hasLoggedToday
          ? "Du hast dein Date heute bereits reflektiert. Weiter so!"
          : "Reflektiere heute ein Date, um deinen Streak zu erhöhen."}
      </p>

      {streak > 1 && (
        <div className="mt-4 bg-white/20  border border-white/30 px-3 py-1.5 rounded-full flex items-center gap-1.5">
          <TrendingUp size={14} className="text-white" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">On Fire!</span>
        </div>
      )}
    </div>
  );
}
