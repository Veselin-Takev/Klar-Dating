import { useState } from 'react';
import { Lock, Check } from 'lucide-react';

interface Question {
  id: string;
  text: string;
}

interface IcebreakerGateProps {
  questions: Question[];
  myAnswers: Record<string, string>;
  theirAnswers: Record<string, string>;
  onSubmitAnswer: (questionId: string, answer: string) => Promise<void>;
}

export function IcebreakerGate({ questions, myAnswers, theirAnswers, onSubmitAnswer }: IcebreakerGateProps) {
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!activeQuestion || !draftAnswer.trim()) return;
    setIsSubmitting(true);
    await onSubmitAnswer(activeQuestion, draftAnswer);
    setDraftAnswer('');
    setActiveQuestion(null);
    setIsSubmitting(false);
  };

  const isFullyCompleted = questions.every(q => myAnswers[q.id] && theirAnswers[q.id]);

  if (isFullyCompleted) return null;

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 md:p-6 max-w-lg mx-auto my-4 text-stone-900">
      <div className="flex items-center gap-2 mb-4">
        <Lock size={18} className="text-stone-500" />
        <h3 className="text-base font-semibold">Icebreaker</h3>
      </div>
      <p className="text-sm text-stone-600 mb-6">
        Beantwortet beide diese zwei Fragen, um den freien Chat zu eröffnen.
      </p>

      <div className="space-y-4">
        {questions.map((q) => {
          const iHaveAnswered = !!myAnswers[q.id];
          const theyHaveAnswered = !!theirAnswers[q.id];

          return (
            <div key={q.id} className="bg-white border border-stone-200 p-4 rounded-lg">
              <p className="text-sm font-medium mb-3">{q.text}</p>

              {iHaveAnswered ? (
                <div className="flex items-center gap-2 text-sm text-stone-600 bg-stone-50 p-2 rounded">
                  <Check size={14} className="text-green-600" />
                  Du hast geantwortet. {theyHaveAnswered ? "Beide Antworten sichtbar." : "Warte auf Antwort..."}
                </div>
              ) : activeQuestion === q.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="w-full text-sm p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-900 min-h-[80px]"
                    placeholder="Deine Antwort..."
                    value={draftAnswer}
                    onChange={(e) => setDraftAnswer(e.target.value)}
                    disabled={isSubmitting}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-full"
                      onClick={() => setActiveQuestion(null)}
                      disabled={isSubmitting}
                    >
                      Abbrechen
                    </button>
                    <button
                      className="px-4 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-full disabled:opacity-50"
                      onClick={handleSubmit}
                      disabled={isSubmitting || !draftAnswer.trim()}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="w-full px-4 py-3 text-sm font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex justify-center"
                  onClick={() => {
                    setActiveQuestion(q.id);
                    setDraftAnswer('');
                  }}
                >
                  Frage beantworten
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
