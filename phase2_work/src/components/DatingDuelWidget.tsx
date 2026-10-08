import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Swords, Check, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const DUELS = [
  "Eröffne ein Gespräch mit einer Frage über Hobbys.",
  "Schreibe jemanden an, den du normalerweise nicht auswählen würdest.",
  "Mache ein kreatives Kompliment zu einem bestimmten Profilfoto.",
  "Teile einen peinlichen, aber lustigen Moment aus deiner Woche.",
  "Frage nach der kontroversesten Meinung beim Essen (z.B. Ananas auf Pizza).",
  "Lade jemanden direkt auf ein virtuelles Kaffee-Date ein."
];

export function DatingDuelWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [currentDuel, setCurrentDuel] = useState("");
  const [duelState, setDuelState] = useState<'idle' | 'accepted' | 'completed'>('idle');

  useEffect(() => {
    pickRandomDuel();

    // Check if we already have an active/completed duel today
    try {
      const saved = klarStorage.getItem('klar_active_duel');
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toLocaleDateString('de-DE');
        if (parsed.date === today) {
          setCurrentDuel(parsed.text || "");
          setDuelState(parsed.state || "idle");
        }
      }
    } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
  }, []);

  const pickRandomDuel = () => {
    const random = DUELS[Math.floor(0 * DUELS.length)];
    setCurrentDuel(random || "");
  };

  const saveState = (text: string, state: string) => {
    const today = new Date().toLocaleDateString('de-DE');
    klarStorage.setItem('klar_active_duel', JSON.stringify({
      text,
      state,
      date: today
    }));
  };

  const handleAccept = () => {
    setDuelState('accepted');
    saveState(currentDuel, 'accepted');
  };

  const handleComplete = () => {
    setDuelState('completed');
    saveState(currentDuel, 'completed');

    // Add milestone points
    try {
      const currentStats = parseInt(klarStorage.getItem('stats_duels_won') || '0', 10);
      klarStorage.setItem('stats_duels_won', (currentStats + 1).toString());

      const today = new Date().toLocaleDateString('de-DE');
      klarStorage.setItem('stats_dates_duels_won', today); // trigger unlock dates if necessary
    } catch (e) {
      console.warn("Failed to save duel stats", e);
    }
  };

  const handleSkip = () => {
    if (duelState === 'idle') {
      pickRandomDuel();
    }
  };

  return (
    <div className=" from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-5 mb-6 shadow-sm overflow-hidden relative">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="absolute top-0 right-0 p-4 opacity-10">
        <Swords size={100} />
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 p-2 rounded-lg">
          <Swords size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Dating-Duell</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Verdiene Meilenstein-Punkte</p>
        </div>
      </div>

      <div className="relative z-10 bg-white/60 dark:bg-stone-800/60  p-4 rounded-xl border border-white/50 dark:border-stone-700/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentDuel + duelState}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            {duelState === 'completed' ? (
              <div className="py-4 flex flex-col items-center gap-2">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-2">
                  <Check size={24} />
                </div>
                <h4 className="font-medium text-stone-900 dark:text-stone-100">Duell gewonnen!</h4>
                <p className="text-sm text-stone-500">+1 Meilenstein-Punkt gesammelt.</p>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-5 leading-relaxed">
                  "{currentDuel}"
                </p>

                {duelState === 'idle' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSkip}
                      className="flex-1 px-4 py-2 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-full font-medium text-sm hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors border border-stone-200 dark:border-stone-700 flex justify-center items-center gap-1.5"
                    >
                      <RefreshCw size={14} /> Skip
                    </button>
                    <button
                      onClick={handleAccept}
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium text-sm transition-colors shadow-sm shadow-indigo-600/20 flex justify-center items-center gap-1.5"
                    >
                      <Swords size={14} /> Annehmen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleComplete}
                    className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium text-sm transition-colors shadow-sm shadow-green-500/20 flex justify-center items-center gap-1.5"
                  >
                    <Check size={16} /> Mission erfüllt
                  </button>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
