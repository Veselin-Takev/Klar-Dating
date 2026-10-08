import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowRight, RefreshCcw, BookOpen, UserCircle } from "lucide-react";

type QuizQuestion = {
  id: number;
  question: string;
  options: { text: string; category: "analytical" | "intuitive" | "cautious" | "impulsive" }[];
};

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Wie wählst du normalerweise deine Dates aus?",
    options: [
      { text: "Ich analysiere Profile genau und suche nach gemeinsamen Interessen.", category: "analytical" },
      { text: "Ich verlasse mich stark auf mein Bauchgefühl und den Vibe der Fotos.", category: "intuitive" },
      { text: "Ich schreibe lange hin und her, bevor ich mich zu einem Treffen entschließe.", category: "cautious" },
      { text: "Ich entscheide spontan und treffe mich am liebsten sofort auf einen Kaffee.", category: "impulsive" },
    ]
  },
  {
    id: 2,
    question: "Wie verhältst du dich nach einem großartigen ersten Date?",
    options: [
      { text: "Ich reflektiere, was gut lief und schreibe am nächsten Tag eine wohlüberlegte Nachricht.", category: "analytical" },
      { text: "Ich folge meinem Impuls und schreibe direkt auf dem Heimweg, wie schön es war.", category: "intuitive" },
      { text: "Ich warte erst einmal ab, ob sich die andere Person meldet.", category: "cautious" },
      { text: "Ich frage am besten noch am selben Abend direkt nach dem nächsten Date.", category: "impulsive" },
    ]
  },
  {
    id: 3,
    question: "Wenn ihr bei einem Thema völlig unterschiedlicher Meinung seid...",
    options: [
      { text: "Wäge ich ab, ob dieser Unterschied ein grundsätzliches Kompatibilitätsproblem ist.", category: "analytical" },
      { text: "Achte ich darauf, wie sich die Diskussion emotional anfühlt.", category: "intuitive" },
      { text: "Wechsle ich lieber das Thema, um Konflikte beim Kennenlernen zu vermeiden.", category: "cautious" },
      { text: "Diskutiere ich leidenschaftlich gerne und teile sofort meine ungefilterte Meinung.", category: "impulsive" },
    ]
  },
  {
    id: 4,
    question: "Ab wann wird es für dich 'exklusiv'?",
    options: [
      { text: "Nachdem wir unsere Erwartungen offen besprochen und klare Grenzen definiert haben.", category: "analytical" },
      { text: "Wenn es sich für beide organisch und richtig anfühlt, ohne großen Masterplan.", category: "intuitive" },
      { text: "Erst nach vielen Monaten, ich brauche viel Sicherheit und Vertrauen.", category: "cautious" },
      { text: "Sehr schnell, wenn es funkt, verliere ich oft das Interesse an anderen.", category: "impulsive" },
    ]
  }
];

const STYLE_RESULTS = {
  analytical: {
    title: "Der analytische Stratege",
    description: "Du gehst Dating systematisch und durchdacht an. Du weißt genau, was du willst und analysierst Kompatibilität frühzeitig. Das bewahrt dich vor bösen Überraschungen, kann aber manchmal den Zauber der Spontanität bremsen.",
    advice: "Lass hin und wieder das Herz über den Verstand siegen. Nicht alles lässt sich beim ersten Date rational bewerten.",
    articles: [
      { title: "Warum der perfekte Checklisten-Partner nicht immer glücklich macht", category: "Mindset" },
      { title: "Kopf vs. Bauchgefühl beim Kennenlernen", category: "Psychologie" }
    ]
  },
  intuitive: {
    title: "Der intuitive Gefühlsmensch",
    description: "Für dich zählen der Vibe, die Chemie und das Bauchgefühl. Du lässt dich auf Begegnungen ein und spürst schnell, ob jemand zu dir passt. Pass auf, dass du vor lauter Emotionen nicht wichtige Red Flags übersiehst.",
    advice: "Kombiniere deine starke Intuition mit ein wenig gesundem Realismus. Sprich wichtige Themen frühzeitig an.",
    articles: [
      { title: "Red Flags vs. Pink Flags: So schützt du deine Grenzen", category: "Sicherheit" },
      { title: "Emotionale Tiefe ohne Love Bombing", category: "Kommunikation" }
    ]
  },
  cautious: {
    title: "Der zurückhaltende Beobachter",
    description: "Sicherheit und Vertrauen stehen für dich an erster Stelle. Du lässt dir Zeit beim Kennenlernen und gibst nicht sofort alles von dir preis. Das schützt dich, kann aber von anderen manchmal als Desinteresse missverstanden werden.",
    advice: "Trau dich, etwas früher aus dir herauszugehen. Ein bisschen mehr Proaktivität kann Wunder wirken.",
    articles: [
      { title: "Authentisch kommunizieren: Wie du Interesse zeigst ohne dich zu verstellen", category: "Klartext" },
      { title: "Die Kunst des ersten Schrittes", category: "Verhalten" }
    ]
  },
  impulsive: {
    title: "Der leidenschaftliche Impulsive",
    description: "Du bist spontan, direkt und gehst aufs Ganze. Du stürzt dich gerne in neue Abenteuer und verliebst dich schnell. Diese Begeisterung ist ansteckend, birgt aber die Gefahr, dass du nach der ersten Euphorie schnell das Interesse verlierst.",
    advice: "Nimm manchmal das Tempo etwas raus. Lerne die Person hinter der ersten Faszination in Ruhe kennen.",
    articles: [
      { title: "Slow Dating: Warum weniger Tempo oft mehr Tiefe bringt", category: "Gesundes Dating" },
      { title: "Situationships vermeiden durch klare Intentionen", category: "Klartext" }
    ]
  }
};

export function DatingStyleQuizWidget() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isFinished, setIsFinished] = useState(false);
  const [resultKey, setResultKey] = useState<"analytical" | "intuitive" | "cautious" | "impulsive" | null>(null);

  const handleAnswer = (category: string) => {
    setAnswers({ ...answers, [currentStep]: category });

    if (currentStep < QUIZ_QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      calculateResult({ ...answers, [currentStep]: category });
    }
  };

  const calculateResult = (finalAnswers: Record<number, string>) => {
    const counts = { analytical: 0, intuitive: 0, cautious: 0, impulsive: 0 };
    Object.values(finalAnswers).forEach(cat => {
      counts[cat as keyof typeof counts]++;
    });

    let highestCat = "intuitive";
    let max = -1;
    Object.entries(counts).forEach(([key, val]) => {
      if (val > max) {
        max = val;
        highestCat = key;
      }
    });

    setResultKey(highestCat as unknown);
    setIsFinished(true);
  };

  const resetQuiz = () => {
    setCurrentStep(0);
    setAnswers({});
    setIsFinished(false);
    setResultKey(null);
  };

  if (isFinished && resultKey) {
    const result = STYLE_RESULTS[resultKey];
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 p-8 opacity-5 dark:opacity-10 pointer-events-none">
          <UserCircle size={120} />
        </div>

        <div className="mb-6 relative z-10">
          <div className="inline-flex items-center justify-center p-3 bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light rounded-xl mb-4">
            <Sparkles size={24} />
          </div>
          <h3 className="text-2xl font-serif text-stone-900 dark:text-stone-100 mb-2">
            Dein Dating-Stil:<br/>
            <span className="text-brand dark:text-brand-light">{result.title}</span>
          </h3>
          <p className="text-stone-600 dark:text-stone-400 text-sm leading-relaxed mb-6">
            {result.description}
          </p>

          <div className="bg-stone-50 dark:bg-stone-950 rounded-2xl p-5 border border-stone-100 dark:border-stone-700 mb-6">
            <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 mb-2 flex items-center gap-2">
              <Sparkles size={16} className="text-amber-500" />
              Coach-Tipp für dich
            </h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 italic">
              "{result.advice}"
            </p>
          </div>

          <h4 className="font-medium text-stone-900 dark:text-stone-100 mb-3 flex items-center gap-2">
            <BookOpen size={18} className="text-brand dark:text-brand-light" />
            Leseempfehlungen für dich
          </h4>
          <div className="space-y-3 mb-6">
            {result.articles.map((article, idx) => (
              <div key={idx} className="group p-4 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-brand/30 dark:hover:border-brand-light/30 rounded-xl flex items-center justify-between cursor-pointer transition-colors">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 mb-1 block">{article.category}</span>
                  <p className="text-sm font-medium text-stone-800 dark:text-stone-200 group-hover:text-brand dark:group-hover:text-brand-light transition-colors">{article.title}</p>
                </div>
                <ArrowRight size={16} className="text-stone-300 dark:text-stone-600 group-hover:text-brand dark:group-hover:text-brand-light transition-colors" />
              </div>
            ))}
          </div>

          <button
            onClick={resetQuiz}
            className="w-full py-3 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCcw size={16} /> Quiz wiederholen
          </button>
        </div>
      </motion.div>
    );
  }

  const question = QUIZ_QUESTIONS[currentStep];
  if (!question) return null;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <UserCircle className="text-brand dark:text-brand-light" size={20} />
          Finde deinen Dating-Stil
        </h3>
        <span className="text-xs font-medium text-stone-500 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full">
          Frage {currentStep + 1} / {QUIZ_QUESTIONS.length}
        </span>
      </div>

      <div className="mb-6">
        <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-brand dark:bg-brand-light"
            initial={{ width: `${(currentStep / QUIZ_QUESTIONS.length) * 100}%` }}
            animate={{ width: `${((currentStep) / QUIZ_QUESTIONS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <h4 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-6 leading-snug">
          {question.question}
        </h4>

        <div className="space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {question.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(option.category)}
                  className="w-full text-left p-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950 hover:bg-brand/5 dark:hover:bg-brand-light/5 hover:border-brand/30 dark:hover:border-brand-light/30 transition-all text-sm text-stone-700 dark:text-stone-300"
                >
                  {option.text}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
