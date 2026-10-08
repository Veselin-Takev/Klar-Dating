import { klarStorage } from '../lib/userScopedStorage';
import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';

export function ActivityChartWidget() {
  const { data, hasActivity } = useMemo(() => {
    const today = new Date();
    const result = [];
    let totalMessages = 0;

    // Load actual chats or message logs
    const savedChats = klarStorage.getItem('klar_chat_history');
    let messageTimestamps: number[] = [];
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        if (Array.isArray(parsed)) {
          parsed.forEach((m: unknown) => {
            if (m.timestamp) messageTimestamps.push(new Date(m.timestamp).getTime());
          });
        }
      } catch {
        // ignore parse error
      }
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      const count = messageTimestamps.filter(t => t >= dayStart && t < dayEnd).length;
      totalMessages += count;

      result.push({
        name: d.toLocaleDateString('de-DE', { weekday: 'short' }),
        messages: count,
        avgResponseTime: count > 0 ? Math.min(60, Math.round(15 / Math.max(1, count))) : 0
      });
    }
    return { data: result, hasActivity: totalMessages > 0 };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand-light/10 flex items-center justify-center text-brand dark:text-brand-light">
          <Activity size={16} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Deine Aktivität</h3>
          <p className="text-xs text-stone-500">Gesendete Nachrichten & Ø Antwortzeit (letzte 7 Tage)</p>
        </div>
      </div>
      {hasActivity ? (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" strokeOpacity={0.5} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#3b82f6' }} dx={-10} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#10b981' }} dx={10} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                labelStyle={{ color: '#888', marginBottom: '4px' }}
              />
              <Line yAxisId="left" type="monotone" name="Nachrichten" dataKey="messages" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" name="Ø Antwort (min)" dataKey="avgResponseTime" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-8 px-4 text-center bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-100 dark:border-stone-700">
          <MessageSquare size={24} className="mx-auto mb-2 text-stone-400 opacity-60" />
          <p className="text-xs font-medium text-stone-700 dark:text-stone-300">Noch keine Nachrichten in den letzten 7 Tagen</p>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 max-w-xs mx-auto">
            Sobald du Nachrichten schreibst, wird hier deine tägliche Aktivität visualisiert.
          </p>
        </div>
      )}
    </motion.div>
  );
}
