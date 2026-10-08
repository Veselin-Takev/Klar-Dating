import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Sparkles, MessageCircle, ChevronRight, Activity } from "lucide-react";
import { motion } from "motion/react";
import { melde } from "../lib/fehler";

type Insight = {
  title: string;
  description: string;
  action: string;
};

export function ReflectionInsightDashboard() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
      setIsLoading(true);
      try {
        const savedDates = klarStorage.getItem('klar_dating_history');
        const dates = savedDates ? JSON.parse(savedDates) : [];
        if (dates.length === 0) {
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/reflection-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: dates.slice(-7) })
        });

        if (res.ok) {
          const data = await res.text().then(text => text ? JSON.parse(text) : {});
          if (data.insights) setInsights(data.insights);
        }
      } catch (e) {
        melde("ReflectionInsightDashboard", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInsights();
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-500">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Reflection Insights</h3>
          <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Kommunikationstipps</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 hide-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-6 h-full">
            <Activity className=" text-indigo-500 mb-2" size={24} />
            <p className="text-xs text-stone-500 ">Analysiere Tagebuch...</p>
          </div>
        ) : insights.length > 0 ? (
          insights.map((insight, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-stone-50 dark:bg-stone-800/50 p-4 rounded-2xl border border-stone-100 dark:border-stone-700"
            >
              <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-1 flex items-center gap-1.5">
                <MessageCircle size={14} className="text-indigo-500" />
                {insight.title}
              </h4>
              <p className="text-xs text-stone-600 dark:text-stone-400 mb-3 leading-relaxed">
                {insight.description}
              </p>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-3 py-2 rounded-xl text-xs font-medium flex items-start gap-2">
                <ChevronRight size={14} className="mt-0.5 shrink-0" />
                <span>{insight.action}</span>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-8 text-stone-500 dark:text-stone-400 text-sm">
            Nicht genug Daten für Insights.
          </div>
        )}
      </div>
    </div>
  );
}
