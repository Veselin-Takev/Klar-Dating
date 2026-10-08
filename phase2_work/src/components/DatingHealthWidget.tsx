import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { HeartPulse, Activity, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { motion } from "motion/react";

interface DateHistoryEntry {
  id: string;
  date: string;
}

export function DatingHealthWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [dateCount, setDateCount] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [status, setStatus] = useState({ label: "Analysiere...", color: "text-stone-500", bg: "bg-stone-100 dark:bg-stone-800" });

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_history");
    let history: DateHistoryEntry[] = [];
    if (saved) {
      try {
        history = JSON.parse(saved);
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const recentDates = history.filter(entry => {
      try {
        const d = new Date(entry.date);
        return !isNaN(d.getTime()) && d >= threeMonthsAgo && d <= now;
      } catch {
        return false;
      }
    });

    const previousDates = history.filter(entry => {
      try {
        const d = new Date(entry.date);
        return !isNaN(d.getTime()) && d >= sixMonthsAgo && d < threeMonthsAgo;
      } catch {
        return false;
      }
    });

    const count = recentDates.length;
    setDateCount(count);

    if (count > previousDates.length) setTrend('up');
    else if (count < previousDates.length) setTrend('down');
    else setTrend('stable');

    if (count === 0) {
      setStatus({ label: "Sehr ruhig", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" });
    } else if (count >= 1 && count <= 3) {
      setStatus({ label: "Ausgeglichen", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" });
    } else if (count >= 4 && count <= 8) {
      setStatus({ label: "Sehr aktiv", color: "text-brand dark:text-brand-light", bg: "bg-brand/10 dark:bg-brand-light/10" });
    } else {
      setStatus({ label: "Burnout-Gefahr", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30" });
    }
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <HeartPulse size={18} className="text-rose-500" />
            Dating-Gesundheit
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Frequenz der letzten 3 Monate
          </p>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${status.bg} ${status.color}`}>
          {dateCount > 8 ? <AlertCircle size={12} /> : <Activity size={12} />}
          {status.label}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-end gap-4 mb-4">
          <div className="flex-1">
            <div className="flex justify-between items-end mb-2">
              <span className="text-3xl font-black text-stone-900 dark:text-stone-100">{dateCount}</span>
              <span className="text-sm text-stone-500 dark:text-stone-400 mb-1">Dates</span>
            </div>
            <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (dateCount / 10) * 100)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className={`h-full rounded-full ${dateCount > 8 ? 'bg-rose-500' : dateCount === 0 ? 'bg-blue-400' : 'bg-emerald-500'}`}
              />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 min-w-[70px]">
            {trend === 'up' ? (
              <TrendingUp size={20} className="text-emerald-500 mb-1" />
            ) : trend === 'down' ? (
              <TrendingDown size={20} className="text-blue-500 mb-1" />
            ) : (
              <Activity size={20} className="text-stone-400 mb-1" />
            )}
            <span className="text-[10px] font-medium text-stone-500">Trend</span>
          </div>
        </div>

        <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700">
          <p className="text-xs text-stone-600 dark:text-stone-300">
            {dateCount === 0
              ? "Eine kleine Pause kann gut tun. Wenn du bereit bist, stürze dich wieder ins Dating-Leben!"
              : dateCount <= 3
              ? "Ein gesundes Tempo! Du nimmst dir Zeit für Dates, ohne dich zu überlasten."
              : dateCount <= 8
              ? "Du bist sehr aktiv! Vergiss nicht, dir zwischen den Dates auch Zeit für dich selbst zu nehmen."
              : "Achtung: Sehr viele Dates können zu Dating-Burnout führen. Gönn dir öfter mal Pausen!"}
          </p>
        </div>
      </div>
    </div>
  );
}
