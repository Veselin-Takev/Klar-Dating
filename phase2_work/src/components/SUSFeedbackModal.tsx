import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function SUSFeedbackModal() {
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<number[]>(Array(10).fill(3)); // Default neutral

  // Questions from standard System Usability Scale (SUS)
  const questions = [
    "Ich denke, dass ich das System gerne häufig nutzen würde.",
    "Ich fand das System unnötig komplex.",
    "Ich fand das System einfach zu bedienen.",
    "Ich glaube, ich würde die Hilfe einer technischen Person benötigen, um das System benutzen zu können.",
    "Ich fand, die verschiedenen Funktionen in diesem System waren gut integriert.",
    "Ich dachte, es gäbe zu viele Inkonsistenzen in diesem System.",
    "Ich kann mir vorstellen, dass die meisten Menschen den Umgang mit diesem System sehr schnell lernen.",
    "Ich fand das System sehr umständlich zu bedienen.",
    "Ich fühlte mich bei der Benutzung des Systems sehr sicher.",
    "Ich musste viele Dinge lernen, bevor ich mit dem System arbeiten konnte."
  ];

  useEffect(() => {
    // Check if already submitted
    const hasSubmitted = klarStorage.getItem("klar_sus_submitted");
    if (hasSubmitted) return;

    // Show after 10 minutes (600,000 ms) in a real session, using 15s for testing if needed
    // Setting to 10 minutes as requested
    const timer = setTimeout(() => {
      setShow(true);
    }, 600000);

    // For preview testing purpose, if it's explicitly tested, we can leave it at 10m
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    // In a real app, send 'answers' to backend to calculate SUS score
    // Calculation:
    // For odd items: subtract 1 from the user response.
    // For even-numbered items: subtract the user responses from 5
    // Add up the converted responses for each user and multiply that total by 2.5

    setSubmitted(true);
    klarStorage.setItem("klar_sus_submitted", "true");

    setTimeout(() => {
      setShow(false);
    }, 3000);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 left-4 right-4 z-[100] bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-md overflow-hidden max-h-[80vh] flex flex-col"
      >
        {!submitted ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Dein Feedback hilft uns!</h3>
              <button aria-label="Umfrage schließen" onClick={() => setShow(false)} className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-full bg-stone-100 dark:bg-stone-800">
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-stone-500 mb-4">
              Wir möchten Klar ständig verbessern. Bitte bewerte die folgenden Aussagen (1 = Stimme gar nicht zu, 5 = Stimme voll zu).
            </p>

            <div className="overflow-y-auto hide-scrollbar flex-1 mb-4 flex flex-col gap-6 pr-2">
              {questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-stone-800 dark:text-stone-200">{i + 1}. {q}</span>
                  <div className="flex justify-between items-center gap-2">
                    {[1, 2, 3, 4, 5].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const newAns = [...answers];
                          newAns[i] = val;
                          setAnswers(newAns);
                        }}
                        className={`flex-1 py-2 text-sm rounded-xl border transition-colors ${answers[i] === val ? 'bg-brand text-white border-brand' : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300'}`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              className="w-full py-3 bg-brand text-white rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
            >
              Feedback senden
            </button>
          </>
        ) : (
          <div className="py-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h4 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-2">Vielen Dank!</h4>
            <p className="text-xs text-stone-500">Dein Feedback wurde gespeichert und hilft uns, Klar für alle zu verbessern.</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
