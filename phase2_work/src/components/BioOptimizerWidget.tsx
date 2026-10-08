import { useState } from "react";
import { Sparkles, Wand2, Copy, CheckCircle2 } from "lucide-react";
import { askAICoach } from "../lib/api";
import { motion } from "motion/react";

export function BioOptimizerWidget() {
  const [currentBio, setCurrentBio] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!currentBio.trim()) return;
    setIsAnalyzing(true);
    setFeedback(null);
    try {
      const prompt = `Du bist ein Dating-Coach für authentisches Auftreten. Analysiere die folgende Dating-App-Bio und mache konkrete Vorschläge zur Verbesserung. Die Bio soll authentisch, sympathisch und nicht generisch wirken. Mache am Ende 2-3 konkrete Vorschläge für eine neue Bio.

Aktuelle Bio: "${currentBio}"`;

      const response = await askAICoach(prompt);
      setFeedback(response);
    } catch {
      setFeedback("Es gab einen Fehler bei der Analyse. Bitte versuche es später noch einmal.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = () => {
    if (!feedback) return;
    navigator.clipboard.writeText(feedback);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
        <h3 className="text-lg font-medium mb-1 text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Wand2 className="text-brand dark:text-brand-light" size={20} />
          Profil-Bio Optimierung
        </h3>
        <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
          Lass deine Bio von der KI auf Authentizität und Attraktivität prüfen und dir konkrete Vorschläge machen.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-2">
              Deine aktuelle Bio
            </label>
            <textarea
              value={currentBio}
              onChange={(e) => setCurrentBio(e.target.value)}
              placeholder="Füge hier deinen Profiltext ein..."
              className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-700 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 min-h-[120px] resize-none"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!currentBio.trim() || isAnalyzing}
            className="w-full py-3 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Sparkles className="" size={16} />
                Analysiere Profil...
              </>
            ) : (
              <>
                <Wand2 size={16} />
                Bio optimieren
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-brand/5 dark:bg-brand-light/5 border border-brand/20 dark:border-brand-light/20 rounded-2xl p-5 shadow-sm relative"
        >
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-brand dark:text-brand-light flex items-center gap-2">
              <Sparkles size={18} />
              Coach Feedback
            </h4>
            <button
              onClick={copyToClipboard}
              className="text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
              title="Feedback kopieren"
            >
              {copied ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
            {feedback}
          </div>
        </motion.div>
      )}
    </div>
  );
}
