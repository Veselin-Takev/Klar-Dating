import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, MessageCircle } from "lucide-react";

type Sentiment = "positive" | "neutral" | "negative";
type SentimentRecord = { id?: string; sentiment: Sentiment; date: string };
type ChartPoint = { name: string; value: number; sentiment: Sentiment; rawDate: Date };
type TooltipProps = { active?: boolean; payload?: Array<{ payload: ChartPoint }>; label?: string };

export function SentimentAnalyticsWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [data, setData] = useState<ChartPoint[]>([]);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_chat_sentiment_history");
    let history: SentimentRecord[] = [];
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        history = Array.isArray(parsed) ? parsed.filter((item): item is SentimentRecord => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
          const value = item as Record<string, unknown>;
          return typeof value.date === 'string' && (value.sentiment === 'positive' || value.sentiment === 'neutral' || value.sentiment === 'negative');
        }) : [];
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    if (history.length < 2) {
      // Mock data if not enough history
      const now = new Date();
      history = [
        { id: '1', sentiment: 'negative', date: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() },
        { id: '2', sentiment: 'neutral', date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString() },
        { id: '3', sentiment: 'positive', date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString() },
        { id: '4', sentiment: 'positive', date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() },
        ...history
      ];
    }

    const valueMap: Record<string, number> = {
      positive: 3,
      neutral: 2,
      negative: 1
    };

    const formattedData = history.map((item) => {
      const dateObj = new Date(item.date);
      return {
        name: dateObj.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }),
        value: valueMap[item.sentiment] || 2,
        sentiment: item.sentiment,
        rawDate: dateObj
      };
    }).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    setData(formattedData);
  }, []);

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const val = payload[0].payload.sentiment;
      let text = "Okay";
      let emoji = "🤔";
      if (val === "positive") { text = "Super"; emoji = "😍"; }
      if (val === "negative") { text = "Zäh"; emoji = "😬"; }

      return (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-3 rounded-xl shadow-lg">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

          <p className="text-xs text-stone-500 mb-1">{label}</p>
          <p className="text-sm font-bold text-brand dark:text-brand-light flex items-center gap-2">
            <span className="text-xl">{emoji}</span> {text}
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
            <TrendingUp size={20} className="text-brand" />
            Gesprächsqualität Trend
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Entwicklung deiner Chat-Vibes über die Zeit
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand-light/10 flex items-center justify-center">
          <MessageCircle size={20} className="text-brand dark:text-brand-light" />
        </div>
      </div>

      <div className="flex-1 w-full h-[220px] min-h-[220px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-stone-800" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              dy={10}
            />
            <YAxis
              domain={[1, 3]}
              ticks={[1, 2, 3]}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => val === 3 ? "Gut" : val === 2 ? "Okay" : "Zäh"}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#4F46E5', strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#4F46E5"
              strokeWidth={3}
              dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
