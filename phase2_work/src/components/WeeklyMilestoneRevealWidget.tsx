import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Flame, X,  } from "lucide-react";

export function WeeklyMilestoneRevealWidget() {
  const [show, setShow] = useState(false);
  const [streak, ] = useState(5);
  const [milestone, ] = useState("5 Chats geführt");

  useEffect(() => {
    // For demo purposes, we check if it was already shown this week
    const lastShown = klarStorage.getItem('klar_weekly_milestone_shown');
    const today = new Date().toISOString().split('T')[0] || '';

    if (lastShown !== today) {
      setTimeout(() => {
        setShow(true);
      }, 1000);
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    const today = new Date().toISOString().split('T')[0] || '';
    klarStorage.setItem('klar_weekly_milestone_shown', today);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="relative  from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-lg border border-indigo-400 overflow-hidden text-white"
        >
          <div className="absolute inset-0 pointer-events-none">
                       </div>

          <button
            aria-label="Meilenstein schließen"
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-20"
          >
            <X size={20} />
          </button>

          <div className="flex flex-col items-center text-center relative z-10 mt-2">
            <motion.div
              initial={{ rotate: -15, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
              className="w-16 h-16 bg-white/20  rounded-2xl flex items-center justify-center mb-4 shadow-inner"
            >
              <Trophy size={32} className="text-yellow-300 drop-shadow-md" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-100 mb-1">
                Wochen-Meilenstein
              </h3>
              <p className="text-2xl font-black mb-2">
                {milestone}!
              </p>
              <p className="text-indigo-100 text-sm mb-5 px-2">
                Stark! Du bist aktiv dabei und lernst tolle neue Leute kennen.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="inline-flex items-center gap-2 bg-black/20  px-4 py-2 rounded-full border border-white/10"
            >
              <Flame size={18} className="text-orange-400" />
              <span className="font-bold text-sm">{streak} Tage Dating-Streak</span>
            </motion.div>
          </div>

          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-yellow-300/20 rounded-full blur-2xl" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
