import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface DateHistoryEntry {
  id: string;
  matchName: string;
  title: string;
  date: string;
  rating?: number;
  note?: string;
}

export function DateSuccessTrendWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [data, setData] = useState<unknown[]>([]);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_history");
    if (saved) {
      try {
        const history: DateHistoryEntry[] = JSON.parse(saved);

        // Sort history by date
        const sortedHistory = history
          .filter(entry => entry.rating !== undefined)
          .sort((a, b) => {
            // Some dates might be "YYYY-MM-DD" or similar. We try to parse them.
            // If they are not parseable, we just use the string comparison.
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            return dateA - dateB;
          });

        if (sortedHistory.length > 0) {
          // Calculate cumulative success rate
          let positiveCount = 0;
          let totalCount = 0;

          const trendData = sortedHistory.map((entry, index) => {
            totalCount++;
            if (entry.rating && entry.rating >= 4) {
              positiveCount++;
            }

            const successRate = Math.round((positiveCount / totalCount) * 100);

            // Format date for display (e.g. "01.05.")
            let dateLabel = `Date ${index + 1}`;
            try {
              const d = new Date(entry.date);
              if (!isNaN(d.getTime())) {
                dateLabel = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
              }
            } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }

            return {
              name: dateLabel,
              Erfolgsquote: successRate,
              rating: entry.rating,
              verbindung: entry.matchName
            };
          });

          setData(trendData);
        }
      } catch (e) {
        console.warn("Failed to parse date history", e);
      }
    }
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <TrendingUp size={18} className="text-brand dark:text-brand-light" />
            Erfolgsquote
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Entwicklung deiner Date-Erfahrungen über die Zeit
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-[200px] w-full mt-2">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-stone-200 dark:text-stone-800" />
              <XAxis className="text-stone-500 dark:text-stone-400"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#78716c' }}
                dy={10}
              />
              <YAxis className="text-stone-500 dark:text-stone-400"
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#78716c' }}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                formatter={(value: unknown) => [`${value}%`, 'Erfolgsquote']}
                labelFormatter={(label, payload) => {
                  if (payload && payload.length > 0) {
                    return `${label} - Mit ${payload[0]?.payload?.verbindung}`;
                  }
                  return label;
                }}
              />
              <Line
                type="monotone"
                dataKey="Erfolgsquote"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#10b981', stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-4">
            Noch nicht genug bewertete Dates für einen Trend. <br/>
            Bewerte deine Dates in der Historie!
          </div>
        )}
      </div>
    </div>
  );
}
