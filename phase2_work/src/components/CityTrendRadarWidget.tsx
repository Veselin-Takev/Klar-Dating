import { useState, useEffect } from "react";
import { Map, MapPin, Sparkles, Compass } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchCityTrendRadar } from "../lib/api";

interface CityTrendRadarWidgetProps {
  location?: string | null;
}

export function CityTrendRadarWidget({ location }: CityTrendRadarWidgetProps) {
  const [trends, setTrends] = useState<{name: string, description: string, vibe: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateTrends = async () => {
    setIsLoading(true);
    try {
      const result = await fetchCityTrendRadar(location);
      setTrends(result.trends || []);
    } catch (error) {
      console.warn("Trend radar error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    generateTrends();
  }, [location]);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Map size={20} className="text-indigo-500" />
            City-Trend Radar
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
            Geheimtipps für {location || "deine Stadt"}
          </p>
        </div>
        <button
          aria-label="Trends neu laden"
          onClick={generateTrends}
          disabled={isLoading}
          className="p-2 text-stone-400 hover:text-indigo-500 transition-colors bg-stone-50 dark:bg-stone-800 rounded-full disabled:opacity-50"
        >
          <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 text-stone-500"
            >
              <Compass className=" mb-3 text-indigo-500" size={24} />
              <p className="text-sm font-medium ">Scoute neue Locations...</p>
            </motion.div>
          ) : trends.length > 0 ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              {trends.map((trend, idx) => (
                <div key={idx} className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl relative overflow-hidden group hover:border-indigo-200 dark:hover:border-indigo-700/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                      <MapPin size={14} className="text-indigo-600 dark:text-indigo-400" />
                      {trend.name}
                    </h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-stone-800 px-2 py-0.5 rounded-full text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                      {trend.vibe}
                    </span>
                  </div>
                  <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                    {trend.description}
                  </p>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center text-stone-500"
            >
              <Sparkles className="mb-3 text-stone-400" size={24} />
              <p className="text-sm font-medium">Keine Trends gefunden</p>
              <p className="text-xs mt-1">Versuche, einen anderen Standort zu wählen.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
