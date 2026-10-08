import { klarStorage } from '../lib/userScopedStorage';
import { useState } from "react";
import { Sparkles, Map } from "lucide-react";
import { motion } from "motion/react";
import type { Profile } from "../data";
import { melde } from "../lib/fehler";

interface VerbindungOptimizerWidgetProps {
  userInterests: string[];
  profile: Profile;
}

export function VerbindungOptimizerWidget({ userInterests, profile }: VerbindungOptimizerWidgetProps) {
  const [ideas, setIdeas] = useState<{title: string, description: string, tag: string}[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDateIdeas = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const likedInterestsRaw = klarStorage.getItem('klar_interactions_like');
      const likedInterests = likedInterestsRaw ? JSON.parse(likedInterestsRaw) : [];
      const interactionSummary = likedInterests.length > 0
        ? `Der Nutzer hat in der Vergangenheit häufig Profile mit diesen Interessen positiv ausgewählt: ${likedInterests.slice(-5).join(', ')}`
        : "Noch keine Kontakt-Historie.";

      const res = await fetch("/api/verbindung-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInterests,
          targetProfile: profile,
          pastInteractions: interactionSummary
        })
      });

      if (!res.ok) {
        const errorData = await res.text().then(text => text ? JSON.parse(text) : {}).catch(() => ({}));
        throw new Error(errorData.error || "Fehler beim Laden der Date-Ideen.");
      }

      const data = await res.text().then(text => text ? JSON.parse(text) : {});
      setIdeas(data.concepts);
    } catch (e) {
      melde("VerbindungOptimizerWidget", e);
      setError(e instanceof Error ? e.message : "Date-Ideen konnten leider nicht geladen werden.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 mb-4">
      <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-200 dark:border-stone-700 pb-2 flex items-center gap-2">
        <Map size={18} className="text-brand dark:text-brand-light" />
        Verbindung-Optimierer (Date-Ideen)
      </h3>

      {!ideas && !isLoading && !error && (
        <button
          onClick={fetchDateIdeas}
          className="w-full py-4 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl flex items-center justify-center gap-2 transition-all font-medium border border-stone-200 dark:border-stone-700"
        >
          <Sparkles size={18} className="text-brand dark:text-brand-light" />
          Kreative Date-Konzepte generieren
        </button>
      )}

      {isLoading && (
        <div className="w-full py-8 flex flex-col items-center justify-center text-stone-500 gap-3 border border-stone-100 dark:border-stone-700 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-stone-200 dark:bg-stone-700  mb-3"></div>
          <span className="text-sm">Analysiere Profile und generiere Ideen...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 rounded-xl text-sm border border-rose-100 dark:border-rose-900/30">
          {error}
        </div>
      )}

      {ideas && (
        <div className="space-y-3">
          {ideas.map((idea, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-4 shadow-sm relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-3">
                <span className="text-[10px] uppercase font-bold text-brand dark:text-brand-light bg-brand/10 dark:bg-brand-light/10 px-2 py-1 rounded-full">
                  {idea.tag}
                </span>
              </div>
              <h4 className="font-semibold text-stone-900 dark:text-stone-100 mb-1 pr-16">{idea.title}</h4>
              <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">{idea.description}</p>
            </motion.div>
          ))}

          <button
            onClick={fetchDateIdeas}
            className="w-full mt-2 py-2.5 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 font-medium transition-colors"
          >
            Neue Vorschläge generieren
          </button>
        </div>
      )}
    </div>
  );
}
