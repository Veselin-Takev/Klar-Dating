import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Target } from "lucide-react";
import { motion } from "motion/react";

export function DailyGoalRingsWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [progress, setProgress] = useState({ kontakte: 0, messages: 0, dates: 0 });
  const goals = { kontakte: 20, messages: 5, dates: 1 };

  useEffect(() => {
    // Simulate loading progress from local storage or backend
    const saved = klarStorage.getItem("klar_daily_goals");
    const today = new Date().toDateString();

    let currentProgress = { kontakte: 12, messages: 2, dates: 0, date: today };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          currentProgress = parsed;
        } else {
          // Reset for new day, but for the sake of demo, let's keep some numbers
          currentProgress = { kontakte: 8, messages: 1, dates: 0, date: today };
          klarStorage.setItem("klar_daily_goals", JSON.stringify(currentProgress));
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    } else {
      klarStorage.setItem("klar_daily_goals", JSON.stringify(currentProgress));
    }

    // Delay animation for visual effect on mount
    const timer = setTimeout(() => {
      setProgress({
        kontakte: currentProgress.kontakte,
        messages: currentProgress.messages,
        dates: currentProgress.dates
      });
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  // Use tailwind hex colors that verbindung light/dark modes well
  const rings = [
    { id: "kontakte", label: "Profile checken", color: "#f43f5e", percent: Math.min((progress.kontakte / goals.kontakte) * 100, 100), radius: 56, value: progress.kontakte, max: goals.kontakte }, // rose-500
    { id: "messages", label: "Nachrichten", color: "#8b5cf6", percent: Math.min((progress.messages / goals.messages) * 100, 100), radius: 40, value: progress.messages, max: goals.messages }, // violet-500
    { id: "dates", label: "Dates planen", color: "#10b981", percent: Math.min((progress.dates / goals.dates) * 100, 100), radius: 24, value: progress.dates, max: goals.dates } // emerald-500
  ];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col items-center relative z-10 overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between w-full mb-2">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Target size={20} className="text-rose-500" />
            Tagesziele
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Bleib aktiv & fokussiert
          </p>
        </div>
      </div>

      <div className="relative w-36 h-36 flex items-center justify-center my-4">
        <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
          {rings.map((ring, idx) => {
            const circumference = 2 * Math.PI * ring.radius;
            const strokeDashoffset = circumference - (ring.percent / 100) * circumference;
            return (
              <g key={ring.id}>
                {/* Background ring */}
                <circle
                  cx="72"
                  cy="72"
                  r={ring.radius}
                  fill="transparent"
                  stroke={ring.color}
                  strokeWidth="12"
                  className="opacity-20"
                  strokeLinecap="round"
                />
                {/* Progress ring */}
                <motion.circle
                  cx="72"
                  cy="72"
                  r={ring.radius}
                  fill="transparent"
                  stroke={ring.color}
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.5, delay: 0.1 + idx * 0.15, ease: "easeOut" }}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
        </svg>

        {/* Inner checkmark icon when all goals complete */}
        <div className="absolute inset-0 flex items-center justify-center rotate-90">
          {progress.kontakte >= goals.kontakte && progress.messages >= goals.messages && progress.dates >= goals.dates ? (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <Target size={16} className="text-stone-400" />
            </motion.div>
          ) : null}
        </div>
      </div>

      <div className="w-full space-y-2.5 mt-auto pt-2">
        {rings.map((ring) => (
          <div key={ring.id} className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: ring.color }}></div>
              <span className="text-stone-600 dark:text-stone-400">{ring.label}</span>
            </div>
            <span className="text-stone-900 dark:text-stone-100 flex items-center gap-1">
              <span className={ring.value >= ring.max ? "text-emerald-500 font-bold" : ""}>{ring.value}</span>
              <span className="text-stone-400 font-normal">/ {ring.max}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
