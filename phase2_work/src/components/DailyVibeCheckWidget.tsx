import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Sparkles, BrainCircuit, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { askAICoach } from "../lib/api";

const QUESTIONS = [
  {
    id: "energy",
    text: "Wie fühlst du dich heute in Bezug auf Dating?",
    options: [
      { id: "high", text: "Hochmotiviert & neugierig", icon: "🚀" },
      { id: "medium", text: "Entspannt, mal schauen", icon: "😌" },
      { id: "low", text: "Eher frustriert / erschöpft", icon: "🔋" }
    ]
  },
  {
    id: "focus",
    text: "Was ist dein heutiges Ziel?",
    options: [
      { id: "new", text: "Neue Leute kennenlernen", icon: "👀" },
      { id: "chat", text: "Bestehende Verbindungen anschreiben", icon: "💬" },
      { id: "pause", text: "Nur Profil optimieren / Pause", icon: "☕" }
    ]
  },
  {
    id: "time",
    text: "Wie viel Zeit hast du heute für die App?",
    options: [
      { id: "lots", text: "Viel Zeit (30m+)", icon: "⏳" },
      { id: "some", text: "Ein bisschen (10-15m)", icon: "⏱️" },
      { id: "little", text: "Nur ganz kurz (<5m)", icon: "⚡" }
    ]
  }
];

export function DailyVibeCheckWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const saved = klarStorage.getItem('klar_daily_vibe');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          setIsCompleted(true);
          setFocusMessage(parsed.focusMessage);
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const handleAnswer = async (_: string, optionText: string) => {
    const q = QUESTIONS[currentStep];
    const newAnswers = { ...answers, [q?.id || ""]: optionText };
    setAnswers(newAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      setIsGenerating(true);
      setIsCompleted(true);
      try {
        const prompt = `Erstelle einen motivierenden, kurzen Tagesfokus (2-3 Sätze) für den Nutzer basierend auf seinem heutigen Dating-Mindset.
Antworten:
1. Energie: ${newAnswers.energy}
2. Ziel: ${newAnswers.focus}
3. Zeit: ${newAnswers.time}

Gib ihm einen konkreten, handlungsorientierten Tipp für heute als sein KI-Coach.`;
        const res = await askAICoach(prompt);
        const focus = res.trim();
        setFocusMessage(focus);

        klarStorage.setItem('klar_daily_vibe', JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          focusMessage: focus,
          answers: newAnswers
        }));

        // Let other components know the coach focus has updated
        window.dispatchEvent(new Event('coach-focus-updated'));
      } catch(e) {
        setFocusMessage("Dein Fokus für heute ist gesetzt! Geh es in deinem Tempo an.");
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setAnswers({});
    setIsCompleted(false);
    setFocusMessage(null);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="p-2 bg-brand/10 dark:bg-brand-light/10 rounded-xl">
          <BrainCircuit size={20} className="text-brand dark:text-brand-light" />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Täglicher Vibe-Check</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Dein heutiges Dating-Mindset</p>
        </div>
      </div>

      <div className="flex-1 relative z-10 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {!isCompleted ? (
            <motion.div
              key={`step-${currentStep}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              <div className="mb-4">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 block">
                  Frage {currentStep + 1} von {QUESTIONS.length}
                </span>
                <h4 className="font-medium text-stone-800 dark:text-stone-200 text-sm">
                  {QUESTIONS[currentStep]?.text}
                </h4>
              </div>

              <div className="space-y-2">
                {QUESTIONS[currentStep]?.options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleAnswer(opt.id, opt.text)}
                    className="w-full text-left p-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:border-brand dark:hover:border-brand-light hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors flex items-center gap-3 text-sm font-medium text-stone-700 dark:text-stone-300"
                  >
                    <span className="text-xl">{opt.icon}</span>
                    {opt.text}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col h-full justify-center"
            >
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center py-6 text-stone-500">
                  <Sparkles size={24} className=" mb-3 text-brand" />
                  <p className="text-sm font-medium ">KI analysiert dein Mindset...</p>
                </div>
              ) : (
                <div className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 rounded-2xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-20">
                    <CheckCircle2 size={48} className="text-brand" />
                  </div>
                  <h4 className="font-semibold text-brand dark:text-brand-light mb-2 text-sm flex items-center gap-2 relative z-10">
                    <Sparkles size={16} /> Dein Tagesfokus
                  </h4>
                  <p className="text-stone-700 dark:text-stone-300 text-sm leading-relaxed relative z-10 italic">
                    "{focusMessage}"
                  </p>

                  <button
                    onClick={reset}
                    className="mt-4 text-xs font-medium text-stone-500 hover:text-brand transition-colors relative z-10"
                  >
                    Vibe-Check wiederholen
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!isCompleted && (
        <div className="mt-4 flex gap-1 justify-center relative z-10">
          {QUESTIONS.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-brand dark:bg-brand-light' : 'w-1.5 bg-stone-200 dark:bg-stone-700'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
