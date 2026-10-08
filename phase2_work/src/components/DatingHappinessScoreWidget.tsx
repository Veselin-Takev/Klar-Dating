import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { HeartPulse, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface DateHistoryEntry {
  date: string;
  rating?: number;
}

interface Reflection {
  date: string;
}

export function DatingHappinessScoreWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [score, setScore] = useState<number>(0);
  const [trend, setTrend] = useState<number>(0);
  const [details, setDetails] = useState({
    positiveDates: 0,
    totalDates: 0,
    reflections: 0
  });

  useEffect(() => {
    const calculateScore = () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      let history: DateHistoryEntry[] = [];
      let reflections: Reflection[] = [];
      let moods: {date: string; mood: number; emoji: string}[] = [];

      try {
        const historySaved = klarStorage.getItem("klar_date_history");
        if (historySaved) history = JSON.parse(historySaved);

        const reflectionsSaved = klarStorage.getItem("klar_date_reflections");
        if (reflectionsSaved) reflections = JSON.parse(reflectionsSaved);

        const moodsSaved = klarStorage.getItem("klar_mood_history");
        if (moodsSaved) moods = JSON.parse(moodsSaved);
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }

      // Current 30 days
      const currentHistory = history.filter(h => new Date(h.date) >= thirtyDaysAgo);
      const currentReflections = reflections.filter(r => new Date(r.date) >= thirtyDaysAgo);

      const parseDateStr = (dStr: string) => {
        const [day, month, year] = dStr.split('.');
        return new Date(parseInt(year || "0"), parseInt(month || "1") - 1, parseInt(day || "1"));
      };
      const currentMoods = moods.filter(m => parseDateStr(m.date) >= thirtyDaysAgo);

      // Previous 30 days (for trend)
      const prevHistory = history.filter(h => new Date(h.date) >= sixtyDaysAgo && new Date(h.date) < thirtyDaysAgo);
      const prevReflections = reflections.filter(r => new Date(r.date) >= sixtyDaysAgo && new Date(r.date) < thirtyDaysAgo);
      const prevMoods = moods.filter(m => parseDateStr(m.date) >= sixtyDaysAgo && parseDateStr(m.date) < thirtyDaysAgo);

      const computePeriodScore = (periodHistory: DateHistoryEntry[], periodReflections: Reflection[], periodMoods: {mood: number}[]) => {
        let periodScore = 50; // Base score

        // Impact from ratings
        if (periodHistory.length > 0) {
          let ratingSum = 0;
          let ratingCount = 0;
          periodHistory.forEach(h => {
            if (h.rating !== undefined) {
              ratingSum += h.rating;
              ratingCount++;
            }
          });

          if (ratingCount > 0) {
            const avgRating = ratingSum / ratingCount;
            // 5 -> +30, 1 -> -30
            periodScore += (avgRating - 3) * 15;
          }
        }

        // Impact from mood tags
        if (periodMoods.length > 0) {
          let moodSum = 0;
          periodMoods.forEach(m => { moodSum += m.mood; });
          const avgMood = moodSum / periodMoods.length;
          // mood 1-5 => 5 -> +15, 1 -> -15
          periodScore += (avgMood - 3) * 7.5;
        }

        // Impact from reflections (mindfulness bonus)
        const reflectionBonus = Math.min(periodReflections.length * 5, 20); // Max 20 points
        periodScore += reflectionBonus;

        return Math.max(0, Math.min(100, Math.round(periodScore)));
      };

      const currentScore = computePeriodScore(currentHistory, currentReflections, currentMoods);
      const previousScore = computePeriodScore(prevHistory, prevReflections, prevMoods);

      setScore(currentScore);
      setTrend(currentScore - previousScore);

      let posDates = 0;
      currentHistory.forEach(h => {
        if (h.rating && h.rating >= 4) posDates++;
      });

      setDetails({
        positiveDates: posDates,
        totalDates: currentHistory.length,
        reflections: currentReflections.length
      });
    };

    calculateScore();
  }, []);

  // Determine color and message based on score
  let colorClass = "text-emerald-500";
  let bgClass = "bg-emerald-50 dark:bg-emerald-500/10";
  let borderClass = "border-emerald-200 dark:border-emerald-800/50";
  let message = "Dein Dating-Leben blüht auf! Mach weiter so.";

  if (score < 40) {
    colorClass = "text-rose-500";
    bgClass = "bg-rose-50 dark:bg-rose-500/10";
    borderClass = "border-rose-200 dark:border-rose-800/50";
    message = "Dating kann anstrengend sein. Gönn dir bei Bedarf eine Pause.";
  } else if (score < 70) {
    colorClass = "text-amber-500";
    bgClass = "bg-amber-50 dark:bg-amber-500/10";
    borderClass = "border-amber-200 dark:border-amber-800/50";
    message = "Solide Erfahrungen. Bleib achtsam und reflektiere weiter.";
  }

  // Calculate SVG circle properties
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative overflow-hidden`}>
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <HeartPulse className={colorClass} size={20} />
            Dating-Glück-Score
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 flex items-center gap-1">
            Letzte 30 Tage
            {trend !== 0 && (
              <span className={`flex items-center ${trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {trend > 0 ? <TrendingUp size={12} className="ml-1 mr-0.5" /> : null}
                {trend > 0 ? '+' : ''}{trend}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-32 h-32 flex items-center justify-center mb-6">
          {/* Background Circle */}
          <svg className="w-full h-full transform -rotate-90 absolute inset-0">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-stone-100 dark:text-stone-800"
            />
            {/* Progress Circle */}
            <motion.circle
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              cx="64"
              cy="64"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeLinecap="round"
              className={colorClass}
            />
          </svg>

          <div className="flex flex-col items-center z-10">
            <span className={`text-4xl font-serif font-medium ${colorClass}`}>
              {score}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400 mt-1">
              Punkte
            </span>
          </div>
        </div>

        <div className={`w-full p-4 rounded-2xl ${bgClass} ${borderClass} border flex items-start gap-3 mb-4`}>
          {score >= 70 ? <Sparkles className={colorClass} size={18} /> : <AlertCircle className={colorClass} size={18} />}
          <p className={`text-sm text-stone-800 dark:text-stone-200 leading-snug`}>
            {message}
          </p>
        </div>

        <div className="w-full grid grid-cols-2 gap-3 mt-auto">
          <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-medium text-stone-900 dark:text-stone-100">{details.positiveDates}</span>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mt-1">Gute Dates</span>
          </div>
          <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-medium text-stone-900 dark:text-stone-100">{details.reflections}</span>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mt-1">Reflexionen</span>
          </div>
        </div>
      </div>
    </div>
  );
}
