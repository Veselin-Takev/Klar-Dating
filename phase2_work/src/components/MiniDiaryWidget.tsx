import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Book, Send, Check } from "lucide-react";
import { motion } from "motion/react";

const EMOJIS = ["😭", "😕", "😐", "🙂", "😍"];

interface DiaryEntry {
  date: string;
  emoji: string;
  text: string;
}

export function MiniDiaryWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [text, setText] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(klarStorage.getItem('klar_mini_diary') || '[]');
      setEntries(saved);
    } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
  }, []);

  const submitEntry = () => {
    if (!selectedEmoji && !text.trim()) return;

    const newEntry: DiaryEntry = {
      date: new Date().toISOString(),
      emoji: selectedEmoji || "😐",
      text: text.trim()
    };

    const updated = [newEntry, ...entries].slice(0, 10); // Keep last 10
    setEntries(updated);

    try {
      klarStorage.setItem('klar_mini_diary', JSON.stringify(updated));
    } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }

    setCompleted(true);
    setTimeout(() => {
      setCompleted(false);
      setSelectedEmoji("");
      setText("");
    }, 2000);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 p-1.5 rounded-lg">
              <Book size={16} />
            </div>
            Tagebuch
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Stimmung nach einem Date oder Chat loggen</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {completed ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center py-4 text-emerald-600 dark:text-emerald-400"
          >
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-2">
              <Check size={24} />
            </div>
            <p className="font-medium text-sm">Gespeichert!</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col gap-3"
          >
            <div className="flex justify-between items-center bg-stone-50 dark:bg-stone-800/50 p-2 rounded-2xl">
              {EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => setSelectedEmoji(emoji)}
                  className={`text-2xl p-2 rounded-xl transition-all ${selectedEmoji === emoji ? 'bg-white dark:bg-stone-700 shadow-sm scale-110' : ' opacity-60 hover:opacity-100'}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Kurze Notiz..."
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-3 pr-10 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                rows={2}
              />
              <button
                aria-label="Eintrag speichern"
                onClick={submitEntry}
                disabled={!selectedEmoji && !text.trim()}
                className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white rounded-lg transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
