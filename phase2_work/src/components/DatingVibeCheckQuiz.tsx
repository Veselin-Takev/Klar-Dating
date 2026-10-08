import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { askAICoach } from '../lib/api';
import { ArrowRight, Sparkles, RefreshCcw, History, Trash2 } from 'lucide-react';
import { melde } from "../lib/fehler";

const QUESTIONS = [
  {
    id: 'q1',
    question: 'Wie verbringst du am liebsten einen freien Sonntagnachmittag?',
    options: [
      { id: 'a', text: 'Draußen in der Natur (Wandern, Park)' },
      { id: 'b', text: 'Gemütlich zu Hause auf dem Sofa' },
      { id: 'c', text: 'Unterwegs mit Freunden in einem Café' },
      { id: 'd', text: 'Ich entdecke gerne neue Orte in der Stadt' }
    ]
  },
  {
    id: 'q2',
    question: 'Was ist dir bei einem ersten Date am wichtigsten?',
    options: [
      { id: 'a', text: 'Tiefe, bedeutungsvolle Gespräche' },
      { id: 'b', text: 'Gemeinsam lachen und Spaß haben' },
      { id: 'c', text: 'Eine lockere, entspannte Atmosphäre' },
      { id: 'd', text: 'Eine gemeinsame Aktivität (z.B. Minigolf, Spazieren)' }
    ]
  },
  {
    id: 'q3',
    question: 'Wie gehst du typischerweise mit Konflikten um?',
    options: [
      { id: 'a', text: 'Ich spreche Dinge direkt und ruhig an' },
      { id: 'b', text: 'Ich brauche erst etwas Zeit für mich zum Nachdenken' },
      { id: 'c', text: 'Ich versuche die Situation mit Humor aufzulockern' },
      { id: 'd', text: 'Ich suche nach einem schnellen Kompromiss' }
    ]
  },
  {
    id: 'q4',
    question: 'Was ist dein Love Language?',
    options: [
      { id: 'a', text: 'Quality Time (Zweisamkeit)' },
      { id: 'b', text: 'Words of Affirmation (Liebevolle Worte)' },
      { id: 'c', text: 'Physical Touch (Körperliche Nähe)' },
      { id: 'd', text: 'Acts of Service (Unterstützung im Alltag)' }
    ]
  }
];

type VibeCheckHistoryEntry = {
  id: string;
  date: string;
  result: string;
};

export function DatingVibeCheckQuiz() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<VibeCheckHistoryEntry[]>([]);

  useEffect(() => {
    const saved = klarStorage.getItem('klar_vibe_check_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        melde("DatingVibeCheckQuiz", e);
      }
    }
  }, []);

  const saveToHistory = (resultText: string) => {
    const newEntry: VibeCheckHistoryEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      result: resultText
    };
    setHistory(prev => {
      const updated = [newEntry, ...prev];
      klarStorage.setItem('klar_vibe_check_history', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteHistoryEntry = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(entry => entry.id !== id);
      klarStorage.setItem('klar_vibe_check_history', JSON.stringify(updated));
      return updated;
    });
  }

  const handleAnswer = (optionId: string) => {
    const questionId = QUESTIONS[currentQuestionIndex]!.id;
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));

    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
      }, 300);
    } else {
      generateResult({ ...answers, [questionId]: optionId });
    }
  };

  const generateResult = async (finalAnswers: Record<string, string>) => {
    setIsGenerating(true);
    setError(null);
    try {
      let promptText = "Bitte analysiere meinen Dating-Vibe basierend auf folgenden Antworten und gib mir 2-3 personalisierte, konkrete Coaching-Tipps für meine Dates:\n\n";

      QUESTIONS.forEach(q => {
        const answerId = finalAnswers[q.id];
        const answerText = q.options.find(o => o.id === answerId)?.text;
        promptText += `- ${q.question}: ${answerText}\n`;
      });

      promptText += "\nAntworte auf Deutsch im lockeren 'Du'. Formatiere die Antwort in ein bis zwei kurzen Absätzen für den Vibe und einer Aufzählung für die Tipps. Fasse dich kurz und prägnant.";

      const aiResponse = await askAICoach(promptText);
      setResult(aiResponse);
      saveToHistory(aiResponse);
    } catch (err) {
      setError("Es gab ein Problem bei der Auswertung deines Vibe-Checks. Bitte versuche es noch einmal.");
      melde("DatingVibeCheckQuiz", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setResult(null);
    setError(null);
  };

  const renderQuizContent = () => {
    if (result) {
      return (
        <div className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={64} className="text-brand dark:text-brand-light" />
          </div>
          <h3 className="font-serif text-xl font-medium text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2 relative z-10">
            <Sparkles size={20} className="text-brand dark:text-brand-light" />
            Dein Dating-Vibe & Coaching
          </h3>

          <div className="prose prose-sm dark:prose-invert max-w-none text-stone-700 dark:text-stone-300 relative z-10 whitespace-pre-wrap leading-relaxed">
            {result}
          </div>

          <button
            onClick={resetQuiz}
            className="mt-6 flex items-center gap-2 text-sm font-medium text-brand dark:text-brand-light hover:underline relative z-10"
          >
            <RefreshCcw size={16} />
            Quiz wiederholen
          </button>
        </div>
      );
    }

    if (isGenerating) {
      return (
        <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
          <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700  mb-3"></div>
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-2">KI-Coach analysiert...</h3>
          <p className="text-sm text-stone-500">Dein Dating-Vibe wird berechnet und personalisierte Tipps werden erstellt.</p>
        </div>
      );
    }

    const currentQuestion = QUESTIONS[currentQuestionIndex]!;
    if (!currentQuestion) return null;

    return (
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-stone-50 dark:bg-stone-800/50 p-4 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center">
          <h3 className="font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Sparkles size={18} className="text-brand dark:text-brand-light" />
            Dating-Vibe-Check
          </h3>
          <div className="text-xs font-medium text-stone-500 bg-white dark:bg-stone-800 px-2.5 py-1 rounded-full shadow-sm border border-stone-100 dark:border-stone-700">
            Frage {currentQuestionIndex + 1} / {QUESTIONS.length}
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h4 className="text-lg font-serif mb-6 text-stone-900 dark:text-stone-100 leading-snug">
                {currentQuestion.question}
              </h4>

              <div className="space-y-3">
                {currentQuestion.options.map(option => (
                  <button
                    key={option.id}
                    onClick={() => handleAnswer(option.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group
                      ${answers[currentQuestion.id] === option.id
                        ? 'border-brand dark:border-brand-light bg-brand/5 dark:bg-brand-light/5 text-brand dark:text-brand-light'
                        : 'border-stone-200 dark:border-stone-700 hover:border-brand/50 dark:hover:border-brand-light/50 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                  >
                    <span className="text-sm font-medium">{option.text}</span>
                    <ArrowRight size={16} className={`transition-transform duration-300 ${
                      answers[currentQuestion.id] === option.id
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                    }`} />
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {error && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm rounded-lg border border-amber-100 dark:border-amber-800">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {renderQuizContent()}

      {history.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-brand dark:text-brand-light mb-2 flex items-center gap-2">
            <History size={18} />
            Dein Vibe-Check Verlauf
          </h4>
          <div className="space-y-4">
            {history.map(entry => (
              <div key={entry.id} className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl relative group transition-all">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-xs font-medium text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">{entry.date}</span>
                  <button aria-label="Eintrag löschen" onClick={() => deleteHistoryEntry(entry.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none text-stone-700 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">
                  {entry.result}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
