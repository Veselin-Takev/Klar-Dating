import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';

import { CalendarCheck, MessageSquare, Target } from 'lucide-react';

export function WeeklySuccessSummaryWidget() {
  const [stats, setStats] = useState({ dates: 0, icebreakers: 0 });

  useEffect(() => {
    const savedDates = klarStorage.getItem("klar_date_archive");
    let dateCount = 0;
    if (savedDates) {
      dateCount = JSON.parse(savedDates).length;
    }

    const icebreakerCount = parseInt(klarStorage.getItem("klar_icebreaker_count") || "0");

    setStats({
      dates: dateCount,
      icebreakers: icebreakerCount
    });
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-400/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-4">
        <Target size={18} className="text-emerald-500" />
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
          Dating-Erfolgs-Check
        </h3>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full">
          Diese Woche
        </span>
      </div>

      <p className="text-sm text-stone-600 dark:text-stone-400 mb-5 leading-relaxed">
        {stats.dates > 0 || stats.icebreakers > 0
          ? "Starke Woche! Du warst aktiv und bist deinen Zielen einen Schritt näher gekommen. Bleib authentisch!"
          : "Jede große Reise beginnt mit einem kleinen Schritt. Nutze KI-Icebreaker, um diese Woche neue Kontakte zu knüpfen!"}
      </p>

      <div className="grid grid-cols-2 gap-3 mt-auto relative z-10">
        <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-700">
          <div className="flex justify-between items-start mb-2">
            <MessageSquare size={14} className="text-brand dark:text-brand-light" />
            <span className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-none">{stats.icebreakers}</span>
          </div>
          <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Icebreaker</p>
        </div>

        <div className="bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-700">
          <div className="flex justify-between items-start mb-2">
            <CalendarCheck size={14} className="text-brand dark:text-brand-light" />
            <span className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-none">{stats.dates}</span>
          </div>
          <p className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Dates</p>
        </div>
      </div>
    </div>
  );
}
