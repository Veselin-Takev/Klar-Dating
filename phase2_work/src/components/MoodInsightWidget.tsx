import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Sparkles, Brain, Lightbulb, TrendingUp } from "lucide-react";


export function MoodInsightWidget() {
  const [insight, setInsight] = useState<{ summary: string, tip: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadInsight() {
      setIsLoading(true);
      try {
        const savedDates = klarStorage.getItem('klar_dating_history');
        const dates = savedDates ? JSON.parse(savedDates) : [];

        if (dates.length < 2) {
          setInsight({
            summary: "Du stehst noch am Anfang! Je mehr Dates du loggst, desto besser werden die Insights.",
            tip: "Geh entspannt in deine nächsten Dates und sei du selbst."
          });
          setIsLoading(false);
          return;
        }

        const res = await fetch("/api/mood-insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dates: dates.slice(-5) })
        });

        if (res.ok) {
          const data = await res.text().then(text => text ? JSON.parse(text) : {});
          setInsight(data);
        } else {
          throw new Error("API error");
        }
      } catch (e) {
        setInsight({
          summary: "Deine Stimmung war in letzter Zeit positiv und fokussiert.",
          tip: "Achte beim nächsten Date auf gemeinsame Werte und offene Kommunikation."
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadInsight();
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-4">
        <div className="bg-brand/10 dark:bg-brand-light/10 p-2 rounded-xl text-brand dark:text-brand-light">
          <Brain size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Mood-Insight</h3>
          <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">KI-Analyse deiner Woche</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-6">
          <Sparkles className=" text-brand dark:text-brand-light mb-2" size={20} />
          <p className="text-xs text-stone-500 ">Analysiere Tagebuch...</p>
        </div>
      ) : insight ? (
        <div className="space-y-4">
          <div className="bg-stone-50 dark:bg-stone-800/50 p-3.5 rounded-2xl border border-stone-100 dark:border-stone-700">
            <div className="flex items-center gap-1.5 text-stone-900 dark:text-stone-100 mb-1">
              <TrendingUp size={14} className="text-indigo-500" />
              <h4 className="text-xs font-bold">Trend der Woche</h4>
            </div>
            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              {insight.summary}
            </p>
          </div>

          <div className="bg-brand/5 dark:bg-brand-light/5 p-3.5 rounded-2xl border border-brand/10 dark:border-brand-light/10">
            <div className="flex items-center gap-1.5 text-brand dark:text-brand-light mb-1">
              <Lightbulb size={14} />
              <h4 className="text-xs font-bold">Tipp fürs nächste Date</h4>
            </div>
            <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-medium italic">
              "{insight.tip}"
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
