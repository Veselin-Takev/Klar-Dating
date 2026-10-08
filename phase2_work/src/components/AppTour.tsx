import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { triggerHaptic } from '../lib/haptics';

export const AppTour: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Dein AI Coach',
      description: 'Oben findest du deinen AI Coach mit täglichen Affirmationen und Rat.',
      position: 'top-20 left-4 right-4'
    },
    {
      title: 'Inspiration & Tipps',
      description: 'Wechsle zum Inspiration-Tab für tägliche Tipps und Dating-Ideen.',
      position: 'top-40 left-4 right-4'
    }
  ];

  useEffect(() => {
    const hasSeenTour = klarStorage.getItem('klar_has_seen_tour');
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setIsVisible(true);
        triggerHaptic('SUCCESS');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissTour = () => {
    setIsVisible(false);
    klarStorage.setItem('klar_has_seen_tour', 'true');
    triggerHaptic('LIGHT_TAP');
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      triggerHaptic('LIGHT_TAP');
    } else {
      dismissTour();
    }
  };

  if (!isVisible || !steps[currentStep]) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none bg-stone-900/20 transition-all duration-500">
      <div className={`absolute ${steps[currentStep].position} bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-brand/20 dark:border-brand-light/20 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300`}>
        <button
          aria-label="Tour beenden"
          onClick={dismissTour}
          className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="mb-4 pr-6">
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-1 flex items-center gap-2">
            <span className="bg-brand text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{currentStep + 1}</span>
            {steps[currentStep].title}
          </h3>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            {steps[currentStep].description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-4 rounded-full transition-colors duration-300 ${idx === currentStep ? 'bg-brand dark:bg-brand-light' : 'bg-stone-200 dark:bg-stone-800'}`}
              />
            ))}
          </div>
          <button
            onClick={nextStep}
            className="flex items-center justify-center gap-1.5 py-1.5 px-4 bg-brand dark:bg-brand-light text-white rounded-xl font-medium hover:opacity-90 transition-opacity active:scale-[0.98] text-xs"
          >
            {currentStep < steps.length - 1 ? 'Weiter' : 'Verstanden'}
            {currentStep < steps.length - 1 && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
