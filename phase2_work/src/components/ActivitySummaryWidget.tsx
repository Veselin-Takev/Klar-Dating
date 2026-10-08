import { useState, useEffect } from 'react';
import { Send, Zap, AlertCircle } from 'lucide-react';


interface ActivityStats {
  contactsSent: number;
  connectionsMade: number;
}

export function ActivitySummaryWidget() {
  const [zustand, setZustand] = useState<'lade' | 'fehler' | 'erfolg' | 'offline'>('lade');
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!navigator.onLine) {
      setZustand('offline');
      return;
    }

    const fetchStats = async () => {
      try {
        setZustand('lade');
        const res = await fetch('/api/stats/activity', {
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) {
          throw new Error('Fehler beim Laden der Statistiken.');
        }
        const data = await res.json() as ActivityStats;
        setStats(data);
        setZustand('erfolg');
      } catch (err) {
        console.warn(err);
        setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler.');
        setZustand('fehler');
      }
    };

    fetchStats();
  }, []);

  if (zustand === 'lade') {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm h-[140px] flex flex-col justify-center gap-4">
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-1/2 "></div>
            <div className="h-8 bg-stone-100 dark:bg-stone-800 rounded w-3/4 "></div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-100 dark:bg-stone-800 rounded w-1/2 "></div>
            <div className="h-8 bg-stone-100 dark:bg-stone-800 rounded w-3/4 "></div>
          </div>
        </div>
      </div>
    );
  }

  if (zustand === 'offline') {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm h-[140px] flex flex-col justify-center items-center text-center">
        <AlertCircle size={24} className="text-stone-400 mb-2" />
        <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
          Du bist offline.
        </p>
        <p className="text-xs text-stone-500">
          Stelle eine Verbindung her, um deine Aktivitäten zu sehen.
        </p>
      </div>
    );
  }

  if (zustand === 'fehler' || !stats) {
    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm h-[140px] flex flex-col justify-center items-center text-center">
        <AlertCircle size={24} className="text-orange-500 mb-2" />
        <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
          {errorMsg}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-2 text-xs font-semibold text-brand hover:underline"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  const { contactsSent, connectionsMade } = stats;
  // Rule 5: Leerzustand mit sinnvollem nächsten Schritt
  const isEmpty = contactsSent === 0 && connectionsMade === 0;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 dark:bg-brand-light/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-4 z-10 relative">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
          Deine Aktivität (Letzte 7 Tage)
        </h3>
      </div>

      {isEmpty ? (
        <div className="text-center py-2 z-10 relative">
          <p className="text-sm text-stone-600 dark:text-stone-300 mb-2 font-medium">
            Noch keine Aktivität in den letzten 7 Tagen.
          </p>
          <p className="text-xs text-stone-500">
            Nutze deine Kontakte, um neue Menschen kennenzulernen. Jeder Tag bietet 8 neue Chancen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 z-10 relative">
          <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700 flex flex-col">
            <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 mb-1">
              <Send size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Kontakte</span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-serif font-medium text-stone-900 dark:text-stone-100 leading-none">
                {contactsSent}
              </span>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 mb-1 font-medium">gesendet</span>
            </div>
          </div>

          <div className="bg-brand/5 dark:bg-brand-light/5 rounded-xl p-3 border border-brand/10 dark:border-brand-light/10 flex flex-col">
            <div className="flex items-center gap-1.5 text-brand dark:text-brand-light mb-1">
              <Zap size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Verbindungen</span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-3xl font-serif font-medium text-brand dark:text-brand-light leading-none">
                {connectionsMade}
              </span>
              <span className="text-[10px] text-brand/70 dark:text-brand-light/70 mb-1 font-medium">erfolgreich</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
