import React, { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Wind, Sparkles, X, BellRing } from 'lucide-react';

export const DatingRitualWidget: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'inhale' | 'hold' | 'exhale'>('idle');
  const [timeLeft, setTimeLeft] = useState(4); // 4-7-8 method
  const [reminderSet, setReminderSet] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      return;
    }
    let timer: unknown;
    if (phase === 'idle') {
      setPhase('inhale');
      setTimeLeft(4);
    } else if (phase === 'inhale') {
      timer = setTimeout(() => {
        setPhase('hold');
        setTimeLeft(7);
      }, 4000);
    } else if (phase === 'hold') {
      timer = setTimeout(() => {
        setPhase('exhale');
        setTimeLeft(8);
      }, 7000);
    } else if (phase === 'exhale') {
      timer = setTimeout(() => {
        setPhase('inhale');
        setTimeLeft(4);
      }, 8000);
    }
    return () => clearTimeout(timer);
  }, [isActive, phase]);

  useEffect(() => {
    let interval: unknown;
    if (isActive && phase !== 'idle') {
      interval = setInterval(() => {
        setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, phase]);

  const scheduleReminder = () => {
    setReminderSet(true);
    // Simulate push notification scheduling 15m before date
    console.log("Reminder scheduled: Push notification in 15 minutes before Date.");
    setTimeout(() => setReminderSet(false), 3000);
  };

  if (!isActive) {
    return (
      <div className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center">
            <Wind size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Dating-Ritual</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">Vor dem Date kurz zentrieren</p>
          </div>
          <button
            onClick={scheduleReminder}
            className={`p-2 rounded-full transition-colors ${reminderSet ? 'bg-indigo-500 text-white' : 'bg-stone-200 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-indigo-500'}`}
            title="Reminder für nächstes Date setzen"
          >
            <BellRing size={16} />
          </button>
        </div>
        <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
          Nimm dir 2 Minuten Zeit für eine geführte Atemübung (4-7-8 Methode), um Aufregung abzubauen und authentisch ins Date zu starten.
        </p>
        {reminderSet && (
          <div className="mb-4 p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded-lg text-center font-medium">
            Erinnerung für 15 Min. vor dem Date gesetzt!
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsActive(true)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl font-medium transition-colors"
          >
            <Sparkles size={16} /> Ritual starten
          </button>
          <Link
            to="/rituals"
            className="w-full flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 py-2.5 rounded-xl font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800"
          >
            Zur Übungs-Bibliothek
          </Link>
        </div>
      </div>
    );
  }

  // Calculate progress for circular timer
  const totalPhaseTime = phase === 'inhale' ? 4 : phase === 'hold' ? 7 : 8;
  const progress = ((totalPhaseTime - timeLeft) / totalPhaseTime) * 100;
  const strokeDasharray = 2 * Math.PI * 54; // radius is 54
  const strokeDashoffset = strokeDasharray - (progress / 100) * strokeDasharray;

  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl p-6 mb-6 text-center relative overflow-hidden transition-colors duration-1000">
      <button aria-label="Ritual schließen"
        onClick={() => setIsActive(false)}
        className="absolute top-4 right-4 p-1 text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-full transition-colors z-10"
      >
        <X size={20} />
      </button>

      <h3 className="font-serif text-xl text-indigo-900 dark:text-indigo-100 mb-8">4-7-8 Atmung</h3>

      <div className="relative w-48 h-48 mx-auto flex items-center justify-center mb-8">
        {/* Animated breathing circle */}
        <div
          className="absolute inset-0 bg-indigo-200 dark:bg-indigo-800/50 rounded-full transition-all ease-in-out flex items-center justify-center"
          style={{
            transform: phase === 'inhale' ? 'scale(1)' : phase === 'hold' ? 'scale(1.1)' : phase === 'exhale' ? 'scale(0.5)' : 'scale(0.5)',
            transitionDuration: phase === 'inhale' ? '4000ms' : phase === 'hold' ? '7000ms' : phase === 'exhale' ? '8000ms' : '0ms'
          }}
        ></div>

        {/* Progress SVG */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 120 120">
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            className="text-indigo-200/50 dark:text-indigo-800/30"
          />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="text-indigo-600 dark:text-indigo-400 transition-all duration-1000 ease-linear"
          />
        </svg>

        <div className="relative z-10 w-24 h-24 bg-indigo-400 dark:bg-indigo-600 rounded-full flex items-center justify-center shadow-lg text-white">
          <span className="text-4xl font-light">{timeLeft > 0 ? timeLeft : ''}</span>
        </div>
      </div>

      <div className="h-8">
        <p className="text-lg font-medium text-indigo-800 dark:text-indigo-200 animate-in fade-in zoom-in duration-500">
          {phase === 'inhale' && 'Tief einatmen...'}
          {phase === 'hold' && 'Atem anhalten...'}
          {phase === 'exhale' && 'Langsam ausatmen...'}
        </p>
      </div>
    </div>
  );
};
