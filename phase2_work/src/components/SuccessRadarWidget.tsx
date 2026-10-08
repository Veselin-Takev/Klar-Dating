import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Target, Sparkles, Info } from "lucide-react";

interface ReflectionLog {
  date: string | number;
  personName?: string;
  mood?: string;
  tags?: string[];
}

interface RadarPoint {
  name: string;
  score: number;
  mood?: string;
}

function isReflectionLog(value: unknown): value is ReflectionLog {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (typeof record.date === "string" || typeof record.date === "number")
    && (record.personName === undefined || typeof record.personName === "string")
    && (record.mood === undefined || typeof record.mood === "string")
    && (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every(tag => typeof tag === "string")));
}

export function SuccessRadarWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [data, setData] = useState<RadarPoint[]>([]);
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalysis = () => {
      try {
        const savedLogs = klarStorage.getItem("klar_reflection_logs");
        let logs: ReflectionLog[] = [];
        if (savedLogs) {
          try {
            const parsed: unknown = JSON.parse(savedLogs);
            logs = Array.isArray(parsed) ? parsed.filter(isReflectionLog) : [];
          } catch (error) {
            console.warn("Failed to parse reflection logs", error);
            setUiError("Fehler beim Laden/Verarbeiten der Daten.");
          }
        }

        if (logs.length < 3) {
           setData([]);
           setInsight("Logge mindestens 3 Dates in den Reflexionen, um hier deinen Erfolgs-Trend zu sehen.");
        } else {
           // Sort logs by date ascending
           const sorted = [...logs].sort((a, b) => String(a.date).localeCompare(String(b.date)));

           const chartData = sorted.map((log, index) => {
             // Calculate a score
             let score = 50;
             if (log.mood === 'good') score += 30;
             if (log.mood === 'bad') score -= 30;

             if (log.tags) {
               if (log.tags.includes('spannend')) score += 10;
               if (log.tags.includes('lustig')) score += 10;
               if (log.tags.includes('tiefgründig')) score += 10;
               if (log.tags.includes('awkward')) score -= 10;
               if (log.tags.includes('anstrengend')) score -= 10;
             }

             // Ensure score is between 0 and 100
             score = Math.max(0, Math.min(100, score));

             return {
               name: log.personName || `Date ${index + 1}`,
               score: score,
               mood: log.mood
             };
           });

           setData(chartData);

           // Simple insight based on trend
           const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
           const secondHalf = chartData.slice(Math.floor(chartData.length / 2));

           const avgFirst = firstHalf.reduce((sum, item) => sum + item.score, 0) / firstHalf.length;
           const avgSecond = secondHalf.reduce((sum, item) => sum + item.score, 0) / secondHalf.length;

           if (avgSecond > avgFirst + 10) {
             setInsight("Toller Trend! Deine Dates werden spürbar positiver. Du scheinst besser zu wissen, was du willst.");
           } else if (avgSecond < avgFirst - 10) {
             setInsight("Aktuell scheint es etwas zäh zu sein. Nimm dir vielleicht eine kurze Dating-Pause, um Energie zu tanken.");
           } else {
             setInsight("Deine Dating-Erfahrungen sind sehr konstant. Achte in den Reflexionen auf wiederkehrende Muster.");
           }
        }
        setLoading(false);
      } catch (e) {
         setLoading(false);
      }
    };

    loadAnalysis();

    window.addEventListener('storage', loadAnalysis);
    return () => window.removeEventListener('storage', loadAnalysis);
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4 z-10">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Target size={18} className="text-rose-500" />
            Erfolgs-Radar
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Wie sich deine Dates entwickeln
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-[160px] w-full -ml-2 z-10">
        {loading ? (
           <div className="h-full w-full flex items-center justify-center">
             <div className=" flex flex-col items-center gap-2">
               <Target size={24} className="text-rose-300 dark:text-rose-700" />
               <span className="text-xs text-stone-500 font-medium">Lade Daten...</span>
             </div>
           </div>
        ) : data.length > 0 ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" opacity={0.5} />
                  <XAxis dataKey="name" tick={{fontSize: 10, fill: '#a8a29e'}} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} hide={true} />
                  <Tooltip
                    contentStyle={{borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    itemStyle={{color: '#f43f5e'}}
                  />
                  <Line type="monotone" name="Positivität" dataKey="score" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2}} activeDot={{r: 6, fill: '#f43f5e', stroke: '#fff'}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-center px-4">
             <Info size={24} className="text-stone-300 dark:text-stone-700 mb-2" />
             <p className="text-sm text-stone-500 dark:text-stone-400">Noch nicht genug Daten.</p>
          </div>
        )}
      </div>

      {!loading && insight && (
        <div className="mt-4 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/50 p-3 rounded-2xl z-10 flex gap-3 items-start">
          <Sparkles size={16} className="text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
            {insight}
          </p>
        </div>
      )}
    </div>
  );
}
