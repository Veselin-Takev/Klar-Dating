import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smile, CalendarDays, Plus, X, Filter } from "lucide-react";

type Mood = "excited" | "relaxed" | "neutral" | "nervous" | "frustrated";

const MOODS: { id: Mood; label: string; emoji: string; color: string }[] = [
  { id: "excited", label: "Begeistert", emoji: "🤩", color: "bg-emerald-500" },
  { id: "relaxed", label: "Entspannt", emoji: "😌", color: "bg-blue-400" },
  { id: "neutral", label: "Neutral", emoji: "😐", color: "bg-stone-400" },
  { id: "nervous", label: "Nervös", emoji: "😬", color: "bg-yellow-500" },
  { id: "frustrated", label: "Frustriert", emoji: "😫", color: "bg-red-400" },
];

interface MoodEntry {
  date: string;
  mood: Mood;
}

export function DatingMoodTrackerWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [isLogging, setIsLogging] = useState(false);
  const [filter, setFilter] = useState<Mood | "all">("all");
  const today = new Date().toISOString().split('T')[0] || '';

  useEffect(() => {
    const saved = klarStorage.getItem('klar_dating_moods');
    if (saved) {
      try {
        setEntries(JSON.parse(saved));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const hasLoggedToday = entries.some(e => e.date === today);

  const logMood = (moodId: Mood) => {
    const newEntries = [...entries.filter(e => e.date !== today), { date: today, mood: moodId }];
    setEntries(newEntries);
    klarStorage.setItem('klar_dating_moods', JSON.stringify(newEntries));
    setIsLogging(false);
  };

  // Generate calendar grid for last 28 days (4 weeks)
  const days = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0] || '');
  }

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm overflow-hidden flex flex-col h-full">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand-light/10 flex items-center justify-center">
            <Smile size={20} className="text-brand dark:text-brand-light" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 dark:text-stone-100">Dating-Mood</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Verfolge deine Stimmung</p>
          </div>
        </div>

        {!isLogging && (
          <button
            onClick={() => setIsLogging(true)}
            className="w-8 h-8 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-400 hover:text-brand transition-colors"
          >
            {hasLoggedToday ? <Smile size={16} /> : <Plus size={16} />}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isLogging ? (
          <motion.div
            key="logging"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium text-stone-800 dark:text-stone-200">Wie fühlst du dich heute?</h4>
              <button aria-label="Eingabe schließen" onClick={() => setIsLogging(false)} className="text-stone-400 hover:text-stone-600 bg-stone-100 dark:bg-stone-800 p-1.5 rounded-full">
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {MOODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => logMood(m.id)}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
                >
                  <span className="text-3xl filter drop-shadow-sm">{m.emoji}</span>
                  <span className="text-[10px] font-medium text-stone-500 text-center">{m.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="heatmap"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                <CalendarDays size={14} /> Letzte 28 Tage
              </div>
              <div className="flex items-center gap-2">
                <Filter size={12} className="text-stone-400" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as Mood | "all")}
                  className="text-xs bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-none rounded-lg py-1 px-2 focus:ring-0 cursor-pointer outline-none font-medium"
                >
                  <option value="all">Alle Stimmungen</option>
                  {MOODS.map(m => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 flex-1">
              {days.map(date => {
                const entry = entries.find(e => e.date === date);
                const isMatchFilter = filter === "all" || (entry && entry.mood === filter);
                const moodDef = entry && isMatchFilter ? MOODS.find(m => m.id === entry.mood) : null;
                const isToday = date === today;

                return (
                  <div
                    key={date}
                    title={date + (moodDef ? ` - ${moodDef.label}` : (entry && filter !== "all" ? ` (Gefiltert)` : ''))}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xs transition-all ${
                      moodDef
                        ? `${moodDef.color} text-white shadow-sm scale-100`
                        : (entry && !isMatchFilter
                            ? 'bg-stone-100 dark:bg-stone-800/30 opacity-30 scale-95'
                            : 'bg-stone-50 dark:bg-stone-800/50 scale-100')
                    } ${isToday && !moodDef ? 'border-2 border-brand/30 border-dashed' : ''}`}
                  >
                    {moodDef ? moodDef.emoji : ''}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
