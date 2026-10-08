import { useState, useEffect } from 'react';
import { getUserStorageItem, setUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Sparkles, ChevronRight, CheckCircle2 } from 'lucide-react';
import { askAICoach } from '../lib/api';

const QUESTIONS = [
  "Was ist dir bei einem Date am wichtigsten?",
  "Welche Eigenschaft schätzt du an anderen besonders?",
  "Was ist dein idealer Sonntag?",
  "Welches Thema bringt dich sofort ins Reden?",
  "Was ist eine 'Red Flag' für dich?",
  "Bevorzugst du spontane Dates oder gut geplante?",
  "Wie viel Zeit verbringst du gerne mit einem Partner?"
];

export function DailyPulseWidget() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const lastAnswered = klarStorage.getItem('klar_pulse_last_answered');
    const today = new Date().toDateString();

    if (lastAnswered !== today) {
      // Pick a random question based on day
      const dayIndex = new Date().getDay();
      setQuestion(QUESTIONS[dayIndex % QUESTIONS.length] || "Wie geht es dir heute beim Dating?");
      setIsVisible(true);
    }
  }, []);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setIsProcessing(true);

    try {
      // Ask AI to extract a single keyword interest from the answer
      const prompt = `Der Nutzer hat auf die Frage "${question}" folgendes geantwortet: "${answer}".
Bitte extrahiere daraus genau EINE kurze Eigenschaft oder ein Interesse (z.B. "Spontanität", "Natur", "Gute Gespräche", "Humor"), das man als Tag in einem Dating-Profil verwenden kann. Antworte NUR mit diesem einen Wort oder dieser kurzen Phrase. Keine Einleitung, keine Erklärungen.`;

      const aiResponse = await askAICoach(prompt);
      const newInterest = aiResponse.replace(/["\.]/g, '').trim();

      if (newInterest && newInterest.length < 20) {
        const savedInterests = getUserStorageItem('userInterests');
        const parsed: unknown = savedInterests ? JSON.parse(savedInterests) : [];
        const interests: string[] = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
        if (!interests.includes(newInterest)) {
          interests.push(newInterest);
          setUserStorageItem('userInterests', JSON.stringify(interests));
        }
      }
    } catch (e) {
      console.warn("AI extraction failed", e);
    }

    const today = new Date().toDateString();
    klarStorage.setItem('klar_pulse_last_answered', today);

    setIsProcessing(false);
    setAnswered(true);

    setTimeout(() => {
      setIsVisible(false);
    }, 2500);
  };

  if (!isVisible) return null;

  return (
    <div className=" from-brand/10 to-brand-light/20 dark:from-brand/20 dark:to-brand-light/10 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-4 shadow-sm relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand/10 dark:bg-brand-light/10 rounded-full blur-2xl pointer-events-none"></div>

      {!answered ? (
        <>
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <Sparkles size={16} className="text-brand dark:text-brand-light" />
            <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">AI Daily Pulse</h3>
          </div>
          <p className="text-sm text-stone-700 dark:text-stone-300 mb-3 font-medium relative z-10">
            {question}
          </p>
          <div className="flex gap-2 relative z-10">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Deine kurze Antwort..."
              disabled={isProcessing}
              className="flex-1 bg-white/80 dark:bg-black/50 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim() || isProcessing}
              className="bg-brand dark:bg-brand-light text-white dark:text-stone-900 p-2 rounded-xl disabled:opacity-50 transition-opacity flex items-center justify-center w-10"
            >
              {isProcessing ? (
                <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
              ) : (
                <ChevronRight size={18} />
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-3 py-2 text-emerald-600 dark:text-emerald-400 relative z-10">
          <CheckCircle2 size={20} />
          <span className="text-sm font-medium">Danke! Deine Präferenzen wurden verfeinert.</span>
        </div>
      )}
    </div>
  );
}
