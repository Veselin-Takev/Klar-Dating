import { useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, BatteryCharging, MessageCircle, Wind, MapPin } from 'lucide-react';
import { hapticFeedback, HAPTIC_PATTERNS } from '../lib/haptics';

export function PreDateChecklistWidget() {
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const checklist = [
    { id: 'powerbank', label: 'Handy/Powerbank geladen', icon: BatteryCharging },
    { id: 'topics', label: '3 offene Fragen im Kopf', icon: MessageCircle },
    { id: 'breathe', label: 'Kurze Atemübung gemacht', icon: Wind },
    { id: 'location', label: 'Standort geteilt (optional)', icon: MapPin },
  ];

  const toggleItem = (id: string) => {
    hapticFeedback(HAPTIC_PATTERNS.LIGHT_TAP);
    setCheckedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const progress = Math.round((checkedItems.length / checklist.length) * 100);

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-700 relative overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl">
          <CheckCircle2 size={20} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Vor dem Date</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Mentaler & praktischer Check</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">Fortschritt</span>
          <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">{progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-amber-500 dark:bg-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {checklist.map(item => {
          const isChecked = checkedItems.includes(item.id);
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                isChecked
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50'
                  : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600'
              }`}
            >
              <div className={isChecked ? 'text-amber-500' : 'text-stone-400'}>
                {isChecked ? <CheckCircle2 size={20} className="fill-current" /> : <Circle size={20} />}
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Icon size={16} className={isChecked ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400'} />
                <span className={`text-sm font-medium ${isChecked ? 'text-amber-900 dark:text-amber-100 line-through opacity-70' : 'text-stone-700 dark:text-stone-300'}`}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
