import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, MapPin } from 'lucide-react';
import { allProfiles } from '../data';

interface TrendingInterestsWidgetProps {
  location: string | null;
}

export function TrendingInterestsWidget({ location }: TrendingInterestsWidgetProps) {
  const chartData = useMemo(() => {
    const filteredProfiles = location
      ? allProfiles.filter(p => p.location === location)
      : allProfiles;

    const interestCounts: Record<string, number> = {};

    filteredProfiles.forEach(profile => {
      profile.interests.forEach(interest => {
        interestCounts[interest] = (interestCounts[interest] || 0) + 1;
      });
    });

    const sortedData = Object.entries(interestCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5 interests

    return sortedData;
  }, [location]);

  if (chartData.length === 0) return null;

  const maxValue = Math.max(...chartData.map(d => d.count));

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 dark:bg-brand-light/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={16} className="text-brand dark:text-brand-light" />
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
          Dating-Puls
        </h3>
        {location && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 px-2 py-0.5 rounded-full">
            <MapPin size={10} />
            {location}
          </span>
        )}
      </div>
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-4 font-medium">
        Diese Interessen sind <span className="text-brand dark:text-brand-light">heute</span> in der Community besonders im Trend.
      </p>

      <div className="flex-1 w-full min-h-[140px] -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, maxValue]} />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#78716c', fontSize: 11 }}
              width={70}
            />
            <Tooltip
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
              itemStyle={{ color: '#E05B46', fontWeight: 500 }}
              formatter={(value: unknown) => [`${value} Profile`, '']}
              labelStyle={{ display: 'none' }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#E05B46' : '#E05B4680'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
