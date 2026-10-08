import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bell, X, Activity } from "lucide-react";
import { Link } from "react-router";

export function MoodDiaryReminder() {
  const [isVisible, setIsVisible] = useState(false);
  const [motivationMessage, setMotivationMessage] = useState("");

  useEffect(() => {
    // Check if dismissed recently
    const lastDismissed = klarStorage.getItem("klar_mood_reminder_dismissed");
    if (lastDismissed) {
      const timeSinceDismissal = Date.now() - parseInt(lastDismissed, 10);
      // Don't show again for 24 hours
      if (timeSinceDismissal < 24 * 60 * 60 * 1000) return;
    }

    const journalsRaw = klarStorage.getItem("klar_dating_journals");
    const journals = journalsRaw ? JSON.parse(journalsRaw) : [];

    if (journals.length === 0) {
      setMotivationMessage("Dein Weg beginnt hier! Halte dein erstes Dating-Gefühl fest, um Klarheit zu gewinnen.");
      setIsVisible(true);
      return;
    }

    const lastEntryDate = new Date(journals[journals.length - 1].date).getTime();
    const daysSinceLastEntry = (Date.now() - lastEntryDate) / (1000 * 60 * 60 * 24);

    if (daysSinceLastEntry > 3) {
      const completedStepsRaw = klarStorage.getItem("klar_dating_roadmap");
      const completedSteps = completedStepsRaw ? JSON.parse(completedStepsRaw) : [];

      if (completedSteps.length > 0) {
        setMotivationMessage(`Du hast bereits ${completedSteps.length} Coaching-Module gemeistert! Nutze diesen Schwung und reflektiere deine aktuelle Stimmung.`);
      } else {
        setMotivationMessage("Dating-Erfolg braucht Reflexion. Wie fühlst du dich heute nach deinen letzten Erlebnissen?");
      }
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    klarStorage.setItem("klar_mood_reminder_dismissed", Date.now().toString());
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-brand/10 dark:bg-brand/20 border border-brand/20 dark:border-brand/30 rounded-2xl p-4 mb-6 shadow-sm flex items-start gap-4 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />

          <div className="w-10 h-10 rounded-full bg-white dark:bg-stone-800 shadow-sm flex items-center justify-center shrink-0 border border-brand/10">
            <Bell size={20} className="text-brand dark:text-brand-light" />
          </div>

          <div className="flex-1 pt-0.5">
            <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1">
              Erinnerung <Activity size={14} className="text-brand" />
            </h4>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed pr-6 mb-3">
              {motivationMessage}
            </p>
            <Link
              to="/ai-coach"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
              onClick={handleDismiss}
            >
              Jetzt reflektieren
            </Link>
          </div>

          <button
            aria-label="Erinnerung schließen"
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
