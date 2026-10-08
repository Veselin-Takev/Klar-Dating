import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { Activity, CalendarDays } from "lucide-react";

type Mood = "excited" | "relaxed" | "neutral" | "nervous" | "frustrated";
type DiaryEntry = { date?: unknown; mood?: unknown };
type MoodChartPoint = { name: string; emoji: string; value: number; color: string };
type TooltipProps = { active?: boolean; payload?: Array<{ value?: unknown; payload?: MoodChartPoint }> };
type XAxisTickProps = { x?: number; y?: number; payload?: { value?: unknown } };

const MOODS = [
  { id: "excited", label: "Begeistert", emoji: "🤩", color: "#10b981" },
  { id: "relaxed", label: "Entspannt", emoji: "😌", color: "#60a5fa" },
  { id: "neutral", label: "Neutral", emoji: "😐", color: "#9ca3af" },
  { id: "nervous", label: "Nervös", emoji: "😬", color: "#eab308" },
  { id: "frustrated", label: "Frustriert", emoji: "😫", color: "#f87171" },
];

export function DateDiaryStatsWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [data, setData] = useState<MoodChartPoint[]>([]);
  const [currentMonth, setCurrentMonth] = useState("");

  useEffect(() => {
    const saved = klarStorage.getItem("klar_post_date_diary");
    let diaries: DiaryEntry[] = [];
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        diaries = Array.isArray(parsed)
          ? parsed.filter((entry): entry is DiaryEntry => !!entry && typeof entry === 'object')
          : [];
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    // Get current month string
    const now = new Date();
    const monthFormatter = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
    setCurrentMonth(monthFormatter.format(now));

    const currentMonthPrefix = now.toISOString().substring(0, 7); // YYYY-MM

    // Filter diaries for this month
    const thisMonthDiaries = diaries.filter(d => typeof d.date === 'string' && d.date.startsWith(currentMonthPrefix));

    // Aggregate by mood
    const aggregated: Record<string, number> = {
      excited: 0,
      relaxed: 0,
      neutral: 0,
      nervous: 0,
      frustrated: 0
    };

    thisMonthDiaries.forEach(d => {
      if (typeof d.mood === 'string' && d.mood in aggregated) {
        const mood = d.mood as Mood;
        aggregated[mood] = (aggregated[mood] || 0) + 1;
      }
    });

    const hasData = Object.values(aggregated).some(v => v > 0);

    const chartData = MOODS.map(m => ({
      name: m.label,
      emoji: m.emoji,
      value: hasData ? (aggregated[m.id as Mood] ?? 0) : 0,
      color: m.color
    }));

    setData(chartData);
  }, []);

  const CustomTooltip = ({ active, payload }: TooltipProps) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0]?.payload;
      if (!dataPoint) return null;
      return (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-3 rounded-xl shadow-lg">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

          <p className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>{dataPoint.emoji}</span> {dataPoint.name}
          </p>
          <p className="text-xs text-stone-500 mt-1">
            {payload[0]?.value ?? 0} Dates diesen Monat
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomXAxisTick = ({ x = 0, y = 0, payload }: XAxisTickProps) => {
    const dataPoint = data.find(d => d.name === String(payload?.value ?? ''));
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize="16px">
          {dataPoint?.emoji}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between w-full mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Activity size={20} className="text-teal-500" />
            Stimmungs-Trend
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
            <CalendarDays size={12} /> {currentMonth}
          </p>
        </div>
      </div>

      <div className="flex-1 w-full h-[180px] min-h-[180px] mt-2 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-stone-800" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={<CustomXAxisTick />}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
