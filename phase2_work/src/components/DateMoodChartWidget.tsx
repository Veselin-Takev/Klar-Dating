import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";


interface Reflection {
  id: string;
  date: string;
  rating?: number;
}

export function DateMoodChartWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [data, setData] = useState<{name: string, rating: number, rawDate: Date}[]>([]);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_reflections");
    let reflections: Reflection[] = [];
    if (saved) {
      try {
        reflections = JSON.parse(saved);
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    const parseDate = (d: string) => {
      if (!d) return new Date("");
      const parts = d.split('.');
      if (parts.length === 3) {
        return new Date(parseInt(parts[2] || "", 10), parseInt(parts[1] || "", 10) - 1, parseInt(parts[0] || "", 10));
      }
      return new Date(d);
    };

    let validReflections = reflections
      .filter(r => typeof r.rating === 'number' && !isNaN(parseDate(r.date).getTime()))
      .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());

    const chartData = validReflections.map(r => {
      const d = parseDate(r.date);
      return {
        name: d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
        rating: r.rating || 3,
        rawDate: d
      };
    });

    setData(chartData.slice(-10)); // keep last 10
  }, []);

  const CustomTooltip = ({ active, payload, label }: unknown) => {
    if (active && payload && payload.length) {
      const moodValue = payload[0].value;
      let moodText = "Ok";
      if (moodValue >= 4.5) moodText = "Super!";
      else if (moodValue >= 3.5) moodText = "Gut";
      else if (moodValue >= 2.5) moodText = "Ok";
      else if (moodValue >= 1.5) moodText = "Durchwachsen";
      else moodText = "Nicht gut";

      return (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-3 rounded-xl shadow-lg">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

          <p className="text-xs text-stone-500 mb-1">{label}</p>
          <p className="text-sm font-bold text-rose-500">
            Rating: {moodValue} <span className="text-stone-400 font-normal">({moodText})</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between w-full mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <TrendingUp size={20} className="text-rose-500" />
            Date Mood Trend
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Deine emotionale Entwicklung (letzte Dates)
          </p>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="flex-1 w-full h-[180px] min-h-[180px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-stone-800" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                dy={10}
              />
              <YAxis
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f43f5e', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Line
                type="monotone"
                dataKey="rating"
                stroke="#f43f5e"
                strokeWidth={3}
                dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6, fill: '#f43f5e', stroke: '#fff', strokeWidth: 2 }}
                animationDuration={1500}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 my-2">
          <TrendingUp size={24} className="text-stone-400 mb-2 opacity-60" />
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">Noch keine Date-Reflexionen</p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 max-w-xs">
            Bewerte deine Dates nach dem Treffen, um hier deinen authentischen Stimmungsverlauf zu sehen.
          </p>
        </div>
      )}
    </div>
  );
}
