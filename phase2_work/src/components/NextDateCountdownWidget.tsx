import { fetchDatePlans } from '../lib/datePlans';
import { useState, useEffect } from 'react';
import { CalendarClock, Heart } from 'lucide-react';

export function NextDateCountdownWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number} | null>(null);
  const [nextDateName, setNextDateName] = useState<string>('');

  useEffect(() => {
    const checkNextDate = async () => {
      try {
        const dates = await fetchDatePlans(); const now = new Date();
        const futureDates = dates.filter(d => new Date(d.date).getTime() > now.getTime()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const next = futureDates[0];
        if (!next) { setTimeLeft(null); return; }
        setNextDateName(next.matchName); const diffTime = new Date(next.date).getTime() - now.getTime();
        setTimeLeft({ days: Math.floor(diffTime / (1000 * 60 * 60 * 24)), hours: Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) });
      } catch (e) { console.warn(e); setUiError('Date-Kalender konnte nicht geladen werden.'); }
    };
    void checkNextDate(); const interval = setInterval(() => void checkNextDate(), 60 * 60 * 1000); return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;

  return (
    <div className="bg-stone-50 border border-stone-200 border border-brand/20 rounded-3xl p-6 shadow-md text-white relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-2 relative z-10">
        <CalendarClock size={20} className="opacity-80" />
        <h3 className="font-semibold text-sm">Vorfreude-Timer</h3>
      </div>

      <div className="relative z-10">
        <p className="text-xs opacity-90 mb-4">Date mit {nextDateName} in...</p>

        <div className="flex gap-4">
          <div className="text-center">
            <span className="text-3xl font-bold block leading-none">{timeLeft.days}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Tage</span>
          </div>
          <div className="text-center">
            <span className="text-3xl font-bold block leading-none">:</span>
          </div>
          <div className="text-center">
            <span className="text-3xl font-bold block leading-none">{timeLeft.hours}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Stunden</span>
          </div>
        </div>

        <div className="mt-5 bg-white/10 p-3 rounded-xl  border border-white/10 flex items-start gap-2">
          <Heart size={14} className="mt-0.5 shrink-0 text-rose-200 fill-current" />
          <p className="text-xs opacity-95">"Bleib du selbst. Das ist mehr als genug."</p>
        </div>
      </div>
    </div>
  );
}
