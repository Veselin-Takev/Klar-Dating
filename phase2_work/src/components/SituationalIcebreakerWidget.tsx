import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { MessageCircleHeart, Copy, Sparkles, CheckCircle2, Bookmark, X } from 'lucide-react';
import { motion, AnimatePresence } from "motion/react";
import { fetchIcebreaker } from "../lib/api";
import { melde } from "../lib/fehler";

interface SituationalIcebreakerWidgetProps {
  userInterests: string[];
  profiles?: Array<{ id: string; name: string; age: number; interests: string[] }>;
}

export function SituationalIcebreakerWidget({ userInterests, profiles = [] }: SituationalIcebreakerWidgetProps) {
  const [uiError, setUiError] = useState<string | null>(null);

  const [icebreaker, setIcebreaker] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [savedIcebreakers, setSavedIcebreakers] = useState<string[]>([]);

  useEffect(() => {
    const stored = klarStorage.getItem('klar_saved_icebreakers');
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        setSavedIcebreakers(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const saveIcebreaker = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    let updated;
    if (savedIcebreakers.includes(text)) {
      updated = savedIcebreakers.filter(t => t !== text);
    } else {
      updated = [text, ...savedIcebreakers];
    }
    setSavedIcebreakers(updated);
    klarStorage.setItem('klar_saved_icebreakers', JSON.stringify(updated));
  };

  type MatchProfile = NonNullable<SituationalIcebreakerWidgetProps['profiles']>[number];
  const [selectedMatch, setSelectedMatch] = useState<MatchProfile | null>(null);

  useEffect(() => {
    // Select the first verbindung by default if available
    if (profiles && profiles.length > 0) {
      setSelectedMatch(profiles[0]);
    }
  }, []);

  const generateIcebreaker = async (verbindung?: MatchProfile) => {
    const currentMatch = verbindung || selectedMatch;
    if (!currentMatch) return;

    setIsLoading(true);
    setCopied(false);
    try {
      const matchContext = {
        name: currentMatch.name,
        bio: currentMatch.bio,
        interests: currentMatch.interests
      };

      const result = await fetchIcebreaker(userInterests, matchContext);
      setIcebreaker(result.icebreaker);
      setReasoning(result.reasoning);
    } catch (error) {
      melde("SituationalIcebreakerWidget", error);
      setIcebreaker("");
      setReasoning("Die KI-Generierung war nicht verfügbar. Bitte versuche es später erneut.");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate on initial load when verbindung is set
  useEffect(() => {
    if (selectedMatch && !icebreaker && !isLoading) {
      generateIcebreaker(selectedMatch);
    }
  }, [selectedMatch]);

  const copyToClipboard = () => {
    if (!icebreaker) return;
    navigator.clipboard.writeText(icebreaker);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMatchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const matchId = e.target.value;
    const verbindung = profiles.find(p => p.id === matchId);
    if (verbindung) {
      setSelectedMatch(verbindung);
      generateIcebreaker(verbindung);
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <MessageCircleHeart size={20} className="text-amber-500 dark:text-amber-400" />
            Situativer Icebreaker
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Kreative Einstiege passend zum Kontext
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1 block">
          Verbindung auswählen
        </label>
        <select
          value={selectedMatch?.id || ""}
          onChange={handleMatchChange}
          className="w-full text-sm p-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500 transition-colors"
        >
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-6 text-stone-500"
            >
              <Sparkles className=" mb-3 text-amber-500" size={24} />
              <p className="text-sm font-medium ">Schmiede den perfekten Icebreaker...</p>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col h-full"
            >
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-2xl p-4 mb-3 relative group">
                <p className="text-sm text-stone-900 dark:text-stone-100 font-medium italic leading-relaxed">
                  "{icebreaker}"
                </p>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => saveIcebreaker(e, icebreaker)}
                    className={`p-2 border rounded-xl shadow-sm transition-colors ${savedIcebreakers.includes(icebreaker) ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400' : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700 text-stone-500 hover:text-amber-500 dark:hover:text-amber-400'}`}
                    title="Speichern für später"
                  >
                    <Bookmark size={16} className={savedIcebreakers.includes(icebreaker) ? 'fill-current' : ''} />
                  </button>
                  <button
                    onClick={copyToClipboard}
                    className="p-2 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl shadow-sm text-stone-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                    title="Kopieren"
                  >
                    {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>

              </div>

              <div className="px-1 mb-4 flex-1">
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-snug flex gap-2">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">Warum das klappt:</span>
                  <span>{reasoning}</span>
                </p>
              </div>

              <button
                onClick={() => generateIcebreaker()}
                className="w-full flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 py-3 rounded-xl text-sm font-medium transition-colors border border-stone-200 dark:border-stone-700"
              >
                <span className="w-4 h-4 rounded-full bg-current opacity-50 "></span>
                Neuen generieren
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {savedIcebreakers.length > 0 && (
        <div className="mt-6 pt-4 border-t border-stone-100 dark:border-stone-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Gespeicherte Icebreaker ({savedIcebreakers.length})</h4>
            <button
              onClick={() => {
                const textToExport = savedIcebreakers.map(ib => "- " + ib).join('\n');
                if (navigator.share) {
                  navigator.share({ title: 'Meine Icebreaker', text: textToExport }).catch(console.error);
                } else {
                  navigator.clipboard.writeText(textToExport);
                  alert('Gespeicherte Icebreaker in die Zwischenablage kopiert!');
                }
              }}
              className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2 py-1 rounded-md font-medium hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              Exportieren
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1 text-xs text-stone-600 dark:text-stone-400">
            {savedIcebreakers.map((ib, i) => (
              <div key={i} className="bg-stone-50 dark:bg-stone-800/50 p-2 rounded-lg border border-stone-100 dark:border-stone-700 relative group">
                <p className="pr-6 italic leading-relaxed">"{ib}"</p>
                <button
                  onClick={(e) => saveIcebreaker(e, ib)}
                  className="absolute top-2 right-2 text-stone-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Entfernen"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
