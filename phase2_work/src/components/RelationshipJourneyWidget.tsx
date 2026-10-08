import React, { useState, useEffect } from 'react';
import { getUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Target, Heart, MessageCircle, CalendarHeart, ShieldCheck } from 'lucide-react';

export const RelationshipJourneyWidget: React.FC = () => {
  const [goal, setGoal] = useState("undecided");

  const [steps, setSteps] = useState([
    { id: 'profile', label: 'Verifiziert & Bereit', icon: ShieldCheck, completed: false },
    { id: 'first_contact', label: 'Erste Nachricht', icon: MessageCircle, completed: false },
    { id: 'deep_chat', label: 'Tiefgründiger Chat', icon: Heart, completed: false },
    { id: 'date', label: 'Erstes Date', icon: CalendarHeart, completed: false },
  ]);

  useEffect(() => {
    const savedGoal = getUserStorageItem('userGoal');
    if (savedGoal) setGoal(savedGoal);

    // Simulate checking milestones
    const checkMilestones = () => {
      const bio = getUserStorageItem('klar_user_bio') || '';
      const hasChats = klarStorage.getItem('klar_chats_started') === 'true';
      const deepChat = parseInt(klarStorage.getItem('klar_chat_streak') || '0', 10) >= 3;
      const datePlanned = klarStorage.getItem('klar_dates_planned') === 'true';

      setSteps(prev => prev.map(s => {
        if (s.id === 'profile') return { ...s, completed: bio.length > 0 };
        if (s.id === 'first_contact') return { ...s, completed: hasChats };
        if (s.id === 'deep_chat') return { ...s, completed: deepChat };
        if (s.id === 'date') return { ...s, completed: datePlanned };
        return s;
      }));
    };

    checkMilestones();
  }, []);

  const getGoalLabel = (g: string) => {
    switch (g) {
      case 'serious': return 'Feste Beziehung';
      case 'casual': return 'Etwas Lockeres';
      case 'friends': return 'Neue Bekanntschaften';
      default: return 'Noch unentschlossen';
    }
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="text-brand dark:text-brand-light" size={20} />
          <h3 className="font-serif text-lg text-stone-900 dark:text-stone-100">Dating-Reise</h3>
        </div>
        <span className="text-xs font-medium bg-brand/10 dark:bg-brand-light/10 text-brand dark:text-brand-light px-2 py-1 rounded-md">
          {getGoalLabel(goal)}
        </span>
      </div>

      <div className="relative pt-4 pb-2">
        {/* Progress Line */}
        <div className="absolute top-8 left-4 right-4 h-0.5 bg-stone-100 dark:bg-stone-800 -z-10"></div>
        <div
          className="absolute top-8 left-4 h-0.5 bg-brand dark:bg-brand-light -z-10 transition-all duration-1000 ease-out"
          style={{ width: `calc(${progress}% - 2rem)` }}
        ></div>

        <div className="flex justify-between relative">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    step.completed
                      ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900 shadow-sm'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
                  }`}
                >
                  <Icon size={14} />
                </div>
                <span className={`text-[9px] font-semibold uppercase tracking-wider text-center max-w-[60px] ${step.completed ? 'text-stone-700 dark:text-stone-300' : 'text-stone-400 dark:text-stone-500'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
