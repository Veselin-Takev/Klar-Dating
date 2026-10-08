import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function MotivationReminderWidget() {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const today = new Date().toLocaleDateString('de-DE');
    const lastSeen = klarStorage.getItem('klar_motivation_date');
    if (lastSeen !== today) {
      const goal = klarStorage.getItem('klar_user_goal') || 'ernst';
      if (goal === 'locker') {
        setMessage("Guten Morgen! Ein neuer Tag für spannende Begegnungen und lockere Dates. Bleib offen und hab Spaß!");
      } else {
        setMessage("Guten Morgen! Jeder Schritt, auch kleine, bringen dich der richtigen Person näher. Bleib authentisch und geduldig.");
      }
      setShow(true);
    }
  }, []);

  const dismiss = () => {
    klarStorage.setItem('klar_motivation_date', new Date().toLocaleDateString('de-DE'));
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-3xl p-4 mb-4 relative flex gap-3 shadow-sm"
        >
          <div className="text-indigo-500 mt-1">
            <Sparkles size={20} />
          </div>
          <div className="flex-1 pr-6">
            <h4 className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm mb-1">Tägliche Motivation</h4>
            <p className="text-sm text-indigo-700 dark:text-indigo-300">{message}</p>
          </div>
          <button aria-label="Motivation schließen" onClick={dismiss} className="absolute top-4 right-4 text-indigo-400 hover:text-indigo-600 transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
