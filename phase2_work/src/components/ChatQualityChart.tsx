import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { HeartPulse } from 'lucide-react';

interface ChatQualityChartProps {
  data?: { name: string; score: number }[];
}

export function ChatQualityChart({ data }: ChatQualityChartProps) {
  // If no data provided or empty, show empty state rather than inventing scores
  const chartData = data && data.length > 0 ? data : null;

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-4 shadow-sm my-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-xl text-rose-500">
          <HeartPulse size={16} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Gesprächsqualität</h4>
          <p className="text-[10px] text-stone-500 dark:text-stone-400">Empathie-Trend im Chatverlauf</p>
        </div>
      </div>

      {chartData ? (
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} opacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#f43f5e', fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ color: '#6b7280', fontSize: '10px' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="Empathie-Score"
                stroke="#f43f5e"
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-4 bg-stone-50 dark:bg-stone-800/40 rounded-xl">
          Noch nicht genügend Nachrichten für einen Empathie-Trend vorhanden.
        </p>
      )}
    </div>
  );
}
