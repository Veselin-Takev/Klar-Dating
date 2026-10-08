import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// ENTFERNT 14.08.2026: vier Bilder von `https://i.pravatar.cc`
//
// Die Anleitung zeigte zwei Beispielprofile mit Bildern eines fremden
// Dienstes. Im gebauten Stand hat die CSP sie abgelehnt (`img-src`), acht
// Meldungen je Aufruf.
//
// Nicht die CSP war das Problem. Eine App, die verspricht, dass man nicht
// mit seinen Daten zahlt, sollte fuer eine ANLEITUNG kein fremdes Bild
// nachladen — jeder Aufruf verraet dem Dienst, wer wann welche Anleitung
// oeffnet. An die Stelle treten die Anfangsbuchstaben der beiden
// Beispielnamen, gezeichnet aus dem, was ohnehin da ist.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, ArrowRight, X, Heart, Star, BrainCircuit } from "lucide-react";

export function SmartVerbindungTutorialOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeen = klarStorage.getItem('klar_smart_match_tutorial_seen');
    if (!hasSeen) {
      // Small delay before showing
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const handleShow = () => {
      setStep(0);
      setIsVisible(true);
    };
    window.addEventListener('show-smart-verbindung-tutorial', handleShow);
    return () => window.removeEventListener('show-smart-verbindung-tutorial', handleShow);
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    klarStorage.setItem('klar_smart_match_tutorial_seen', 'true');
  };

  const nextStep = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 "
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white dark:bg-stone-800 w-full max-w-md rounded-3xl overflow-hidden shadow-md border border-stone-200 dark:border-stone-700 relative"
        >
          <button
            aria-label="Einführung schließen"
            onClick={dismiss}
            className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 z-10 transition-colors"
          >
            <X size={18} />
          </button>

          <div className="p-8 pb-6  from-brand/10 to-transparent dark:from-brand-light/10">
            <div className="w-16 h-16 bg-white dark:bg-stone-800 rounded-2xl shadow-sm flex items-center justify-center mb-6 text-brand dark:text-brand-light border border-stone-100 dark:border-stone-700">
              <BrainCircuit size={32} />
            </div>
            <h2 className="text-2xl font-serif font-medium text-stone-900 dark:text-stone-100 mb-2">
              Smart-Verbindung Ranking
            </h2>
            <p className="text-stone-600 dark:text-stone-400 leading-relaxed">
              Erfahre, wie Klar die Kompatibilität berechnet und Profile für dich sortiert.
            </p>
          </div>

          <div className="p-8 pt-0 space-y-6">
            <div className="relative h-48 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-100 dark:border-stone-700 overflow-hidden flex items-center justify-center p-4">

              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="flex items-center justify-between w-full max-w-[240px] p-3 bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-200 dark:border-stone-700 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                          <span aria-hidden="true" className="w-full h-full flex items-center justify-center text-xs font-medium text-stone-500 dark:text-stone-400">A</span>
                        </div>
                        <div className="text-sm font-medium">Alex, 28</div>
                      </div>
                      <div className="flex items-center gap-1 text-stone-500">
                        <Heart size={14} /> 65%
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full max-w-[240px] p-3 bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-200 dark:border-stone-700">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                          <span aria-hidden="true" className="w-full h-full flex items-center justify-center text-xs font-medium text-stone-500 dark:text-stone-400">S</span>
                        </div>
                        <div className="text-sm font-medium">Sam, 31</div>
                      </div>
                      <div className="flex items-center gap-1 text-stone-500">
                        <Heart size={14} /> 50%
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 text-center mt-4 font-medium">Standard: Sortiert nach Basis-Interessen</p>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col items-center w-full relative"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-3 right-8 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 flex items-center gap-1 shadow-md"
                    >
                      <Sparkles size={10} /> Must-have!
                    </motion.div>
                    <div className="flex items-center justify-between w-full max-w-[240px] p-3 bg-brand/10 dark:bg-brand-light/10 rounded-xl shadow-sm border border-brand/30 dark:border-brand-light/30 mb-3 relative overflow-hidden">
                      <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: '100%' }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        className="absolute inset-0  from-transparent via-brand/10 to-transparent skew-x-12"
                      />
                      <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden border-2 border-brand dark:border-brand-light">
                          <span aria-hidden="true" className="w-full h-full flex items-center justify-center text-xs font-medium text-stone-500 dark:text-stone-400">S</span>
                        </div>
                        <div className="text-sm font-medium">Sam, 31</div>
                      </div>
                      <div className="flex items-center gap-1 text-brand dark:text-brand-light font-bold relative z-10">
                        <Star size={14} className="fill-current" /> 150%
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full max-w-[240px] p-3 bg-white dark:bg-stone-800 rounded-xl shadow-sm border border-stone-200 dark:border-stone-700 opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                          <span aria-hidden="true" className="w-full h-full flex items-center justify-center text-xs font-medium text-stone-500 dark:text-stone-400">A</span>
                        </div>
                        <div className="text-sm font-medium">Alex, 28</div>
                      </div>
                      <div className="flex items-center gap-1 text-stone-500">
                        <Heart size={14} /> 65%
                      </div>
                    </div>
                    <p className="text-xs text-stone-500 text-center mt-4 font-medium px-4">
                      +100 Punkte für geteilte Must-haves! Sam wird nach ganz oben gepusht.
                    </p>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex flex-col items-center w-full"
                  >
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                      <Sparkles size={32} />
                    </div>
                    <h4 className="text-lg font-medium mb-2 text-center text-stone-900 dark:text-stone-100">Setze deine Prioritäten</h4>
                    <p className="text-sm text-stone-500 text-center mb-4">
                      Gehe in dein Profil und markiere Interessen als "Must-haves", um deine Vorschläge aktiv zu steuern.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? 'w-6 bg-brand dark:bg-brand-light' : 'w-2 bg-stone-200 dark:bg-stone-700'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 rounded-xl font-medium transition-transform active:scale-95"
              >
                {step < 2 ? 'Weiter' : 'Verstanden'}
                {step < 2 && <ArrowRight size={16} />}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
