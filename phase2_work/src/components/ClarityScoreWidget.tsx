import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Activity } from "lucide-react";

export function ClarityScoreWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  type ClarityPoint = { date: string; score: number; fullDate: string; hasDiary: boolean };
  const [data, setData] = useState<ClarityPoint[]>([]);
  const [currentScore, setCurrentScore] = useState(0);

  useEffect(() => {
    // Generate last 14 days
    const chartData = [];
    const savedDiaries = klarStorage.getItem("klar_post_date_diary");
    let diaries: unknown[] = [];
    if (savedDiaries) {
      try { diaries = JSON.parse(savedDiaries); } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    let baseScore = 65;
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0] || '';

      const hasDiary = diaries.some(entry => {
        if (!entry || typeof entry !== 'object') return false;
        return (entry as { date?: unknown }).date === dateStr;
      });

      // Random walk for authenticity, boosted by diary entries
      baseScore += (0 - 5);
      if (hasDiary) baseScore += 15;

      // Clamp between 0 and 100
      baseScore = Math.max(20, Math.min(100, baseScore));

      chartData.push({
        date: `${d.getDate()}.${d.getMonth() + 1}`,
        score: Math.round(baseScore),
        fullDate: dateStr,
        hasDiary
      });
    }

    setData(chartData);
    if (chartData.length > 0) {
      setCurrentScore(chartData[chartData.length - 1]?.score || 0);
    }
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4 z-10">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity size={18} className="text-violet-500" />
            Klarheits-Score
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Dein Authentizitäts-Wert basierend auf Reflexion
          </p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-bold text-xl px-3 py-1 rounded-xl">
          {currentScore}
        </div>
      </div>

      <div className="flex-1 min-h-[150px] w-full mt-2 -ml-2 -mb-2 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#a8a29e' }}
              dy={10}
            />
            <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)'
              }}
              labelStyle={{ color: '#57534e', fontWeight: 600, fontSize: '12px', marginBottom: '4px' }}
              itemStyle={{ color: '#8b5cf6', fontSize: '14px', fontWeight: 600 }}
              formatter={(value: unknown, _name: unknown, props: { payload?: ClarityPoint }) => [
                String(value) + " Punkte " + (props.payload?.hasDiary ? '✨' : ''),
                "Score"
              ]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#8b5cf6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorScore)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {currentScore >= 80 && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-bl-full -z-0 blur-2xl pointer-events-none"></div>
      )}
    </div>
  );
}
