import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Map, CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";

type RoadmapStep = {
  id: string;
  title: string;
  description: string;
};

const ROADMAP_STEPS: RoadmapStep[] = [
  { id: "step-1", title: "Profil optimieren", description: "Fotos & Bio authentisch gestalten." },
  { id: "step-2", title: "Erstes Date planen", description: "Icebreaker nutzen & Treffen vereinbaren." },
  { id: "step-3", title: "Zweite Begegnung", description: "Vertiefende Gespräche & echte Connection." },
  { id: "step-4", title: "Regelmäßige Treffen", description: "Routine finden & Alltag teilen." },
  { id: "step-5", title: "Beziehungs-Check", description: "Offen über Ziele & Gefühle sprechen." }
];

export function DatingGoalRoadmapWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [activeParticleStep, setActiveParticleStep] = useState<string | null>(null);

  useEffect(() => {
    const saved = klarStorage.getItem('klar_dating_roadmap');
    if (saved) {
      try {
        setCompletedSteps(JSON.parse(saved));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }

    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const lastActivity = klarStorage.getItem('klar_roadmap_last_activity');
    if (lastActivity) {
      const timeDiff = Date.now() - parseInt(lastActivity, 10);
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff >= 48) {
        if (saved) {
          try {
            const completed = JSON.parse(saved);
            if (completed.length < ROADMAP_STEPS.length) {
               if ('Notification' in window && Notification.permission === 'granted') {
                 const nextStep = ROADMAP_STEPS.find(s => !completed.includes(s.id));
                 if (nextStep) {
                    new Notification("Klar Dating Coach", {
                      body: `Zeit für den nächsten Schritt: ${nextStep.title}. Bleib dran!`,
                      icon: "/favicon.ico"
                    });
                 }
               }
            }
          } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
        }
      }
    }
    // Update last activity so we don't spam
    klarStorage.setItem('klar_roadmap_last_activity', Date.now().toString());
  }, []);

  const toggleStep = (stepId: string) => {
    let newCompleted;
    if (completedSteps.includes(stepId)) {
      newCompleted = completedSteps.filter(id => id !== stepId);
    } else {
      newCompleted = [...completedSteps, stepId];

      setActiveParticleStep(stepId);
      setTimeout(() => setActiveParticleStep(null), 1500);

      // If all steps completed
      if (true) {
              }
    }
    setCompletedSteps(newCompleted);
    klarStorage.setItem('klar_dating_roadmap', JSON.stringify(newCompleted));
    klarStorage.setItem('klar_roadmap_last_activity', Date.now().toString());
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('roadmapProgressChanged'));
  };

  const progress = Math.round((completedSteps.length / ROADMAP_STEPS.length) * 100);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-500">
            <Map size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Dating-Ziel-Roadmap</h3>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Dein Weg zum Ziel</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-indigo-500">{progress}%</span>
        </div>
      </div>

      <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-full h-2 mb-6">
        <motion.div
          className="bg-indigo-500 h-2 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-0 relative hide-scrollbar pl-2">
        {ROADMAP_STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isNext = !isCompleted && (index === 0 || completedSteps.includes(ROADMAP_STEPS[index - 1]?.id || ""));

          return (
            <div key={step.id} className="relative pl-8 pb-5 last:pb-0">
              {/* Line connector */}
              {index !== ROADMAP_STEPS.length - 1 && (
                <div className={`absolute left-[11px] top-6 bottom-[-10px] w-0.5 ${isCompleted ? 'bg-indigo-500' : 'bg-stone-200 dark:bg-stone-800'}`} />
              )}

              {/* Step indicator */}
              <button
                onClick={() => toggleStep(step.id)}
                className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white dark:bg-stone-800 flex items-center justify-center transition-transform  z-10"
              >
                {isCompleted ? (
                  <CheckCircle2 size={24} className="text-indigo-500" />
                ) : isNext ? (
                  <div className="w-6 h-6 rounded-full border-2 border-indigo-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 " />
                  </div>
                ) : (
                  <Circle size={24} className="text-stone-300 dark:text-stone-700" />
                )}
              </button>

              {/* Step Content */}
              <motion.div
                animate={{ opacity: isCompleted || isNext ? 1 : 0.5 }}
                className={`bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-3 border transition-colors ${isCompleted ? 'border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/10' : isNext ? 'border-indigo-300 dark:border-indigo-500/50' : 'border-stone-100 dark:border-stone-700'} relative overflow-hidden`}
              >
                {activeParticleStep === step.id && (
                  <motion.div
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="absolute inset-0 z-0 bg-indigo-400/20 rounded-2xl flex items-center justify-center pointer-events-none"
                  >
                    <Sparkles size={48} className="text-indigo-400" />
                  </motion.div>
                )}
                <div className="flex justify-between items-center mb-1 relative z-10">
                  <h4 className={`text-sm font-semibold ${isCompleted ? 'text-indigo-700 dark:text-indigo-300' : 'text-stone-900 dark:text-stone-100'}`}>
                    {step.title}
                  </h4>
                  {isNext && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full">
                      Aktuell
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 relative z-10">
                  {step.description}
                </p>
                {isNext && (
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="mt-3 w-full py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors relative z-10"
                  >
                    Als erledigt markieren <ArrowRight size={12} />
                  </button>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

          </div>
  );
}
