import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { MessageCircleHeart, Sparkles, Copy, Check, Bookmark } from 'lucide-react';
import { motion } from "motion/react";

interface DailyIcebreakerWidgetProps {
  userInterests: string[];
  matchesInterests: string[];
}

export function DailyIcebreakerWidget({ userInterests, matchesInterests }: DailyIcebreakerWidgetProps) {
  const [uiError, setUiError] = useState<string | null>(null);

  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedIcebreakers, setSavedIcebreakers] = useState<string[]>([]);

  useEffect(() => {
    const stored = klarStorage.getItem('klar_saved_icebreakers');
    if (stored) {
      try { setSavedIcebreakers(JSON.parse(stored)); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const saveIcebreaker = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    let updated;
    if (savedIcebreakers.includes(text)) {
      updated = savedIcebreakers.filter(t => t !== text);
    } else {
      updated = [text, ...savedIcebreakers];
    }
    setSavedIcebreakers(updated);
    klarStorage.setItem('klar_saved_icebreakers', JSON.stringify(updated));
  };


  useEffect(() => {
    const fetchIcebreakers = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const res = await fetch("/api/daily-icebreakers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userInterests, matchesInterests })
        });

        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.text().then(text => text ? JSON.parse(text) : {});
        setIcebreakers(data.icebreakers || []);
      } catch (e) {
        console.warn("Failed to load daily icebreakers", e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    // Refresh every 24 hours or if not present
    const cached = klarStorage.getItem("klar_daily_icebreakers");
    const cacheTime = klarStorage.getItem("klar_daily_icebreakers_time");

    const isCacheValid = cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 24 * 60 * 60 * 1000;

    if (isCacheValid) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setIcebreakers(parsed);
        } else {
          fetchIcebreakers();
        }
      } catch {
        fetchIcebreakers();
      }
    } else {
      fetchIcebreakers();
    }
  // 14.08.2026: Vorher `}, [userInterests, matchesInterests]);` — beides
  // sind FELDER, und `Dashboard.tsx` bildet `matchesInterests` bei jedem
  // Rendern neu (`Array.from(new Set(…)).slice(0, 10)`). React vergleicht
  // mit `Object.is`; zwei Felder mit gleichem Inhalt sind verschieden.
  // Also lief dieser Effekt bei JEDEM Rendern des Dashboards — und mit
  // ihm ein Aufruf an einen KI-Endpunkt. Im Browser gemessen: 1.883
  // Anfragen fuer einen Seitenaufruf, bis die Gastgrenze mit 429 kam.
  //
  // Die Abhaengigkeit haengt jetzt am INHALT. Damit ist der Baustein
  // unabhaengig davon, was der Elternteil tut — das ist die richtige
  // Stelle fuer die Absicherung, denn Aufrufer gibt es viele.
  }, [userInterests.join('|'), matchesInterests.join('|')]);

  useEffect(() => {
    if (icebreakers.length > 0) {
      klarStorage.setItem("klar_daily_icebreakers", JSON.stringify(icebreakers));
      klarStorage.setItem("klar_daily_icebreakers_time", Date.now().toString());
    }
  }, [icebreakers]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (error && icebreakers.length === 0) return null;

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-5 border border-stone-200 dark:border-stone-700 shadow-sm relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -z-10" />

      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
          <MessageCircleHeart size={20} />
        </div>
        <div>
          <h3 className="font-serif font-medium text-lg text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
            Tägliche Icebreaker
            <Sparkles size={14} className="text-indigo-500" />
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Fragen für den perfekten Einstieg</p>
        </div>
      </div>

      {isLoading && icebreakers.length === 0 ? (
        <div className="space-y-3 ">
          <div className="h-12 bg-stone-100 dark:bg-stone-800 rounded-xl w-full" />
          <div className="h-12 bg-stone-100 dark:bg-stone-800 rounded-xl w-full" />
          <div className="h-12 bg-stone-100 dark:bg-stone-800 rounded-xl w-full" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2"
        >
          {icebreakers.map((question, i) => (
            <div
              key={i}
              className="group flex items-start gap-3 p-3 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl border border-stone-100 dark:border-stone-700/50 transition-colors cursor-pointer"
              onClick={() => copyToClipboard(question, i)}
            >
              <p className="text-sm text-stone-700 dark:text-stone-300 flex-1 leading-snug font-medium">
                "{question}"
              </p>

              <div className="flex gap-1 shrink-0">
                <button
                  onClick={(e) => saveIcebreaker(e, question)}
                  className={`p-1.5 rounded-lg transition-colors ${savedIcebreakers.includes(question) ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-white dark:bg-stone-700 text-stone-400 hover:text-amber-500 border border-stone-200 dark:border-stone-600'}`}
                  title="Speichern für später"
                >
                  <Bookmark size={14} className={savedIcebreakers.includes(question) ? 'fill-current' : ''} />
                </button>
                <button
                  className={`p-1.5 rounded-lg transition-colors ${copiedIndex === i ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-white dark:bg-stone-700 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 border border-stone-200 dark:border-stone-600'}`}
                  title="Kopieren"
                >
                  {copiedIndex === i ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
