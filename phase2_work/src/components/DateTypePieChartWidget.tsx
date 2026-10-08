import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

export function DateTypePieChartWidget() {
  const data = [
    { name: "Erstes Date", value: 12 },
    { name: "Kennenlernen", value: 8 },
    { name: "Aktiv-Date", value: 5 },
    { name: "Deep Talk", value: 4 },
  ];

  const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981'];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <PieChartIcon size={18} className="text-brand dark:text-brand-light" />
            Deine Date-Typen
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Verteilung deiner Dates
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-[140px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={5}
              dataKey="value"
              animationDuration={1500}
            >
              {data.map(( _, index ) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              itemStyle={{ fontSize: '12px', fontWeight: 500 }}
              formatter={(value: unknown) => [`${value} Dates`, 'Anzahl']}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
