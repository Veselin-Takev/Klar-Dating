import { useState, useEffect } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { Target, Sparkles } from "lucide-react";
import { fetchCompatibilityRadar } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
import { melde } from "../lib/fehler";

interface Profile {
  id: string;
  name: string;
  interests: string[];
}

interface CompatibilityRadarWidgetProps {
  userInterests: string[];
  verbindungen: Profile[];
}

export function CompatibilityRadarWidget({ userInterests, verbindungen }: CompatibilityRadarWidgetProps) {
  const [radarData, setRadarData] = useState<{subject: string, A: number}[]>([
    { subject: "Hobbies", A: 50 },
    { subject: "Werte", A: 50 },
    { subject: "Lifestyle", A: 50 },
    { subject: "Humor", A: 50 },
    { subject: "Aktivität", A: 50 },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const loadData = async () => {
    if (verbindungen.length === 0 || userInterests.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCompatibilityRadar(userInterests, verbindungen.slice(0, 5));
      setRadarData(data);
      setHasLoaded(true);
    } catch (e) {
      melde("CompatibilityRadarWidget", e);
      setError("Konnte Daten nicht laden.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasLoaded && verbindungen.length > 0 && userInterests.length > 0) {
      loadData();
    }
  }, [verbindungen, userInterests, hasLoaded]);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col relative z-10">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Target size={18} className="text-indigo-500 dark:text-indigo-400" />
            Kompatibilitäts-Radar
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            KI-Analyse aktueller Verbindungen
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isLoading || verbindungen.length === 0}
          className="text-stone-400 hover:text-indigo-500 transition-colors p-1.5 bg-stone-100 dark:bg-stone-800 rounded-full disabled:opacity-50"
          title="Radar aktualisieren"
        >
          <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
        </button>
      </div>

      <div className="flex-1 w-full min-h-[200px] mt-2 relative">
        <AnimatePresence>
          {isLoading && !hasLoaded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-stone-800/80 "
            >
              <Sparkles className=" mb-2 text-indigo-500" size={20} />
              <p className="text-xs font-medium text-stone-500 ">Analysiere Verbindungen...</p>
            </motion.div>
          ) : error && !hasLoaded ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-stone-50 dark:bg-stone-800/50 rounded-xl"
            >
              <p className="text-xs text-red-500">{error}</p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid strokeOpacity={0.2} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: 'currentColor', fontSize: 10, className: 'text-stone-500 dark:text-stone-400' }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Radar
              name="Kompatibilität"
              dataKey="A"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.4}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
