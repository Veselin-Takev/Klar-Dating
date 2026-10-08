import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, ListChecks, CheckSquare, Square } from "lucide-react";
import type { Profile } from "../data";
import { askAICoach } from "../lib/api";
import { melde } from "../lib/fehler";

export function DatePrepChecklistModal({
  profile,
  isOpen,
  onClose,
  userInterests
}: {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
  userInterests: string[];
}) {
  const [topics, setTopics] = useState<{id: string, text: string, checked: boolean}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && topics.length === 0) {
      generateTopics();
    }
  }, [isOpen]);

  const generateTopics = async () => {
    setIsLoading(true);
    try {
      const prompt = `Generiere 4 interessante und natürliche Gesprächsaufhänger (Icebreaker oder Themen) für ein Date mit ${profile.name}.
Ihre Interessen: ${profile.interests.join(", ")}.
Meine Interessen: ${userInterests.join(", ")}.
Finde gemeinsame Themen oder Dinge, über die man leicht reden kann. Gib nur ein JSON-Array mit Strings zurück.`;

      const response = await askAICoach(prompt);

      try {
        const parsed = JSON.parse(response);
        if (Array.isArray(parsed)) {
          setTopics(parsed.map((t, i) => ({ id: `topic-${i}`, text: t, checked: false })));
        }
      } catch (e) {
        // Fallback parsing
        const lines = response.split('\n').filter(l => l.trim().length > 0 && !l.includes('[') && !l.includes(']'));
        setTopics(lines.map((t, i) => ({ id: `topic-${i}`, text: t.replace(/^["'-.\d\s]*/, ''), checked: false })).slice(0, 4));
      }
    } catch (e) {
      melde("DatePrepChecklistModal", e);
      setTopics([
        { id: '1', text: `Nach Lieblingsorten für ${profile.interests[0] || 'Kaffee'} fragen`, checked: false },
        { id: '2', text: `Ein aktuelles Highlight aus dem Bereich ${profile.interests[1] || 'Reisen'} besprechen`, checked: false },
        { id: '3', text: 'Nach einer lustigen Anekdote fragen', checked: false }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCheck = (id: string) => {
    setTopics(topics.map(t => t.id === id ? { ...t, checked: !t.checked } : t));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 "
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-white dark:bg-stone-800 rounded-3xl shadow-md overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-stone-100 dark:border-stone-700 flex justify-between items-center bg-brand/5 dark:bg-brand-light/5">
              <div className="flex items-center gap-2 text-brand dark:text-brand-light">
                <ListChecks size={20} />
                <h3 className="font-bold">Date-Prep Checkliste</h3>
              </div>
              <button
                aria-label="Checkliste schließen"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <p className="text-xs text-stone-500 mb-4">
                Personalisierte Gesprächsthemen basierend auf dem Profil von <span className="font-bold text-stone-700 dark:text-stone-300">{profile.name}</span>.
              </p>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-stone-400">
                  <div className="w-6 h-6 rounded-full bg-stone-200 dark:bg-stone-700 "></div>
                  <span className="text-xs font-medium">Generiere Themen...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {(topics || []).map(topic => (
                    <div
                      key={topic.id}
                      onClick={() => toggleCheck(topic.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                        topic.checked
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                          : 'bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <button className="shrink-0 mt-0.5 focus:outline-none">
                        {topic.checked
                          ? <CheckSquare size={18} className="text-emerald-500" />
                          : <Square size={18} className="text-stone-400" />
                        }
                      </button>
                      <span className={`text-sm ${topic.checked ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70' : 'text-stone-700 dark:text-stone-300'}`}>
                        {topic.text}
                      </span>
                    </div>
                  ))}

                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={generateTopics}
                      className="text-xs font-semibold text-brand dark:text-brand-light flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <Sparkles size={14} /> Neue Themen generieren
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
