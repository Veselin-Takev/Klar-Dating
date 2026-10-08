import { fetchDatePlans } from '../lib/datePlans';
import { useState, useEffect } from "react";
import { CalendarClock, ArrowRight, CalendarPlus } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

export function SmartDateReminderWidget() {
  const [needsReminder, setNeedsReminder] = useState(false);
  const [daysSinceLastDate, setDaysSinceLastDate] = useState<number | null>(null);

  useEffect(() => {
    const checkDates = async () => {
      try {
        const dates = await fetchDatePlans();
        const now = new Date();
        const futureDates = dates.filter(d => new Date(d.date).getTime() > now.getTime());
        if (futureDates.length === 0 && dates.length > 0) {
          const pastDates = dates.filter(d => new Date(d.date).getTime() <= now.getTime()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastDate = pastDates[0];
          if (lastDate) {
            const diffDays = Math.ceil(Math.abs(now.getTime() - new Date(lastDate.date).getTime()) / (1000 * 60 * 60 * 24));
            setDaysSinceLastDate(diffDays); setNeedsReminder(diffDays >= 3);
          }
        } else if (dates.length === 0) {
          setDaysSinceLastDate(null); setNeedsReminder(true);
        } else { setNeedsReminder(false); }
      } catch (e) { melde('SmartDateReminderWidget', e); setNeedsReminder(false); }
    };
    void checkDates(); const interval = setInterval(() => void checkDates(), 60000); return () => clearInterval(interval);
  }, []);

  if (!needsReminder) {
    return null;
  }

  const handleScrollToPlanner = () => {
    const el = document.getElementById("date-planner");
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-800 border border-brand/20 dark:border-brand-light/20 rounded-3xl p-6 shadow-sm h-full flex flex-col relative overflow-hidden"
    >
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand/5 dark:bg-brand-light/5 rounded-full blur-xl pointer-events-none" />

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light flex items-center justify-center shrink-0">
          <CalendarClock size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 leading-tight">
            Dating-Flow halten
          </h3>
          <p className="text-xs text-stone-500">Smart Reminder</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {daysSinceLastDate === null ? (
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
            Du hast aktuell keine Dates geplant. Zeit, den ersten Schritt zu machen und jemanden auf einen Kaffee einzuladen!
          </p>
        ) : (
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
            Dein letztes Date ist schon <strong className="text-stone-900 dark:text-stone-100">{daysSinceLastDate} {daysSinceLastDate === 1 ? 'Tag' : 'Tage'}</strong> her. Halte den Schwung aufrecht und frage nach einem Wiedersehen oder plane ein neues Date.
          </p>
        )}
      </div>

      <button
        onClick={handleScrollToPlanner}
        className="w-full py-3 px-4 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 group shadow-sm relative z-10"
      >
        <CalendarPlus size={16} />
        Neues Date planen
        <ArrowRight size={16} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300" />
      </button>
    </motion.div>
  );
}
