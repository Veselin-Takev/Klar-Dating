import { useState } from "react";
import { Sparkles, Heart, Calendar, CheckCircle2,  } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function PrePostDateVibeWidget() {
  const [mode, setMode] = useState<'pre' | 'post' | 'done'>('pre');
  const [preFeeling, setPreFeeling] = useState(50);
  const [postFeeling, setPostFeeling] = useState(50);
  const [dateName, setDateName] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handlePreDateSubmit = () => {
    if (!dateName) return;
    setMode('post');
  };

  const handlePostDateSubmit = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/reflection-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Math.round(postFeeling / 20), matchName: dateName })
      });
      const data = await response.text().then(text => text ? JSON.parse(text) : {});
      if (data.questions && data.questions.length > 0) {
        setAiPrompt(data.questions[0]);
      } else {
        setAiPrompt("Was hast du heute über dich gelernt?");
      }
    } catch (e) {
      setAiPrompt("Was hast du heute über dich gelernt?");
    } finally {
      setIsGenerating(false);
      setMode('done');
    }
  };

  const reset = () => {
    setMode('pre');
    setPreFeeling(50);
    setPostFeeling(50);
    setDateName("");
    setAiPrompt("");
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm h-full flex flex-col justify-center">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Heart size={18} className="text-brand dark:text-brand-light" />
          Dating-Vibe-Check
        </h3>
        {mode !== 'pre' && (
          <button onClick={reset} className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors">
            Neues Date
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'pre' && (
          <motion.div
            key="pre"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col justify-center space-y-4"
          >
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1.5">Wer ist dein Date?</label>
              <input
                type="text"
                placeholder="Name oder Aktivität"
                value={dateName}
                onChange={e => setDateName(e.target.value)}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-stone-900 dark:text-stone-100"
              />
            </div>
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">Wie fühlst du dich jetzt?</label>
                <span className="text-[10px] text-stone-400">{preFeeling >= 70 ? 'Aufgeregt' : preFeeling >= 40 ? 'Ruhig' : 'Nervös'}</span>
              </div>
              <input
                type="range"
                min="0" max="100"
                value={preFeeling}
                onChange={e => setPreFeeling(Number(e.target.value))}
                className="w-full accent-brand dark:accent-brand-light"
              />
            </div>
            <button
              onClick={handlePreDateSubmit}
              disabled={!dateName}
              className="w-full bg-brand dark:bg-brand-light text-white dark:text-stone-900 font-medium py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
            >
              Vibe speichern
            </button>
          </motion.div>
        )}

        {mode === 'post' && (
          <motion.div
            key="post"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col justify-center space-y-4"
          >
            <div className="text-center">
              <Calendar size={24} className="text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-1">Dein Date mit {dateName} ist vorbei.</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">Wie war es insgesamt?</p>
            </div>
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-[10px] text-stone-400">Eher schlecht</span>
                <span className="text-[10px] text-stone-400">Fantastisch</span>
              </div>
              <input
                type="range"
                min="0" max="100"
                value={postFeeling}
                onChange={e => setPostFeeling(Number(e.target.value))}
                className="w-full accent-brand dark:accent-brand-light"
              />
            </div>
            <button
              onClick={handlePostDateSubmit}
              disabled={isGenerating}
              className="w-full bg-brand dark:bg-brand-light text-white dark:text-stone-900 font-medium py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? <Sparkles size={16} className="" /> : <Sparkles size={16} />}
              Reflexion starten
            </button>
          </motion.div>
        )}

        {mode === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col justify-center space-y-3 text-center"
          >
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
            <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Deine KI-Reflexion</h4>
            <div className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 p-4 rounded-2xl text-sm text-stone-700 dark:text-stone-300 italic">
              "{aiPrompt}"
            </div>
            <p className="text-xs text-stone-500">
              Nimm diesen Gedanken mit in dein Tagebuch.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
