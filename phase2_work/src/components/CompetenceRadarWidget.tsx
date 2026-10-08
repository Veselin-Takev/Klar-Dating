import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Target } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

type Competence = {
  subject: string;
  A: number;
};

export function CompetenceRadarWidget() {
  const [data, setData] = useState<Competence[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const savedDates = klarStorage.getItem('klar_dating_history');
        const dates = savedDates ? JSON.parse(savedDates) : [];
        if (dates.length === 0) {
          setData([
            { subject: 'Authentizität', A: 50 },
            { subject: 'Kommunikation', A: 50 },
            { subject: 'Grenzsetzung', A: 50 },
            { subject: 'Emotionale Offenheit', A: 50 }
          ]);
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/competence-radar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: dates.slice(-10) })
        });

        if (res.ok) {
          const json = await res.text().then(text => text ? JSON.parse(text) : {});
          if (json.competencies) {
            setData(json.competencies);
          }
        }
      } catch (e) {
        melde("CompetenceRadarWidget", e);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-xl text-emerald-500">
          <Target size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Dating-Kompetenzen</h3>
          <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Entwicklung</p>
        </div>
      </div>

      <div className="flex-1 min-h-[200px] relative mt-2 -ml-2 -mr-2">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-stone-500 ">Lade Radar...</span>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: "easeOut" }} className="w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
              <PolarGrid stroke="currentColor" className="text-stone-200 dark:text-stone-700" strokeDasharray="3 3" />
              <PolarAngleAxis className="text-stone-500 dark:text-stone-400"
                dataKey="subject"
                tick={{ fill: 'currentColor', fontSize: 10, fontWeight: 500 }}
              />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}
              />
              <Radar
                name="Kompetenz"
                dataKey="A"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                animationDuration={2000}
              />
            </RadarChart>
          </ResponsiveContainer>
          </motion.div>
        )}
      </div>
    </div>
  );
}
