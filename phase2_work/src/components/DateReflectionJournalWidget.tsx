import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { BookHeart, Sparkles, Send, Star, } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { askAICoach, fetchReflectionQuestions } from "../lib/api";
import { melde } from "../lib/fehler";

interface Reflection {
  id: string;
  date: string;
  matchName?: string;
  rating?: number;
  positive: string;
  negative: string;
  valuesMatched?: string;
  expectationsMet?: string;
  learned: string;
  insight: string;
  emotionalTone?: string;
}

export function DateReflectionJournalWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [step, setStep] = useState(1);

  const [matchName, setMatchName] = useState("");
  const [rating, setRating] = useState(0);
  const [positive, setPositive] = useState("");
  const [negative, setNegative] = useState("");
  const [valuesMatched, setValuesMatched] = useState("");
  const [expectationsMet, setExpectationsMet] = useState("");
  const [learned, setLearned] = useState("");
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiAnswers, setAiAnswers] = useState<string[]>(['', '', '']);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_reflections");
    if (saved) {
      setReflections(JSON.parse(saved));
    }
  }, []);

  const saveReflection = (newReflections: Reflection[]) => {
    setReflections(newReflections);
    void fetch('/api/activation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventName: 'date_reflected' }) }).catch(() => {});
    klarStorage.setItem("klar_date_reflections", JSON.stringify(newReflections));

    // Check if we also want to push rating to klar_date_history
    if (rating > 0 && matchName) {
      try {
        const historySaved = klarStorage.getItem("klar_date_history");
        let history = historySaved ? JSON.parse(historySaved) : [];
        // Add minimal entry
        history.push({
          id: Date.now().toString() + "_hist",
          title: "Date Reflexion",
          date: new Date().toLocaleDateString('de-DE'),
          matchName: matchName,
          rating: rating,
          note: learned
        });
        klarStorage.setItem("klar_date_history", JSON.stringify(history));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  };

  const handleSubmit = async () => {
    if (aiQuestions.length === 0 && !positive.trim() && !negative.trim() && !learned.trim()) return;

    setIsLoading(true);

    try {
      const positiveContent = aiQuestions.length > 0 ? (aiAnswers[0] || positive) : positive;
      const negativeContent = aiQuestions.length > 0 ? (aiAnswers[1] || negative) : negative;
      const learnedContent = aiQuestions.length > 0 ? (aiAnswers[2] || learned) : learned;

      const prompt = `Analysiere die emotionale Grundstimmung dieses Date-Journals:
Verbindung: "${matchName}"
Bewertung: ${rating}/5
Reflexion 1: "${positiveContent}"
Reflexion 2: "${negativeContent}"
Reflexion 3: "${learnedContent}"

Gib deine Antwort als reines JSON-Objekt zurück mit genau dieser Struktur:
{
  "emotionalTone": "Ein kurzes Wort oder Emoji, das die emotionale Grundstimmung des Textes beschreibt (z.B. Hoffnungsvoll ✨, Frustriert 🌧️, Ausgeglichen 🌿)",
  "insight": "Ein kurzer, einfühlsamer Coaching-Hinweis (2-3 Sätze), der den emotionalen Ton aufgreift und dem Nutzer hilft, die Erfahrung konstruktiv einzuordnen."
}`;

      const response = await askAICoach(prompt);

      let parsedTone = "";
      let parsedInsight = response.trim();

      try {
        let jsonStr = response;
        if (jsonStr.includes("```json")) {
            jsonStr = (jsonStr.split("```json")[1] || "").split("```")[0] || "";
        } else if (jsonStr.includes("```")) {
            jsonStr = jsonStr.split("```")[1] || "";
        }

        const data = JSON.parse(jsonStr.trim());
        if (data.emotionalTone) parsedTone = data.emotionalTone;
        if (data.insight) parsedInsight = data.insight;
      } catch (e) {
        console.warn("Failed to parse AI JSON response", e);
      }

      const newReflection: Reflection = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('de-DE'),
        matchName,
        rating,
        positive: positiveContent,
        negative: negativeContent,
        valuesMatched: aiQuestions.length > 0 ? (aiAnswers[2] || valuesMatched) : valuesMatched,
        expectationsMet,
        learned,
        insight: parsedInsight,
        emotionalTone: parsedTone
      };

      saveReflection([newReflection, ...reflections].slice(0, 10)); // Keep last 10
      resetForm();
    } catch (e) {
      console.warn("Failed to analyze reflection", e);
      // Fallback
      const newReflection: Reflection = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('de-DE'),
        matchName,
        rating,
        positive: aiQuestions.length > 0 ? (aiAnswers[0] || positive) : positive,
        negative: aiQuestions.length > 0 ? (aiAnswers[1] || negative) : negative,
        valuesMatched: aiQuestions.length > 0 ? (aiAnswers[2] || valuesMatched) : valuesMatched,
        expectationsMet,
        learned,
        insight: "Deine Antworten deuten darauf hin, dass bestimmte Werte für dich nicht verhandelbar sind. Nutze diese Erkenntnis, um zukünftige Verbindungen noch gezielter auszuwählen."
      };
      saveReflection([newReflection, ...reflections].slice(0, 10));
      resetForm();
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToQuestions = async () => {
    setStep(2);
    if (aiQuestions.length === 0) {
      setIsLoading(true);
      try {
        const questions = await fetchReflectionQuestions(rating, matchName);
        setAiQuestions(questions.slice(0, 3));
      } catch (e) {
        melde("DateReflectionJournalWidget", e);
        setAiQuestions([
          "Was lief an diesem Date besonders gut?",
          "Wurden deine Kernwerte in Gesprächen oder Taten widergespiegelt?",
          "Was nimmst du für künftige Dates mit?"
        ]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const resetForm = () => {
    setMatchName("");
    setRating(0);
    setPositive("");
    setNegative("");
    setValuesMatched("");
    setExpectationsMet("");
    setLearned("");
    setStep(1);
    setIsAdding(false);
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookHeart size={20} className="text-brand dark:text-brand-light" />
            Deep-Reflection Journal
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Muster in Präferenzen erkennen
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs font-medium text-white bg-brand dark:bg-brand-light dark:text-stone-900 px-4 py-2 rounded-full hover:opacity-90 transition-opacity shadow-sm"
          >
            + Neues Date reflektieren
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="adding"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3 h-full"
            >
              {step === 1 && (
                <div className="space-y-4 py-2">
                  <div>
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-1 block">Mit wem war das Date?</label>
                    <input
                      type="text"
                      value={matchName}
                      onChange={(e) => setMatchName(e.target.value)}
                      placeholder="Name des Verbindungen"
                      className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-stone-700 dark:text-stone-300 mb-2 block">Wie würdest du es insgesamt bewerten?</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`p-2 rounded-full transition-colors ${rating >= star ? 'text-amber-400 bg-amber-50 dark:bg-amber-900/20' : 'text-stone-300 dark:text-stone-600 bg-stone-50 dark:bg-stone-800'}`}
                        >
                          <Star size={24} className={rating >= star ? "fill-amber-400" : ""} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    <button onClick={resetForm} className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700">Abbrechen</button>
                    <button onClick={handleProceedToQuestions} disabled={!matchName || rating === 0} className="px-4 py-2 text-xs font-medium bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100 rounded-xl disabled:opacity-50">Weiter</button>
                  </div>
                </div>
              )}


              {step === 2 && (
                <div className="space-y-4 py-2">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-8 text-stone-500">
                      <Sparkles className=" mb-3 text-brand" size={24} />
                      <p className="text-xs font-medium  text-center px-4">
                        Analysiere Date-Kontext und generiere tiefe Reflexionsfragen...
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {aiQuestions.map((question, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <label className="text-xs font-medium text-stone-700 dark:text-stone-300 leading-snug">
                            {question}
                          </label>
                          <textarea
                            value={aiAnswers[idx]}
                            onChange={(e) => {
                              const newAnswers = [...aiAnswers];
                              newAnswers[idx] = e.target.value;
                              setAiAnswers(newAnswers);
                            }}
                            placeholder="Deine Gedanken..."
                            className="w-full px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-sm focus:outline-none min-h-[60px]"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 justify-between mt-4">
                    <button onClick={() => setStep(1)} className="px-4 py-2 text-xs font-medium text-stone-500 hover:text-stone-700">Zurück</button>
                    {!isLoading && (
                      <button
                        onClick={handleSubmit}
                        disabled={isLoading || aiAnswers.some(a => !a.trim())}
                        className="px-4 py-2 text-xs font-medium bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isLoading ? <Sparkles size={14} className="" /> : <Send size={14} />}
                        Speichern
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : reflections.length > 0 ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 pb-4"
            >
              {reflections.map((ref) => (
                <div key={ref.id} className="p-4 rounded-2xl border border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/20 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ref.matchName || "Date"}</span>
                      {ref.rating && (
                        <div className="flex items-center gap-0.5 bg-white dark:bg-stone-800 px-1.5 py-0.5 rounded-md border border-stone-100 dark:border-stone-700">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span className="text-[10px] font-medium text-stone-700 dark:text-stone-300">{ref.rating}</span>
                        </div>
                      )}
                      {ref.emotionalTone && (
                        <span className="text-[10px] bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light px-2 py-0.5 rounded-md font-medium">
                          {ref.emotionalTone}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{ref.date}</span>
                  </div>

                  <div className="space-y-3 mt-1">
                    {ref.positive && (
                      <div className="flex items-start gap-2">
                        <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-stone-500 block mb-0.5">Reflexion 1</span>
                          <p className="text-xs text-stone-700 dark:text-stone-300 leading-snug">{ref.positive}</p>
                        </div>
                      </div>
                    )}
                    {ref.negative && (
                      <div className="flex items-start gap-2">
                        <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-stone-500 block mb-0.5">Reflexion 2</span>
                          <p className="text-xs text-stone-700 dark:text-stone-300 leading-snug">{ref.negative}</p>
                        </div>
                      </div>
                    )}
                    {ref.valuesMatched && (
                      <div className="flex items-start gap-2">
                        <Sparkles size={14} className="text-brand shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-stone-500 block mb-0.5">Reflexion 3</span>
                          <p className="text-xs text-stone-700 dark:text-stone-300 leading-snug">{ref.valuesMatched}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {ref.insight && (
                    <div className="flex gap-2 items-start bg-brand/5 dark:bg-brand-light/10 p-3 rounded-xl mt-2 border border-brand/10 dark:border-brand-light/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Sparkles size={40} />
                      </div>
                      <Sparkles size={16} className="text-brand dark:text-brand-light shrink-0 mt-0.5 relative z-10" />
                      <div className="relative z-10">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand/70 dark:text-brand-light/70 mb-1">KI-Musteranalyse</p>
                        <p className="text-xs text-stone-800 dark:text-stone-200 font-medium leading-relaxed">
                          {ref.insight}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center py-8"
            >
              <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4 text-stone-300 dark:text-stone-600">
                <BookHeart size={28} />
              </div>
              <p className="text-sm font-medium text-stone-900 dark:text-stone-100 mb-1">Noch keine Journal-Einträge</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 px-6">
                Reflektiere deine Dates tiefergehend, um verborgene Muster in deinen Werten und Erwartungen zu entdecken.
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-6 text-sm font-medium text-brand dark:text-brand-light bg-brand/10 dark:bg-brand-light/10 px-5 py-2.5 rounded-xl hover:bg-brand/20 transition-colors"
              >
                Ersten Eintrag starten
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
