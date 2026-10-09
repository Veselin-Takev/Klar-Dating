import { useState, useEffect, useRef } from "react";
import { Wind, Play, Square } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function BreathingExerciseWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<"idle" | "inhale" | "hold" | "exhale">("idle");
  const [timeLeft, setTimeLeft] = useState(60);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const filterNodeRef = useRef<BiquadFilterNode | null>(null);
  const cycleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const cycle = () => {
    if (!isActiveRef.current) return;

    const ctx = audioCtxRef.current;
    const gain = gainNodeRef.current;
    const filter = filterNodeRef.current;

    // Inhale: 4s
    setPhase("inhale");
    if (ctx && gain && filter) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      filter.frequency.cancelScheduledValues(ctx.currentTime);
      oscillatorRef.current?.frequency.cancelScheduledValues(ctx.currentTime);

      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 4);
      filter.frequency.linearRampToValueAtTime(800, ctx.currentTime + 4);
      oscillatorRef.current?.frequency.linearRampToValueAtTime(261.63, ctx.currentTime + 4); // C4
    }

    cycleTimeoutRef.current = setTimeout(() => {
      if (!isActiveRef.current) return;
      // Hold: 7s
      setPhase("hold");

      cycleTimeoutRef.current = setTimeout(() => {
        if (!isActiveRef.current) return;
        // Exhale: 8s
        setPhase("exhale");
        if (ctx && gain && filter) {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          filter.frequency.cancelScheduledValues(ctx.currentTime);
          oscillatorRef.current?.frequency.cancelScheduledValues(ctx.currentTime);

          gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 8);
          filter.frequency.linearRampToValueAtTime(400, ctx.currentTime + 8);
          oscillatorRef.current?.frequency.linearRampToValueAtTime(174, ctx.currentTime + 8);
        }

        cycleTimeoutRef.current = setTimeout(() => {
          if (isActiveRef.current) cycle();
        }, 8000);
      }, 7000);
    }, 4000);
  };

  const startExercise = () => {
    setIsActive(true);
    setTimeLeft(60);

    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        setUiError('Audio wird in diesem Browser nicht unterstützt.');
        setIsActive(false);
        return;
      }
      audioCtxRef.current = new AudioContextClass();
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(174, ctx.currentTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);

    gain.gain.setValueAtTime(0.01, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    oscillatorRef.current = osc;
    filterNodeRef.current = filter;
    gainNodeRef.current = gain;

    setTimeout(cycle, 100);
  };

  const stopExercise = () => {
    setIsActive(false);
    setPhase("idle");
    if (cycleTimeoutRef.current) {
      clearTimeout(cycleTimeoutRef.current);
    }
    if (oscillatorRef.current) {
      try {
        const ctx = audioCtxRef.current;
        if (ctx && gainNodeRef.current) {
          gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
          gainNodeRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
          setTimeout(() => {
             if (oscillatorRef.current) {
               oscillatorRef.current.stop();
               oscillatorRef.current.disconnect();
               oscillatorRef.current = null;
             }
          }, 500);
        } else {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      stopExercise();
    }

    return () => {
      clearInterval(interval);
    };
  }, [isActive, timeLeft]);

  useEffect(() => {
    return () => {
      stopExercise();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getInstruction = () => {
    switch (phase) {
      case "inhale": return "Tief einatmen... (4s)";
      case "hold": return "Halten... (7s)";
      case "exhale": return "Langsam ausatmen... (8s)";
      default: return "Bereit für das Date?";
    }
  };

  const getScale = () => {
    switch (phase) {
      case "inhale": return 1.6;
      case "hold": return 1.6;
      case "exhale": return 1;
      default: return 1;
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-start justify-between mb-4 relative z-20">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Wind size={20} className="text-teal-500" />
            Atemübung
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            4-7-8 Methode gegen Nervosität
          </p>
        </div>
        {isActive && (
          <div className="text-xs font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-1 rounded-md">
            00:{timeLeft.toString().padStart(2, "0")}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-2 relative min-h-[160px]">
        <AnimatePresence mode="wait">
          {!isActive ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center w-full"
            >
              <button
                onClick={startExercise}
                className="w-full flex items-center justify-center gap-2 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:hover:bg-teal-900/40 text-teal-700 dark:text-teal-300 py-4 px-6 rounded-2xl text-sm font-medium transition-colors"
              >
                <Play size={18} />
                1-Min Audio-Guide starten
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center w-full relative h-full mt-4"
            >
              <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                <motion.div
                  animate={{ scale: getScale() }}
                  transition={{
                    duration: phase === "inhale" ? 4 : phase === "exhale" ? 8 : 0,
                    ease: "linear"
                  }}
                  className="w-20 h-20 rounded-full bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 flex items-center justify-center"
                >
                  <motion.div
                    animate={{ scale: getScale() * 0.9 }}
                    transition={{
                      duration: phase === "inhale" ? 4 : phase === "exhale" ? 8 : 0,
                      ease: "linear"
                    }}
                    className="w-16 h-16 rounded-full bg-teal-100 dark:bg-teal-800/40"
                  />
                </motion.div>
              </div>

              <div className="z-10 mt-28 text-center relative flex flex-col items-center">
                <p className="text-sm font-medium text-teal-700 dark:text-teal-300">
                  {getInstruction()}
                </p>
                <button
                  onClick={stopExercise}
                  className="mt-4 text-xs text-stone-400 hover:text-stone-600 transition-colors inline-flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-full"
                >
                  <Square size={12} /> Beenden
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
