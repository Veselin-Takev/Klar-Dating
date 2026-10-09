import { useState, useEffect } from "react";
import { Moon, Square, Timer } from "lucide-react";
import { motion } from "motion/react";

export function DatingFocusModeWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 1 hour in seconds

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setTimeLeft(60 * 60);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const toggleFocusMode = () => {
    const nextState = !isActive;
    setIsActive(nextState);

    if (!nextState) {
      setTimeLeft(60 * 60);
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    } else {
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`border rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 transition-colors duration-500 ${isActive ? 'bg-indigo-900 border-indigo-800 text-indigo-50' : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700'}`}>
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className={`font-semibold flex items-center gap-2 ${isActive ? 'text-indigo-50' : 'text-stone-900 dark:text-stone-100'}`}>
            <Moon size={20} className={isActive ? 'text-indigo-300' : 'text-indigo-500'} />
            Dating-Fokus-Modus
          </h3>
          <p className={`text-xs mt-1 ${isActive ? 'text-indigo-200' : 'text-stone-500 dark:text-stone-400'}`}>
            Eine Stunde ungestört Profil pflegen & chatten
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-4">
        {isActive ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center text-center"
          >
            <div className="text-4xl font-serif font-medium tracking-widest mb-2 text-indigo-100">
              {formatTime(timeLeft)}
            </div>
            <p className="text-sm text-indigo-300 mb-6 max-w-[200px]">
              App-Benachrichtigungen sind pausiert. Vollbildmodus aktiv zur Minimierung von Ablenkungen.
            </p>
            <button
              onClick={toggleFocusMode}
              className="flex items-center gap-2 bg-indigo-800 hover:bg-indigo-700 text-white py-2 px-6 rounded-full text-sm font-medium transition-colors"
            >
              <Square size={16} /> Beenden
            </button>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <button
              onClick={toggleFocusMode}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 py-4 px-6 rounded-2xl text-sm font-medium transition-colors"
            >
              <Timer size={18} />
              60 Min. Fokus starten
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
