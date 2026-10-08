import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Activity, HeartPulse } from "lucide-react";
import { motion } from "motion/react";

export function DatingHealthAnalysisWidget() {
  const [healthData, setHealthData] = useState({
    positive: 0,
    reflective: 0,
    stressful: 0,
    total: 0
  });
  const [topActivities, setTopActivities] = useState<string[]>([]);

  useEffect(() => {
    const journalsRaw = klarStorage.getItem("klar_dating_journals");
    const parsed: unknown = journalsRaw ? JSON.parse(journalsRaw) : [];
    const journals = Array.isArray(parsed) ? parsed.filter((value): value is { note?: unknown; vibes?: unknown; mood?: unknown } =>
      !!value && typeof value === 'object' && !Array.isArray(value)
    ) : [];

    let positive = 0;
    let reflective = 0;
    let stressful = 0;

    const positiveWords = ["😊", "😍", "🤩", "🥰", "🥳", "Aufregend", "Romantisch", "Freundschaftlich", "Positiv"];
    const reflectiveWords = ["🤔", "🤯", "Tiefgründig", "Reflektierend"];
    const stressfulWords = ["😬", "🥱", "🥶", "Unangenehm", "Oberflächlich", "Langweilig", "Stressig"];

    let totalMatch = 0;
    const activityScores: Record<string, number> = {};

    journals.forEach((j) => {
      const note = typeof j.note === 'string' ? j.note : '';
      const vibes = Array.isArray(j.vibes) ? j.vibes.filter((v: unknown): v is string => typeof v === 'string') : [];
      const mood = typeof j.mood === 'string' ? j.mood : '';
      const text = note + " " + vibes.join(" ") + " " + mood;

      let isPositive = false;
      let found = false;
      positiveWords.forEach(w => { if (text.includes(w)) { positive++; found = true; isPositive = true; } });
      reflectiveWords.forEach(w => { if (text.includes(w)) { reflective++; found = true; } });
      stressfulWords.forEach(w => { if (text.includes(w)) { stressful++; found = true; } });

      if (mood === 'excited' || mood === 'relaxed') {
        positive++; found = true; isPositive = true;
      }
      if (mood === 'nervous' || mood === 'frustrated') {
        stressful++; found = true;
      }
      if (mood === 'neutral') {
        reflective++; found = true;
      }

      if (found) totalMatch++;

      // Track activities for positive experiences
      if (isPositive && note) {
        const activityMatch = note.match(/Aktivität:\s*([^.]+)\./);
        if (activityMatch && activityMatch[1]) {
           const act = activityMatch[1].trim();
           if (act && act !== "null") {
              activityScores[act] = (activityScores[act] || 0) + 1;
           }
        }
      }
    });

    if (totalMatch === 0) {
      positive = 0;
      reflective = 0;
      stressful = 0;
    }

    setHealthData({
      positive,
      reflective,
      stressful,
      total: positive + reflective + stressful
    });

    const sortedActivities = Object.entries(activityScores)
       .sort((a, b) => b[1] - a[1])
       .map(entry => entry[0])
       .slice(0, 2);
    setTopActivities(sortedActivities);
  }, []);

  const getPercentage = (val: number) => {
    if (healthData.total === 0) return 0;
    return Math.round((val / healthData.total) * 100);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm mt-6">
      <div className="flex items-center gap-2 mb-6">
        <div className="bg-rose-50 dark:bg-rose-900/30 p-2 rounded-xl text-rose-500">
          <HeartPulse size={18} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Dating-Gesundheit</h3>
          <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Stimmungs-Analyse</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Positiv & Euphorisch</span>
            <span className="text-stone-500">{getPercentage(healthData.positive)}%</span>
          </div>
          <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getPercentage(healthData.positive)}%` }}
              transition={{ duration: 1 }}
              className="h-full bg-emerald-500 rounded-full"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">Reflektierend & Tiefgründig</span>
            <span className="text-stone-500">{getPercentage(healthData.reflective)}%</span>
          </div>
          <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getPercentage(healthData.reflective)}%` }}
              transition={{ duration: 1, delay: 0.2 }}
              className="h-full bg-indigo-500 rounded-full"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-medium text-amber-600 dark:text-amber-400">Stressig oder Langweilig</span>
            <span className="text-stone-500">{getPercentage(healthData.stressful)}%</span>
          </div>
          <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${getPercentage(healthData.stressful)}%` }}
              transition={{ duration: 1, delay: 0.4 }}
              className="h-full bg-amber-500 rounded-full"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700 space-y-3">
        <p className="text-xs text-stone-600 dark:text-stone-400 flex items-start gap-2">
          <Activity size={14} className="text-rose-400 mt-0.5 shrink-0" />
          <span>
            {getPercentage(healthData.stressful) > 40
              ? "Dein Dating-Leben ist aktuell eher stressig. Mach vielleicht eine kleine Pause, um aufzutanken."
              : getPercentage(healthData.positive) > 50
                ? "Fantastisch! Du hast überwiegend positive Erlebnisse. Genieße die Zeit."
               : "Eine gute Balance. Nutze die reflektierenden Momente, um herauszufinden, was du wirklich suchst."}
          </span>
        </p>

        {topActivities.length > 0 && (
          <div className="pt-3 border-t border-stone-200 dark:border-stone-700">
             <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
               Top Aktivitäten (Vibe)
             </p>
             <div className="flex flex-wrap gap-2">
               {topActivities.map((act, i) => (
                 <span key={i} className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                   {act}
                 </span>
               ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
