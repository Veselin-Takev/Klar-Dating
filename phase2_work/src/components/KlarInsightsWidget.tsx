import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Lightbulb } from 'lucide-react';

const GENERISCHE_TIPPS = [
  "Stelle offene Fragen (W-Fragen), die nicht mit 'Ja' oder 'Nein' beantwortet werden können, um den Fluss zu halten.",
  "Beziehe dich auf ein konkretes Detail im Profil deines Gegenübers – das zeigt echtes Interesse.",
  "Qualität vor Quantität: Nimm dir Zeit für deine Antworten, statt schnell zu reagieren.",
  "Ehrlichkeit gewinnt: Es ist völlig okay zuzugeben, wenn du mal nicht weißt, was du schreiben sollst.",
  "Finde Gemeinsamkeiten, aber feiere auch Unterschiede – sie machen das Gespräch erst spannend.",
  "Lass dem anderen Raum zum Antworten. Vermeide es, künstlichen Druck durch Nachfragen aufzubauen."
];

export function KlarInsightsWidget() {
  const { user } = useAuth();
  type InsightsData = {
    connectionsMade: number;
    icebreakerScore: number | null;
    kiErlaubt: boolean;
    icebreakerFeedback?: string | null;
  };
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Wähle einen Tipp deterministisch basierend auf dem aktuellen Tag,
  // damit er nicht bei jedem Render springt, aber täglich wechselt.
  const tagesTipp = useMemo(() => {
    const heute = new Date();
    const tagDesJahres = Math.floor((heute.getTime() - new Date(heute.getFullYear(), 0, 0).getTime()) / 86400000);
    return GENERISCHE_TIPPS[tagDesJahres % GENERISCHE_TIPPS.length];
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user || isOffline) {
      if (!user) setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    fetch("/api/stats/klar-insights")
      .then(res => {
        if (!res.ok) throw new Error("Netzwerkfehler");
        return res.json();
      })
      .then(result => {
        const parsed: unknown = result;
        if (!parsed || typeof parsed !== 'object') throw new Error("Ungültige Insight-Antwort");
        const value = parsed as Record<string, unknown>;
        if (
          typeof value.connectionsMade !== 'number' ||
          (value.icebreakerScore !== null && typeof value.icebreakerScore !== 'number') ||
          typeof value.kiErlaubt !== 'boolean'
        ) {
          throw new Error("Ungültige Insight-Antwort");
        }
        const normalized: InsightsData = {
          connectionsMade: value.connectionsMade,
          icebreakerScore: value.icebreakerScore,
          kiErlaubt: value.kiErlaubt,
          icebreakerFeedback: typeof value.icebreakerFeedback === 'string' ? value.icebreakerFeedback : null,
        };
        if (mounted) {
          setData(normalized);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message || "Fehler beim Laden");
          setIsLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [user, isOffline]);

  if (isOffline) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800 rounded-[24px] p-6 text-center border border-stone-200 dark:border-stone-700">
        <p className="text-stone-500 font-medium">Du bist offline. Insights nicht verfügbar.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800 rounded-[24px] p-6 text-center border border-amber-200 dark:border-amber-900">
        <p className="text-amber-700 dark:text-amber-400 mb-3 font-medium">Verbindung fehlgeschlagen</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-full text-sm font-medium hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors">
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800 rounded-[24px] p-6 border border-stone-200 dark:border-stone-700 flex flex-col gap-4 ">
        <div className="h-6 bg-stone-200 dark:bg-stone-800 rounded-md w-1/3"></div>
        <div className="h-16 bg-stone-200 dark:bg-stone-800 rounded-xl w-full"></div>
      </div>
    );
  }

  if (!data || (data.connectionsMade === 0 && data.icebreakerScore === null)) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800 rounded-[24px] p-6 flex flex-col items-center text-center border border-stone-200 dark:border-stone-700">
        <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-2">Klar Insights</h3>
        <p className="text-stone-600 dark:text-stone-400 text-sm mb-4">
          Noch keine Gespräche diese Woche. Schreibe jemanden an, um hier deine Auswertung zu sehen.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 dark:bg-stone-800 rounded-[24px] p-6 border border-stone-200 dark:border-stone-700">
      <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-6">Deine Woche</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-stone-950 rounded-[16px] p-5 border border-stone-100 dark:border-stone-700">
          <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-semibold">Geführte Gespräche</p>
          <p className="text-4xl font-serif text-stone-900 dark:text-stone-100">{data.connectionsMade}</p>
        </div>

        {data.kiErlaubt ? (
          <div className="bg-white dark:bg-stone-950 rounded-[16px] p-5 border border-stone-100 dark:border-stone-700">
            <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-semibold">Icebreaker Qualität</p>
            {data.icebreakerScore !== null ? (
              <>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-serif text-stone-900 dark:text-stone-100">{data.icebreakerScore}</span>
                  <span className="text-sm font-medium text-stone-400">/ 5</span>
                </div>
                {data.icebreakerFeedback && (
                  <p className="text-sm text-stone-700 dark:text-stone-400 mt-3 leading-relaxed">{data.icebreakerFeedback}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">Noch nicht genug Daten für eine Bewertung.</p>
            )}
          </div>
        ) : (
          <div className="bg-stone-100 dark:bg-stone-800 rounded-[16px] p-5 border border-stone-200 dark:border-stone-700 opacity-80 flex flex-col justify-center">
            <p className="text-xs text-stone-500 mb-2 uppercase tracking-wide font-semibold">Auswertung pausiert</p>
            <p className="text-sm text-stone-600 dark:text-stone-400">Du hast der KI-Auswertung in den Einstellungen nicht zugestimmt.</p>
          </div>
        )}
      </div>

      <div className="mt-4 bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-[16px] p-5 flex gap-4 items-start">
        <div className="p-2 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-full shrink-0">
          <Lightbulb size={20} />
        </div>
        <div>
          <p className="text-xs text-brand dark:text-brand-light mb-1 uppercase tracking-wide font-semibold">Tipp des Tages</p>
          <p className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed">{tagesTipp}</p>
        </div>
      </div>
    </div>
  );
}
