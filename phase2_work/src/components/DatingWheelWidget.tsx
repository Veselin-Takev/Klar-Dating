import { useState } from "react";
import { getUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Sparkles, RefreshCw, CheckCircle2, X, CalendarPlus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { melde } from "../lib/fehler";

const genericTasks = [
  { title: "Kaffee-Spaziergang", description: "Holt euch einen Kaffee und geht eine Runde im Park spazieren." },
  { title: "Eis essen gehen", description: "Trefft euch auf ein Eis bei der besten Eisdiele der Stadt." },
  { title: "Gemeinsam kochen", description: "Sucht euch ein neues Rezept und kocht es zusammen." },
  { title: "Museumsbesuch", description: "Besucht eine interessante Ausstellung in eurer Nähe." },
  { title: "Flohmarkt-Bummel", description: "Schlendert gemütlich über den sonntäglichen Flohmarkt." }
];

interface DateIdea {
  title: string;
  description: string;
}

const popularIdeas = [
  { title: "Wein-Tasting", description: "Zusammen neue Weinsorten probieren und bewerten.", nachricht: 142 },
  { title: "Bouldern", description: "Sportlich aktiv sein und sich gegenseitig helfen.", nachricht: 89 },
  { title: "Kochkurs", description: "Sushi oder Pasta gemeinsam lernen.", nachricht: 215 },
  { title: "Live-Comedy", description: "Zusammen lachen beim lokalen Open-Mic.", nachricht: 110 }
];

export function DatingWheelWidget() {

  const [spinning, setSpinning] = useState(false);
  const [task, setTask] = useState<DateIdea | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"wheel" | "popular">("wheel");

  const completeTask = () => {
    setCompleted(true);
    try {
      const saved = JSON.parse(klarStorage.getItem('klar_wheel_completed_tasks') || '[]');
      saved.push(Date.now());
      klarStorage.setItem('klar_wheel_completed_tasks', JSON.stringify(saved));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('wheelTaskCompleted'));
    } catch (e) { console.warn(e); ; }
    setTimeout(() => setIsModalOpen(false), 1500);
  };

  const saveToCalendar = () => {
    if (!task) return;
    try {
      const savedEvents = JSON.parse(klarStorage.getItem('klar_calendar_drafts') || '[]');
      savedEvents.push({
        id: Date.now().toString(),
        title: task.title,
        description: task.description,
        date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        reminder: true
      });
      klarStorage.setItem('klar_calendar_drafts', JSON.stringify(savedEvents));

      // Request notification permission for reminder
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }

      setCompleted(true);
      setTimeout(() => setIsModalOpen(false), 2000);
    } catch (e) { console.warn(e); ; }
  };

  const spinWheel = async () => {
    if (spinning || loading) return;

    setIsModalOpen(true);
    setLoading(true);
    setTask(null);
    let ideas = genericTasks;

    try {
      const interestsRaw = getUserStorageItem('userInterests');
      const interests = interestsRaw ? JSON.parse(interestsRaw) : [];
      const bio = getUserStorageItem('klar_user_bio') || "";

      const combinedInterests = [...interests];
      if (bio) combinedInterests.push("Bio-Kontext: " + bio);

      if (combinedInterests.length > 0) {
        const res = await fetch("/api/date-ideas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interests: combinedInterests.join(', ') })
        });

        if (res.ok) {
          const data = await res.text().then(text => text ? JSON.parse(text) : {});
          if (data.ideas && data.ideas.length > 0) {
            ideas = data.ideas;
          }
        }
      }
    } catch (e) {
      melde("DatingWheelWidget", e);
      // Fallback to generic tasks on error
    } finally {
      setLoading(false);
    }

    // Log spin
    try {
      const savedSpins = JSON.parse(klarStorage.getItem('klar_wheel_spins') || '[]');
      savedSpins.push(Date.now());
      klarStorage.setItem('klar_wheel_spins', JSON.stringify(savedSpins));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('wheelTaskCompleted'));
    } catch (e) { console.warn(e); ; }

    setSpinning(true);
    setCompleted(false);

    // Simulate spinning effect
    let spins = 0;
    const interval = setInterval(() => {
      setTask((ideas[spins % ideas.length] as DateIdea) || genericTasks[0]);
      spins++;
      if (spins > 10) {
        clearInterval(interval);
        setSpinning(false);
        const randomTask = ideas[Math.floor(0 * ideas.length)];
        setTask((randomTask as DateIdea) || genericTasks[0]);
      }
    }, 100);
  };

  const openPopularIdea = (idea: unknown) => {
    setTask(idea);
    setCompleted(false);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm overflow-hidden h-full flex flex-col">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-1.5 rounded-lg">
                <Sparkles size={16} />
              </div>
              Date-Inspiration
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Ideen für dein nächstes Date</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4 bg-stone-100 dark:bg-stone-800/50 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("wheel")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === "wheel" ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"}`}
          >
            Glücksrad
          </button>
          <button
            onClick={() => setActiveTab("popular")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${activeTab === "popular" ? "bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300"}`}
          >
            Beliebte Ideen
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center relative overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === "wheel" ? (
              <motion.div
                key="wheel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="text-center py-4"
              >
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-6 px-4">
                  Lass dich für dein nächstes Date basierend auf deinen Interessen inspirieren.
                </p>
                <button
                  onClick={spinWheel}
                  className="px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-full font-medium shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
                >
                  <RefreshCw size={18} /> Rad drehen
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="popular"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory hide-scrollbar -mx-6 px-6"
              >
                {popularIdeas.map((idea, idx) => (
                  <div
                    key={idx}
                    onClick={() => openPopularIdea(idea)}
                    className="min-w-[200px] bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 p-4 rounded-2xl snap-center shrink-0 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">{idea.title}</h4>
                      <span className="text-[10px] bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 px-2 py-0.5 rounded-full font-semibold">
                        {idea.nachricht} ♥
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-3">{idea.description}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 "
              onClick={() => !spinning && !loading && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-stone-800 rounded-3xl shadow-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-lg text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <Sparkles className="text-purple-500" size={20} />
                    Dein Date-Vorschlag
                  </h3>
                  {!spinning && !loading && (
                    <button aria-label="Fenster schließen"
                      onClick={() => setIsModalOpen(false)}
                      className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="min-h-[200px] flex flex-col justify-center">
                  {loading && !spinning && (
                    <div className="flex flex-col items-center justify-center py-8 text-stone-500">
                      <Sparkles className=" mb-3 text-purple-500" size={32} />
                      <p className="text-sm font-medium ">Generiere kreative Ideen...</p>
                    </div>
                  )}

                  {(task || spinning) && (
                    <div className="bg-purple-50 dark:bg-purple-900/10 rounded-2xl p-6 text-center border border-purple-100 dark:border-purple-800/30 relative overflow-hidden">
                      {spinning && (
                        <div className="absolute inset-0  from-transparent via-white/50 dark:via-stone-800/50 to-transparent animate-[shimmer_1s_infinite] -skew-x-12" />
                      )}
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={task?.title || 'empty'}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.1 }}
                          className="relative z-10"
                        >
                          <h4 className="font-bold text-stone-900 dark:text-stone-100 mb-3 text-xl">
                            {task?.title}
                          </h4>
                          <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
                            {task?.description}
                          </p>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {!spinning && !loading && task && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 flex flex-col gap-3"
                  >
                    {!completed ? (
                      <div className="flex gap-2">
                        <button
                          onClick={completeTask}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 dark:text-stone-300"
                        >
                          <CheckCircle2 size={18} />
                          Merken
                        </button>
                        <button
                          onClick={saveToCalendar}
                          className="flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg"
                        >
                          <CalendarPlus size={18} />
                          Speichern & Erinnern
                        </button>
                      </div>
                    ) : (
                      <div className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        Aktion gespeichert!
                      </div>
                    )}

                    {!completed && (
                      <button
                        onClick={spinWheel}
                        className="w-full py-3 text-sm font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300 flex items-center justify-center gap-2 transition-colors"
                      >
                        <RefreshCw size={16} /> Neu drehen
                      </button>
                    )}
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
