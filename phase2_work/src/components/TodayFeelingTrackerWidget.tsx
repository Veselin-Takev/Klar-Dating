import { klarStorage } from '../lib/userScopedStorage';
import { useState } from "react";
import { Smile, Sparkles, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function TodayFeelingTrackerWidget() {

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [completed, setCompleted] = useState(false);

  const openTracker = async () => {
    setIsOpen(true);
    if (!question && !completed) {
      setIsLoading(true);
      try {
        const res = await fetch("/api/feeling-question", { method: "POST" });
        if (res.ok) {
          const data = await res.text().then(text => text ? JSON.parse(text) : {});
          setQuestion(data.question);
        } else {
          setQuestion("Wie fühlst du dich heute auf deiner Dating-Reise?");
        }
      } catch (e) {
        setQuestion("Wie fühlst du dich heute auf deiner Dating-Reise?");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const submitAnswer = () => {
    if (!answer.trim()) return;

    // Save to journal or history
    try {
      const saved = JSON.parse(klarStorage.getItem('klar_feelings_log') || '[]');
      saved.push({ date: new Date().toISOString(), question, answer });
      klarStorage.setItem('klar_feelings_log', JSON.stringify(saved));
    } catch (e) { console.warn(e); ; }

    setCompleted(true);
    setTimeout(() => {
      setIsOpen(false);
      // reset for next time
      setTimeout(() => {
        setQuestion(null);
        setAnswer("");
        setCompleted(false);
      }, 500);
    }, 2000);
  };

  return (
    <>
      <div
        onClick={openTracker}
        className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-shadow group h-full flex flex-col justify-center"
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-500 p-3 rounded-2xl group- transition-transform">
            <Smile size={28} />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">Heute-Gefühl</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Wie geht's dir beim Daten?</p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 "
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-stone-800 rounded-3xl shadow-md overflow-hidden p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Smile className="text-orange-500" size={20} />
                  Kurzer Check-in
                </h3>
                <button aria-label="Eingabe schließen"
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="min-h-[150px] flex flex-col justify-center">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 text-stone-500">
                    <Sparkles className=" mb-3 text-orange-500" size={32} />
                    <p className="text-sm font-medium ">KI-Coach formuliert eine Frage...</p>
                  </div>
                ) : completed ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Smile size={32} />
                    </div>
                    <h4 className="font-bold text-xl text-stone-900 dark:text-stone-100 mb-2">Danke fürs Teilen!</h4>
                    <p className="text-stone-500 text-sm">Deine Reflektion wurde im Tagebuch gespeichert.</p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-2xl border border-orange-100 dark:border-orange-800/30 mb-6">
                      <p className="font-medium text-stone-800 dark:text-stone-200 leading-relaxed text-center">
                        "{question}"
                      </p>
                    </div>
                    <div className="relative">
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Deine Gedanken dazu..."
                        className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 pr-12 min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                      <button
                        aria-label="Antwort speichern"
                        onClick={submitAnswer}
                        disabled={!answer.trim()}
                        className="absolute bottom-3 right-3 p-2 bg-orange-500 hover:bg-orange-600 disabled:bg-stone-300 dark:disabled:bg-stone-700 text-white rounded-xl transition-colors"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
