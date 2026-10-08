import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity } from 'lucide-react';

export function DateSuccessRadarWidget() {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<unknown[]>([]);

  useEffect(() => {
    const saved = klarStorage.getItem('klar_reflection_logs');
    const logs = saved ? JSON.parse(saved) : [];

    const tagsThisWeek: Record<string, number> = {};
    const tagsLastMonth: Record<string, number> = {};

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    logs.forEach((log: unknown) => {
      const logDate = new Date(log.date);
      if (log.tags) {
        log.tags.forEach((tag: string) => {
          if (logDate >= oneWeekAgo) {
            tagsThisWeek[tag] = (tagsThisWeek[tag] || 0) + 1;
          } else if (logDate >= oneMonthAgo && logDate < oneWeekAgo) {
            tagsLastMonth[tag] = (tagsLastMonth[tag] || 0) + 1;
          }
        });
      }
    });

    const allTags = Array.from(new Set([...Object.keys(tagsThisWeek), ...Object.keys(tagsLastMonth), 'Humor', 'Tiefe', 'Leichtigkeit', 'Respekt']));

    const radarData = allTags.slice(0, 6).map(tag => ({
      subject: tag,
      A: (tagsThisWeek[tag] || 0) * 20 + 80,
      B: (tagsLastMonth[tag] || 0) * 20 + 70,
      fullMark: 150
    }));

    setData(radarData);
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-emerald-500" />
          <h3 className="font-semibold text-stone-800 dark:text-stone-200">Erfolgs-Radar</h3>
        </div>
        <span className="text-xs text-stone-500">{expanded ? 'Schließen' : 'Details'}</span>
      </div>

      {!expanded ? (
        <p className="text-sm text-stone-600 dark:text-stone-400">Klicke für eine detaillierte Analyse deiner Stimmungstags (Letzte Woche vs. Vormonat).</p>
      ) : (
        <div className="h-64 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
              <Tooltip />
              <Radar name="Diese Woche" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
              <Radar name="Vormonat" dataKey="B" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-full"></div>Diese Woche</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 rounded-full opacity-50"></div>Vormonat</span>
          </div>
        </div>
      )}
    </div>
  );
}
