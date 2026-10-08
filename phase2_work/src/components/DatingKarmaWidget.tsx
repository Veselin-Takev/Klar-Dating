import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Trophy, BookOpen, Flame, Award, Star, Zap } from "lucide-react";

export function DatingKarmaWidget() {
  const [karma, setKarma] = useState(0);
  const [level, setLevel] = useState("Novice");
  const [badges, setBadges] = useState<{ id: string, name: string, icon: React.ReactNode, unlocked: boolean }[]>([]);
  const [showBadges, setShowBadges] = useState(false);

  useEffect(() => {
    // Calculate karma
    const journalsRaw = klarStorage.getItem("klar_dating_journals");
    const journals = journalsRaw ? JSON.parse(journalsRaw) : [];
    const journalPoints = journals.length * 10;

    // Check roadmap or milestones completed
    const completedStepsRaw = klarStorage.getItem('klar_dating_roadmap');
    const completedSteps = completedStepsRaw ? JSON.parse(completedStepsRaw) : [];
    const stepPoints = completedSteps.length * 20;

    const total = journalPoints + stepPoints;
    setKarma(total);

    if (total < 50) setLevel("Novice");
    else if (total < 150) setLevel("Explorer");
    else setLevel("Pro");

    const newBadges = [
      { id: 'first_journal', name: 'Reflektor', icon: <BookOpen size={16} />, unlocked: journals.length >= 1 },
      { id: 'five_journals', name: 'Chronist', icon: <BookOpen size={16} />, unlocked: journals.length >= 5 },
      { id: 'first_module', name: 'Schüler', icon: <Flame size={16} />, unlocked: completedSteps.length >= 1 },
      { id: 'three_modules', name: 'Meister', icon: <Trophy size={16} />, unlocked: completedSteps.length >= 3 },
      { id: 'karma_100', name: 'Karma 100', icon: <Star size={16} />, unlocked: total >= 100 },
      { id: 'karma_200', name: 'Dating Guru', icon: <Zap size={16} />, unlocked: total >= 200 }
    ];
    setBadges(newBadges);

  }, []);

  const progressToNext = level === "Novice" ? (karma / 50) * 100 : level === "Explorer" ? ((karma - 50) / 100) * 100 : 100;

  const unlockedBadgesCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm relative overflow-hidden">
      <div className="flex justify-between items-center mb-4 relative z-10">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Award size={18} className="text-brand dark:text-brand-light" />
          Dating Karma
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBadges(!showBadges)}
            className="flex items-center gap-1.5 px-3 py-1 bg-brand/10 text-brand rounded-full text-xs font-bold hover:bg-brand/20 transition-colors"
          >
            <Star size={12} fill="currentColor" /> {unlockedBadgesCount}/{badges.length}
          </button>
          <span className="text-xl font-black text-brand dark:text-brand-light">{karma}</span>
        </div>
      </div>

      <div className="mb-4 relative z-10">
        <div className="flex justify-between text-xs mb-1 font-medium text-stone-500 dark:text-stone-400">
          <span className="text-stone-900 dark:text-white uppercase tracking-wider">{level}</span>
          <span>{level === "Pro" ? "Max Level!" : `Nächstes Level in ${level === "Novice" ? 50 - karma : 150 - karma} Pkt`}</span>
        </div>
        <div className="h-2 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressToNext}%` }}
            transition={{ duration: 1, delay: 0.2 }}
            className="h-full bg-brand dark:bg-brand-light"
          />
        </div>
      </div>

      <AnimatePresence>
        {showBadges ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden relative z-10"
          >
            <div className="pt-2 pb-1">
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mb-2 uppercase tracking-wider">Deine Badges</h4>
              <div className="grid grid-cols-3 gap-2">
                {badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      badge.unlocked
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 shadow-sm'
                        : 'bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-700 text-stone-400 dark:text-stone-600 grayscale opacity-60'
                    }`}
                  >
                    <div className="mb-1">{badge.icon}</div>
                    <span className="text-[9px] font-bold">{badge.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-2 relative z-10"
          >
            <div className="flex-1 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-xl text-center border border-stone-100 dark:border-stone-700">
              <BookOpen size={14} className="mx-auto mb-1 text-stone-400" />
              <span className="text-[10px] text-stone-500 font-bold">+10 / Journal</span>
            </div>
            <div className="flex-1 bg-stone-50 dark:bg-stone-800/50 p-2 rounded-xl text-center border border-stone-100 dark:border-stone-700">
              <Flame size={14} className="mx-auto mb-1 text-stone-400" />
              <span className="text-[10px] text-stone-500 font-bold">+20 / Modul</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute -bottom-6 -right-6 text-brand/5 dark:text-brand-light/5 pointer-events-none">
        <Sparkles size={120} />
      </div>
    </div>
  );
}
