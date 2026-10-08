import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Target, CheckCircle2, Circle, Flame, Award, TrendingUp, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Goal {
  id: string;
  title: string;
  completed: boolean;
}


export function CoachGoalTracker() {
  const [currentWeekId, setCurrentWeekId] = useState("");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalBadges, setTotalBadges] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    // Generate week ID based on current date
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((now.getDay() + 1 + days) / 7);
    const weekId = `${now.getFullYear()}-W${weekNumber}`;
    setCurrentWeekId(weekId);

    // Load data
    const savedData = klarStorage.getItem("klar_coach_goals");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setStreak(parsed.streak || 0);
        setTotalBadges(parsed.badges || 0);

        if (parsed.currentWeekId === weekId) {
          setGoals(parsed.goals || []);
        } else {
          // New week started, maybe handle streak logic if previous week was completed
          if (parsed.goals && parsed.goals.length > 0 && parsed.goals.every((g: Goal) => g.completed)) {
            setStreak(prev => prev + 1);
            setTotalBadges(prev => prev + 1);
          } else if (parsed.currentWeekId) {
            setStreak(0);
          }
          initDefaultGoals();
        }
      } catch (e) {
        initDefaultGoals();
      }
    } else {
      initDefaultGoals();
    }
  }, []);

  const initDefaultGoals = () => {
    setGoals([
      { id: "1", title: "Eine neue Konversation proaktiv starten", completed: false },
      { id: "2", title: "Profilbilder von jemandem nachricht, der nicht mein 100% Typ ist", completed: false },
      { id: "3", title: "Einmal 'Nein' sagen ohne Schuldgefühle", completed: false },
    ]);
  };

  const saveState = (newGoals: Goal[], newStreak = streak, newBadges = totalBadges) => {
    klarStorage.setItem("klar_coach_goals", JSON.stringify({
      currentWeekId,
      goals: newGoals,
      streak: newStreak,
      badges: newBadges
    }));
  };

  const toggleGoal = (id: string) => {
    setGoals(prev => {
      const newGoals = prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g);

      const allCompletedNow = newGoals.every(g => g.completed);
      const allCompletedBefore = prev.every(g => g.completed);

      let newStreak = streak;
      let newBadges = totalBadges;

      if (allCompletedNow && !allCompletedBefore) {
        setShowCelebration(true);
        newStreak += 1;
        newBadges += 1;
        setTimeout(() => setShowCelebration(false), 3000);
      } else if (!allCompletedNow && allCompletedBefore) {
        newStreak = Math.max(0, newStreak - 1);
        newBadges = Math.max(0, newBadges - 1);
      }

      setStreak(newStreak);
      setTotalBadges(newBadges);
      saveState(newGoals, newStreak, newBadges);

      return newGoals;
    });
  };

  const completedCount = goals.filter(g => g.completed).length;
  const progress = goals.length > 0 ? (completedCount / goals.length) * 100 : 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 relative">
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1, y: -20 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-stone-800 border-2 border-amber-400 rounded-2xl p-4 shadow-md flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
              <Trophy size={24} className="text-amber-500" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 dark:text-stone-100">Wochenziel erreicht!</h4>
              <p className="text-xs text-stone-500 dark:text-stone-400">Neues Badge erhalten + Streak erhöht.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
        <h3 className="text-lg font-medium mb-1 text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Target className="text-brand dark:text-brand-light" size={20} />
          Wöchentliche Meilensteine
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          Kleine Schritte für ein gesünderes Dating-Leben. Verfolge deine wöchentlichen Ziele.
        </p>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Flame size={20} className="text-orange-500" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-medium">Wochen-Streak</div>
              <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{streak}</div>
            </div>
          </div>

          <div className="flex-1 bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 border border-stone-100 dark:border-stone-700 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Award size={20} className="text-violet-500" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-medium">Erfolgs-Badges</div>
              <div className="text-lg font-bold text-stone-900 dark:text-stone-100">{totalBadges}</div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs font-medium mb-2">
            <span className="text-stone-700 dark:text-stone-300">Fortschritt (Woche)</span>
            <span className="text-brand dark:text-brand-light">{completedCount} / {goals.length}</span>
          </div>
          <div className="h-2.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-brand dark:bg-brand-light rounded-full"
            />
          </div>
        </div>

        <div className="space-y-3 mt-6">
          {goals.map(goal => (
            <motion.div
              key={goal.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleGoal(goal.id)}
              className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                goal.completed
                  ? 'bg-brand/5 dark:bg-brand-light/5 border-brand/20 dark:border-brand-light/20'
                  : 'bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-700 hover:border-stone-200 dark:hover:border-stone-700'
              }`}
            >
              <div className={`shrink-0 ${goal.completed ? 'text-brand dark:text-brand-light' : 'text-stone-300 dark:text-stone-600'}`}>
                {goal.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
              </div>
              <span className={`text-sm font-medium ${
                goal.completed
                  ? 'text-stone-400 line-through'
                  : 'text-stone-700 dark:text-stone-200'
              }`}>
                {goal.title}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className=" from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-5 shadow-sm">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2">
          <TrendingUp size={16} className="text-blue-500" />
          Coach Tipp
        </h4>
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
          Setze dir kleine, erreichbare Ziele statt unrealistischer Erwartungen. Ein proaktiver Start in ein Gespräch kann dir oft mehr Selbstvertrauen geben, als darauf zu warten, angeschrieben zu werden.
        </p>
      </div>
    </div>
  );
}
