import { klarStorage } from '../lib/userScopedStorage';
import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickRepliesDrawerProps {
  onSelectReply: (reply: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickRepliesDrawer: React.FC<QuickRepliesDrawerProps> = ({ onSelectReply, isOpen, onClose }) => {
  const [uiError, setUiError] = useState<string | null>(null);

  const [replies, setReplies] = useState<string[]>([]);
  const [newReply, setNewReply] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const saved = klarStorage.getItem('klar_quick_replies');
    if (saved) {
      try {
        setReplies(JSON.parse(saved));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    } else {
      setReplies([
        "Hallo! Wie war dein Tag bisher?",
        "Das klingt super spannend! Erzähl mir mehr.",
        "Ich bin gerade unterwegs, antworte dir später ausführlich 😊"
      ]);
    }
  }, []);

  const saveReplies = (newReplies: string[]) => {
    setReplies(newReplies);
    klarStorage.setItem('klar_quick_replies', JSON.stringify(newReplies));
  };

  const handleAdd = () => {
    if (newReply.trim()) {
      saveReplies([...replies, newReply.trim()]);
      setNewReply("");
      setIsAdding(false);
    }
  };

  const handleDelete = (index: number) => {
    const updated = replies.filter((_, i) => i !== index);
    saveReplies(updated);
  };

  return (
    <AnimatePresence>
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute bottom-full left-0 right-0 bg-white dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-40 rounded-t-2xl max-h-[60vh] flex flex-col"
        >
          <div className="p-4 border-b border-stone-100 dark:border-stone-700 flex items-center justify-between">
            <h3 className="font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <MessageSquare size={16} className="text-brand dark:text-brand-light" />
              Schnellantworten
            </h3>
            <button aria-label="Schnellantworten schließen" onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto p-4 flex-1 space-y-2">
            {replies.map((reply, i) => (
              <div key={i} className="flex gap-2 group">
                <button
                  onClick={() => {
                    onSelectReply(reply);
                    onClose();
                  }}
                  className="flex-1 text-left p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm text-stone-700 dark:text-stone-300 transition-colors"
                >
                  {reply}
                </button>
                <button aria-label="Schnellantwort löschen"
                  onClick={() => handleDelete(i)}
                  className="p-3 text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            {isAdding ? (
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  placeholder="Neue Schnellantwort..."
                  className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 text-stone-900 dark:text-stone-100"
                  autoFocus
                />
                <button
                  onClick={handleAdd}
                  className="px-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl text-sm font-medium hover:opacity-90"
                >
                  Speichern
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-stone-300 dark:border-stone-700 rounded-xl text-stone-500 hover:text-stone-700 hover:border-stone-400 dark:hover:text-stone-300 dark:hover:border-stone-600 transition-colors text-sm mt-2"
              >
                <Plus size={16} /> Neue Antwort hinzufügen
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
