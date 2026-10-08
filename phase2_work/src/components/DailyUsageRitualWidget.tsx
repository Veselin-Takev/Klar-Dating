import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function DailyUsageRitualWidget() {
  const [secondsToday, setSecondsToday] = useState(0);

  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0] ?? '';
    const storedDate = klarStorage.getItem('klar_usage_date');
    const storedSeconds = parseInt(klarStorage.getItem('klar_usage_seconds') || '0', 10);

    let initialSeconds = 0;
    if (storedDate === todayStr && !isNaN(storedSeconds)) {
      initialSeconds = storedSeconds;
    } else {
      klarStorage.setItem('klar_usage_date', todayStr);
      klarStorage.setItem('klar_usage_seconds', '0');
    }

    setSecondsToday(initialSeconds);

    const interval = setInterval(() => {
      setSecondsToday(prev => {
        const next = prev + 1;
        klarStorage.setItem('klar_usage_seconds', next.toString());
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(secondsToday / 60);
  const recommendedMax = 15;
  const isOverLimit = minutes >= recommendedMax;

  const progressPercentage = Math.min((minutes / recommendedMax) * 100, 100);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm flex flex-col relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-brand dark:text-brand-light" />
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
          Dein Tages-Ritual
        </h3>
      </div>

      <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 font-medium leading-relaxed">
        Klar funktioniert am besten als kurzes, tägliches Ritual. Wir empfehlen maximal {recommendedMax} Minuten am Tag, um fokussiert zu bleiben.
      </p>

      <div className="flex items-end gap-2 mb-4">
        <span className="text-4xl font-serif font-medium text-stone-900 dark:text-stone-100 leading-none">
          {minutes}
        </span>
        <span className="text-sm text-stone-500 dark:text-stone-400 font-medium mb-1">
          Minuten heute
        </span>
      </div>

      <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${isOverLimit ? 'bg-orange-500' : 'bg-brand dark:bg-brand-light'}`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      {isOverLimit && (
        <p className="mt-3 text-xs text-orange-600 dark:text-orange-400 font-medium">
          Tageslimit erreicht. Zeit für eine Pause im echten Leben.
        </p>
      )}
    </div>
  );
}
