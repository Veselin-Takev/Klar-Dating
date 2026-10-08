import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Smile, Frown, Meh, Heart, Zap, Coffee, CheckCircle2 } from "lucide-react";
import { motion} from "motion/react";

export function DailyMoodCheckInWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [mood, setMood] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const saved = klarStorage.getItem("klar_daily_mood");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          setMood(parsed.mood);
          setSubmitted(true);
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const handleMoodSelect = (selectedMood: string) => {
    setMood(selectedMood);
    const today = new Date().toISOString().split('T')[0];
    klarStorage.setItem("klar_daily_mood", JSON.stringify({ date: today, mood: selectedMood }));
    setSubmitted(true);
  };

  const moods = [
    { id: "motiviert", icon: <Zap size={24} className="text-amber-500" />, label: "Motiviert" },
    { id: "gelassen", icon: <Coffee size={24} className="text-blue-500" />, label: "Gelassen" },
    { id: "unsicher", icon: <Meh size={24} className="text-stone-500" />, label: "Unsicher" },
    { id: "gestresst", icon: <Frown size={24} className="text-rose-500" />, label: "Gestresst" },
    { id: "romantisch", icon: <Heart size={24} className="text-pink-500" />, label: "Romantisch" }
  ];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm h-full flex flex-col">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="mb-4">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Smile size={18} className="text-brand dark:text-brand-light" />
          Mood Check-in
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Wie fühlst du dich heute in Bezug auf Dating?
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {!submitted ? (
          <div className="flex flex-wrap gap-2 justify-center">
            {moods.map(m => (
              <button
                key={m.id}
                onClick={() => handleMoodSelect(m.id)}
                className="flex flex-col items-center justify-center gap-2 p-2 rounded-xl border border-stone-100 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors w-[72px] h-[72px]"
              >
                {m.icon}
                <span className="text-[10px] font-medium text-stone-600 dark:text-stone-300">{m.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center text-center py-2"
          >
            <div className="bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light p-3 rounded-full mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-1">
              Check-in gespeichert!
            </h4>
            <p className="text-xs text-stone-600 dark:text-stone-400">
              Deine Stimmung: <span className="font-medium capitalize">{mood}</span>.
              <br />
              Schau im Coach-Bereich für deine personalisierten Tipps vorbei!
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-3 text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 underline"
            >
              Stimmung ändern
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
