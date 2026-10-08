import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// P2-BEFUND, NICHT BEHOBEN: Dieses Widget erzeugt Daten, die es nicht gibt.
// Angezeigte Verläufe, Werte und Trends sind erfunden — für die bedienende
// Person aber nicht von echten zu unterscheiden.
//
// Nicht stillschweigend entfernt, weil das eine Produktentscheidung ist:
// entweder echte Daten anbinden oder das Widget streichen. Ein drittes
// „Demodaten mit Hinweis" gibt es nicht — ein Hinweis, den man wegklickt,
// macht die Zahl nicht wahr.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { Award, Flame, Target } from "lucide-react";
import { motion } from "motion/react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function WheelStatsWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [completedCount, setCompletedCount] = useState(0);
  const [chartData, setChartData] = useState<{date: string, count: number}[]>([]);

  const loadStats = () => {
    setUiError(null);
    try {
      const savedCompleted = JSON.parse(klarStorage.getItem('klar_wheel_completed_tasks') || '[]') as number[];
      const now = Date.now();
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      const recentCompleted = savedCompleted.filter(timestamp => timestamp > thirtyDaysAgo);

      setCompletedCount(recentCompleted.length);

      // Prepare data for line chart
      const data: Record<string, number> = {};

      // Initialize last 30 days with 0
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        data[dateStr] = 0;
      }

      recentCompleted.forEach(timestamp => {
        const d = new Date(timestamp);
        const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        if (data[dateStr] !== undefined) {
          data[dateStr]++;
        }
      });

      const formattedData = Object.keys(data).map(key => ({
        date: key,
        count: data[key] || 0
      }));

      setChartData(formattedData);

    } catch (e) {
      console.warn("Failed to load wheel stats", e);
      setUiError("Fehler beim Laden der Glücksrad-Statistiken.");
    }
  };

  useEffect(() => {
    loadStats();
    window.addEventListener('wheelTaskCompleted', loadStats);
    return () => window.removeEventListener('wheelTaskCompleted', loadStats);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm"
    >
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${completedCount > 0 ? 'bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}`}>
            {completedCount > 0 ? <Award size={24} /> : <Target size={24} />}
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 leading-tight">Glücksrad-Bilanz</h3>
            <p className="text-xs text-stone-500">Erfolge (30 Tage)</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1 justify-end">
            {completedCount} {completedCount > 0 && <Flame size={20} className="text-orange-500" />}
          </span>
          <span className="text-[10px] text-stone-400 font-medium uppercase tracking-wider">Erledigt</span>
        </div>
      </div>

      {completedCount > 0 ? (
        <div className="h-32 mt-4 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-stone-200 dark:text-stone-800" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickMargin={8}
                axisLine={false}
                tickLine={false}
                minTickGap={20}
                stroke="currentColor"
                className="text-stone-400"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                stroke="currentColor"
                className="text-stone-400"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                  backgroundColor: 'var(--tw-colors-white)',
                  color: 'var(--tw-colors-stone-900)'
                }}
                labelStyle={{ color: '#666', marginBottom: '4px' }}
                formatter={(value: unknown) => [`${value} Aufgaben`, 'Erledigt']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#E05B46"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 2 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-6 px-4 text-center bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 mt-4">
          <Target size={24} className="mx-auto mb-2 text-stone-400 opacity-60" />
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">Noch keine Aufgaben abgeschlossen</p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
            Drehe das Impulsrad für deine erste Tagesaufgabe und starte deine Serie!
          </p>
        </div>
      )}
    </motion.div>
  );
}
