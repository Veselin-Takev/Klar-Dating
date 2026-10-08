import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { TrendingUp, Sparkles, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { fetchDatingSuccessScore } from "../lib/api";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { melde } from "../lib/fehler";

interface Reflection {
  id: string;
  date: string;
  notes: string;
  insight: string;
}

interface ScoreData {
  category: string;
  score: number;
}

interface TrendData {
  name: string;
  score: number;
}

interface SuccessAnalysis {
  scores: ScoreData[];
  trend?: TrendData[];
  insight: string;
}

export function DatingSuccessScoreWidget() {
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [analysis, setAnalysis] = useState<SuccessAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_reflections");
    if (saved) {
      setReflections(JSON.parse(saved));
    }
  }, []);

  const handleAnalyze = async () => {
    if (reflections.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchDatingSuccessScore(reflections);
      setAnalysis(result);
    } catch (e) {
      melde("DatingSuccessScoreWidget", e);
      setError("Konnte den Score nicht berechnen.");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-rose-500";
  };

  // Default trend data for visual presentation if API doesn't return one
  const trendData = analysis?.trend?.length
    ? analysis.trend
    : (reflections.length > 0 ? [
        { name: "Start", score: 50 },
        { name: "Mitte", score: 65 },
        { name: "Jetzt", score: 85 }
      ] : []);

  const currentScore = trendData.length > 0 ? trendData[trendData.length - 1]!.score : 0;
  const previousScore = trendData.length > 1 ? trendData[trendData.length - 2]!.score : 0;
  const trendDiff = currentScore - previousScore;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity size={18} className="text-rose-500 dark:text-rose-400" />
            Dating-Dynamik
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Qualitäts-Trend deiner Dates
          </p>
        </div>

        {analysis && trendData.length > 0 && (
          <div className="text-right">
            <div className="text-2xl font-bold text-stone-900 dark:text-stone-100">
              {currentScore}
            </div>
            {trendData.length > 1 && (
              <div className={`text-xs font-medium flex items-center justify-end gap-1 ${trendDiff >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                {trendDiff >= 0 ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                {Math.abs(trendDiff)} Pkt.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1 flex flex-col">
        {reflections.length === 0 ? (
          <div className="text-center py-6 text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-xl m-auto">
            Protokolliere Dates im Journal, um deinen Erfolgs-Score zu sehen.
          </div>
        ) : !analysis && !isLoading && !error ? (
          <div className="flex flex-col items-center justify-center py-6 m-auto w-full">
            <button
              onClick={handleAnalyze}
              className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Sparkles size={16} />
              Dating-Dynamik analysieren
            </button>
            <p className="text-xs text-stone-500 mt-3 text-center px-4">
              Basierend auf {reflections.length} Journal-Einträgen
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-12 text-stone-500 m-auto"
              >
                <Sparkles className=" mb-3 text-rose-500" size={24} />
                <p className="text-sm font-medium ">Analysiere Dynamik...</p>
              </motion.div>
            ) : error ? (
              <div className="text-center py-6 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 rounded-xl m-auto w-full">
                {error}
                <button onClick={() => setAnalysis(null)} className="mt-2 text-xs underline block mx-auto text-stone-500">Zurück</button>
              </div>
            ) : analysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-6"
              >
                {/* Recharts Trend Area */}
                {trendData.length > 0 && (
                  <div className="w-full h-32 -mx-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis className="text-stone-500 dark:text-stone-400"
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fill: 'currentColor' }}
                          dy={10}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', background: 'rgba(255, 255, 255, 0.9)' }}
                          itemStyle={{ color: '#f43f5e', fontWeight: 'bold' }}
                          labelStyle={{ color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}
                          formatter={(value: unknown) => [`${value} Pkt.`, 'Score']}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#f43f5e"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorScore)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="space-y-3">
                  {analysis.scores.map((item, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-700 dark:text-stone-300">{item.category}</span>
                        <span className="font-bold text-stone-900 dark:text-stone-100">{item.score}%</span>
                      </div>
                      <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.score}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1 }}
                          className={`h-full rounded-full ${getScoreColor(item.score)}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {analysis.insight && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-100 dark:border-rose-800">
                    <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-100 flex items-center gap-2 mb-2">
                      <TrendingUp size={16} className="text-rose-500" />
                      KI-Erkenntnis
                    </h4>
                    <p className="text-sm text-rose-800 dark:text-rose-200">
                      {analysis.insight}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
