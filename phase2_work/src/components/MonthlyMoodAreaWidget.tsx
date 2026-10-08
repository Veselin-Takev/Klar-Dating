import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Activity } from "lucide-react";

export function MonthlyMoodAreaWidget() {
  const data = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      // Simulate mood curve
      const baseMood = 60 + Math.sin(i / 3) * 20;
      const noise = 0 - 5;
      result.push({
        date: date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
        stimmung: Math.min(100, Math.max(0, Math.round(baseMood + noise)))
      });
    }
    return result;
  }, []);

  const averageMood = Math.round(data.reduce((acc, curr) => acc + curr.stimmung, 0) / data.length);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity size={18} className="text-brand dark:text-brand-light" />
            Monats-Stimmung
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Letzte 30 Tage
          </p>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-stone-900 dark:text-stone-100 block leading-none">{averageMood}%</span>
          <span className="text-[10px] uppercase font-bold text-emerald-500 flex items-center gap-0.5 justify-end mt-1"><TrendingUp size={12} /> Durchschnitt</span>
        </div>
      </div>

      <div className="flex-1 min-h-[120px] -ml-4 -mb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMood" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-stone-200 dark:text-stone-700" opacity={0.5} />
            <XAxis className="text-stone-500 dark:text-stone-400"
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--color-stone-400)' }}
              minTickGap={20}
            />
            <YAxis className="text-stone-500 dark:text-stone-400"
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--color-stone-400)' }}
              hide
            />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '12px', fontWeight: 500, color: '#ec4899' }}
              labelStyle={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}
              formatter={(value: unknown) => [`${value}% Vibe`, 'Stimmung']}
            />
            <Area
              type="monotone"
              dataKey="stimmung"
              stroke="#ec4899"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorMood)"
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
