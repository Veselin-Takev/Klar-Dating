import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { Sparkles, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { melde } from "../lib/fehler";

interface InsightData {
  insight: string;
}

export function DailyCoachInsightWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const { user } = useAuth();
  const [data, setData] = useState<InsightData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchInsight = async () => {
      try {
        setIsLoading(true);
        setError(false);

        // Check if we have cached data for today
        const cachedStr = klarStorage.getItem("klar_daily_insight_cache");
        if (cachedStr) {
          const cached = JSON.parse(cachedStr);
          const today = new Date().toDateString();
          if (cached.date === today && cached.data) {
            setData(cached.data);
            setIsLoading(false);
            return;
          }
        }

        // Get context from local storage
        const savedGoals = klarStorage.getItem("klar_onboarding");
        let userGoals = "Partnersuche";
        if (savedGoals) {
           try {
              const goalsObj = JSON.parse(savedGoals);
              if (goalsObj.intentions) {
                 userGoals = goalsObj.intentions.join(', ');
              }
           } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
        }

        // Analyze recent activity from local storage
        let recentActivity = "Noch keine Dates eingetragen.";
        const reflectionsStr = klarStorage.getItem("klar_date_reflections");
        if (reflectionsStr) {
           try {
              const reflections = JSON.parse(reflectionsStr);
              if (Array.isArray(reflections) && reflections.length > 0) {
                 const latest = reflections[0];
                 recentActivity = `Zuletzt am ${latest.date} ein Date reflektiert. Stimmung: ${latest.positive || 'Ok'}.`;
              }
           } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
        }

        const token = await user.getIdToken();
        const res = await fetch("/api/daily-coach-insight", {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          method: "POST",
          body: JSON.stringify({ userGoals, recentActivity })
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401 && text.includes("einwilligung_fehlt")) {
              setUiError("Für diese Funktion fehlt deine Einwilligung zur KI-Auswertung. Du kannst sie in den Einstellungen erteilen.");
              setError(true);
              setIsLoading(false);
              return;
          }
          console.error("API Error:", res.status, text);
          throw new Error("API failed");
        }

        const result = await res.text().then(text => text ? JSON.parse(text) : {});
        setData(result);

        // Cache it for today
        klarStorage.setItem("klar_daily_insight_cache", JSON.stringify({
          date: new Date().toDateString(),
          data: result
        }));
      } catch (err) {
        melde("DailyCoachInsightWidget", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsight();
  }, [user]);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="absolute -top-6 -right-6 p-4 opacity-10 text-indigo-500">
        <Lightbulb size={120} />
      </div>

      <div className="flex items-start justify-between w-full mb-4">
        <div>
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
            <Sparkles size={20} className="text-indigo-500" />
            Daily Coach Insight
          </h3>
          <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mt-1">
            Dein persönlicher Tipp für heute
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-[120px]">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 text-indigo-400"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-200 dark:bg-indigo-700/50 animate-pulse mb-3"></div>
              <p className="text-xs font-medium">Analysiere deine Ziele...</p>
            </motion.div>
          ) : error || !data ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6"
            >
              <p className="text-sm text-indigo-600/70 dark:text-indigo-400/70">
                Gerade keine Tipps verfügbar. Vertraue auf dein Gefühl!
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="bg-white/60 dark:bg-black/20  border border-white/50 dark:border-white/10 rounded-xl p-4 relative">
                <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100 italic leading-relaxed">
                  "{data.insight}"
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
