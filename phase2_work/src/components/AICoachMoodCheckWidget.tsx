import { useState } from 'react';
import { Wind, Target, Sparkles, Check } from 'lucide-react';

export function AICoachMoodCheckWidget() {
  const [step, setStep] = useState(0);
  const [intention, setIntention] = useState('');

  const renderContent = () => {
    switch(step) {
      case 0:
        return (
          <div className="text-center">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-500">
              <Sparkles size={24} />
            </div>
            <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-2">Bereit für dein Date?</h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">Lass uns einen kurzen Check-In machen, um dich optimal einzustellen.</p>
            <button onClick={() => setStep(1)} className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Starten</button>
          </div>
        );
      case 1:
        return (
          <div className="text-center">
            <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-sky-500">
              <Wind size={24} className="" />
            </div>
            <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-2">Atme tief durch</h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">4 Sekunden einatmen, 4 Sekunden halten, 4 Sekunden ausatmen. Wiederhole dies dreimal.</p>
            <button onClick={() => setStep(2)} className="w-full py-2 bg-sky-600 text-white rounded-xl text-sm font-medium hover:bg-sky-700 transition-colors">Weiter</button>
          </div>
        );
      case 2:
        return (
          <div>
            <div className="flex justify-center mb-3 text-brand">
              <Target size={24} />
            </div>
            <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-2 text-center">Setze deine Intention</h4>
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 text-center">Mit welchem Fokus gehst du in dieses Treffen?</p>
            <div className="space-y-2 mb-4">
              {['Offen bleiben & zuhören', 'Authentisch sein', 'Einfach Spaß haben', 'Klarheit gewinnen'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setIntention(opt)}
                  className={`w-full p-2 text-sm rounded-lg border text-left transition-colors ${intention === opt ? 'border-brand bg-brand/5 dark:bg-brand/10 text-brand' : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} disabled={!intention} className="w-full py-2 bg-brand text-white rounded-xl text-sm font-medium disabled:opacity-50">Intention setzen</button>
          </div>
        );
      case 3:
        return (
          <div className="text-center py-2">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-500">
              <Check size={24} />
            </div>
            <h4 className="font-semibold text-stone-800 dark:text-stone-200 mb-2">Du bist bereit!</h4>
            <p className="text-sm text-stone-600 dark:text-stone-400">Deine Intention: <span className="font-medium">"{intention}"</span></p>
            <p className="text-sm text-stone-600 dark:text-stone-400 mt-2">Viel Spaß beim Date!</p>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 shadow-sm">
      {renderContent()}
    </div>
  );
}
