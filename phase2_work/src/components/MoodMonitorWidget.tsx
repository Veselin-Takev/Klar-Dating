import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Activity, Flame, Heart, Snowflake, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { melde } from "../lib/fehler";

interface MoodData {
  moodCategory: "harmonisch" | "intensiv" | "distanziert";
  score: number;
  comment: string;
}

export function MoodMonitorWidget() {
  const [data, setData] = useState<MoodData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMoodData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const chats = klarStorage.getItem("klar_recent_chats");
      if (!chats || chats.trim().length === 0) {
        setData(null);
        return;
      }

      const res = await fetch("/api/mood-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chats })
      });

      if (!res.ok) {
        const errorData = await res.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
        throw new Error(errorData.error || "Fehler beim Laden der Stimmungs-Analyse.");
      }

      const result = await res.text().then(text => text ? JSON.parse(text) : {});
      setData(result);
    } catch (e) {
      melde("MoodMonitorWidget", e);
      setError(e instanceof Error ? e.message : "Stimmungs-Monitor konnte nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMoodData();
  }, []);

  const getMoodConfig = (category: string) => {
    switch (category) {
      case "harmonisch":
        return {
          icon: <Heart size={24} className="text-emerald-500" />,
          color: "text-emerald-500",
          bg: "bg-emerald-50 dark:bg-emerald-500/10",
          border: "border-emerald-200 dark:border-emerald-800",
          label: "Harmonisch"
        };
      case "intensiv":
        return {
          icon: <Flame size={24} className="text-orange-500" />,
          color: "text-orange-500",
          bg: "bg-orange-50 dark:bg-orange-500/10",
          border: "border-orange-200 dark:border-orange-800",
          label: "Intensiv"
        };
      case "distanziert":
      default:
        return {
          icon: <Snowflake size={24} className="text-blue-500" />,
          color: "text-blue-500",
          bg: "bg-blue-50 dark:bg-blue-500/10",
          border: "border-blue-200 dark:border-blue-800",
          label: "Distanziert"
        };
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity size={18} className="text-brand dark:text-brand-light" />
            Stimmungs-Monitor
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Sentiment-Analyse der letzten 5 Chats
          </p>
        </div>
        <button
          onClick={fetchMoodData}
          disabled={isLoading}
          className="text-stone-400 hover:text-brand dark:hover:text-brand-light transition-colors p-1.5 bg-stone-100 dark:bg-stone-800 rounded-full disabled:opacity-50"
          title="Neu analysieren"
        >
          <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {isLoading && !data ? (
          <div className="flex flex-col items-center justify-center py-6 text-stone-500">
            <MessageCircle className=" mb-3 text-brand dark:text-brand-light" size={24} />
            <p className="text-sm font-medium ">Lese zwischen den Zeilen...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4 text-sm text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            {error}
          </div>
        ) : !data ? (
          <div className="py-6 px-4 text-center bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-100 dark:border-stone-700">
            <MessageCircle size={24} className="mx-auto mb-2 text-stone-400 opacity-60" />
            <p className="text-xs font-medium text-stone-700 dark:text-stone-300">Noch keine aktiven Chats</p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 max-w-xs mx-auto">
              Sobald du Nachrichten austauschst, analysiert der KI-Monitor die Tonalität und Stimmung deiner Gespräche.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={data.moodCategory}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col h-full"
            >
              {(() => {
                const config = getMoodConfig(data.moodCategory);
                return (
                  <div className={`rounded-xl p-4 flex items-center gap-4 border ${config.bg} ${config.border} mb-4`}>
                    <div className="bg-white dark:bg-stone-800 p-3 rounded-full shadow-sm">
                      {config.icon}
                    </div>
                    <div>
                      <h4 className={`text-lg font-bold ${config.color} uppercase tracking-wide`}>
                        {config.label}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 w-24 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${data.score}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`h-full ${config.color.replace('text-', 'bg-')}`}
                          />
                        </div>
                        <span className="text-xs font-bold text-stone-600 dark:text-stone-300">{data.score}/100</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700">
                <p className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed italic">
                  "{data.comment}"
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
