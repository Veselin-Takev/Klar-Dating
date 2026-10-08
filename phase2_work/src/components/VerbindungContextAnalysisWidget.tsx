import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Network, Sparkles, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchMatchContextAnalysis } from "../lib/api";
import { melde } from "../lib/fehler";

interface Reflection {
  id: string;
  date: string;
  positive: string;
  learned: string;
  insight: string;
  notes?: string;
}

interface Topic {
  name: string;
  reason: string;
  score: number;
}

export function VerbindungContextAnalysisWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReflections, setHasReflections] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_reflections");
    if (saved) {
      try {
        const parsed: Reflection[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setHasReflections(true);
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const saved = klarStorage.getItem("klar_date_reflections");
      const reflections = saved ? JSON.parse(saved) : [];
      const result = await fetchMatchContextAnalysis(reflections);
      if (result && result.topics) {
        setTopics(result.topics.sort((a, b) => b.score - a.score));
        setAnalyzed(true);
      } else {
        throw new Error("Unerwartetes Antwortformat");
      }
    } catch (e) {
      melde("VerbindungContextAnalysisWidget", e);
      setError("Analyse konnte nicht durchgeführt werden.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Network size={20} className="text-brand dark:text-brand-light" />
            Verbindung-Kontext-Analyse
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Erfolgsfaktoren basierend auf deinen Date-Reflexionen
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {!hasReflections ? (
          <div className="text-center py-6 text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700">
            Du brauchst mindestens eine Date-Reflexion im Journal für diese Analyse.
          </div>
        ) : !analyzed && !isLoading && !error ? (
          <div className="flex flex-col items-center py-4">
            <button
              onClick={handleAnalyze}
              className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 dark:bg-brand-light dark:hover:bg-brand-light/90 text-white dark:text-stone-900 py-3 rounded-xl text-sm font-medium transition-colors"
            >
              <Sparkles size={16} />
              Bindungspotenziale analysieren
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 text-stone-500"
              >
                <Sparkles className=" mb-3 text-brand" size={24} />
                <p className="text-sm font-medium ">Analysiere Themen & Stimmungen...</p>
              </motion.div>
            ) : error ? (
              <div className="text-center py-6 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl flex flex-col items-center">
                <AlertCircle size={24} className="mb-2" />
                {error}
                <button onClick={() => { setError(null); setAnalyzed(false); }} className="mt-3 text-xs underline">Erneut versuchen</button>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {topics.map((topic, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 relative overflow-hidden">
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 bg-brand/20 dark:bg-brand-light/20"
                      style={{ height: '100%' }}
                    />
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 bg-brand dark:bg-brand-light transition-all duration-1000 ease-out"
                      style={{ height: `${topic.score}%` }}
                    />

                    <div className="pl-3">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {topic.name}
                        </h4>
                        <span className="text-xs font-bold text-brand dark:text-brand-light bg-brand/10 dark:bg-brand-light/10 px-2 py-0.5 rounded-md">
                          {topic.score}%
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 leading-snug">
                        {topic.reason}
                      </p>
                    </div>
                  </div>
                ))}

                <button
                  onClick={handleAnalyze}
                  className="w-full mt-2 py-2 text-xs font-medium text-stone-400 hover:text-stone-600 transition-colors"
                >
                  Neu analysieren
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
