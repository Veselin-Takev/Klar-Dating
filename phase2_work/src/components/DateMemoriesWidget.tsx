import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { BookHeart, Quote, Smile, Sparkles, Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Memory {
  id: string;
  type: 'moment' | 'quote' | 'funny';
  title: string;
  text: string;
  timestamp: string;
}

export function DateMemoriesWidget() {
  const [uiError, setUiError] = useState<string | null>(null);

  const [memories, setMemories] = useState<Memory[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<'moment' | 'quote' | 'funny'>('moment');
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');

  useEffect(() => {
    const saved = klarStorage.getItem("klar_date_memories");
    if (saved) {
      try {
        setMemories(JSON.parse(saved));
      } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
    }
  }, []);

  const handleSave = () => {
    if (!newTitle.trim() || !newText.trim()) return;

    const newMemory: Memory = {
      id: Date.now().toString(),
      type: newType,
      title: newTitle.trim(),
      text: newText.trim(),
      timestamp: new Date().toISOString(),
    };

    const updated = [newMemory, ...memories];
    setMemories(updated);
    klarStorage.setItem("klar_date_memories", JSON.stringify(updated));

    setIsAdding(false);
    setNewTitle('');
    setNewText('');
    setNewType('moment');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'quote': return <Quote size={14} className="text-amber-500" />;
      case 'funny': return <Smile size={14} className="text-emerald-500" />;
      default: return <Sparkles size={14} className="text-rose-500" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'quote': return 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/50';
      case 'funny': return 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/50';
      default: return 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/50';
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative overflow-hidden">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BookHeart className="text-rose-500" size={20} />
            Dating-Erinnerungen
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Schöne Momente & Anekdoten
          </p>
        </div>
        {!isAdding && (
          <button aria-label="Erinnerung hinzufügen"
            onClick={() => setIsAdding(true)}
            className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shrink-0"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1">
        <AnimatePresence mode="wait">
          {isAdding ? (
            <motion.div
              key="add-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 dark:bg-stone-800/50 rounded-2xl p-4 border border-stone-100 dark:border-stone-700"
            >
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-medium text-stone-700 dark:text-stone-300">Neue Erinnerung</h4>
                <button aria-label="Eingabe abbrechen" onClick={() => setIsAdding(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200">
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setNewType('moment')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex justify-center items-center gap-1.5 transition-colors ${newType === 'moment' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' : 'bg-white dark:bg-stone-800 text-stone-500'}`}
                >
                  <Sparkles size={12} /> Moment
                </button>
                <button
                  onClick={() => setNewType('quote')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex justify-center items-center gap-1.5 transition-colors ${newType === 'quote' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-white dark:bg-stone-800 text-stone-500'}`}
                >
                  <Quote size={12} /> Zitat
                </button>
                <button
                  onClick={() => setNewType('funny')}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg flex justify-center items-center gap-1.5 transition-colors ${newType === 'funny' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-stone-800 text-stone-500'}`}
                >
                  <Smile size={12} /> Lustig
                </button>
              </div>

              <input
                type="text"
                placeholder="Wer / Wann / Wo?"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full text-sm p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 mb-2 placeholder:text-stone-400"
              />

              <textarea
                placeholder="Was ist passiert? Welcher Spruch ist gefallen?"
                value={newText}
                onChange={e => setNewText(e.target.value)}
                className="w-full text-sm p-2.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 mb-3 min-h-[80px] resize-none placeholder:text-stone-400"
              />

              <button
                onClick={handleSave}
                disabled={!newTitle.trim() || !newText.trim()}
                className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-sm font-medium hover:bg-rose-600 transition-colors disabled:opacity-50"
              >
                Speichern
              </button>
            </motion.div>
          ) : memories.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-sm text-stone-500 bg-stone-50 dark:bg-stone-800/50 rounded-2xl flex flex-col items-center gap-3 border border-stone-100 dark:border-stone-700 border-dashed"
            >
              <BookHeart size={32} className="text-stone-300 dark:text-stone-700 mb-2" />
              <p>Noch keine Erinnerungen gespeichert.</p>
              <p className="text-xs max-w-[200px] text-stone-400">
                Sammle hier besondere Momente oder lustige Zitate aus deinen Dates.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              className="space-y-3"
            >
              {memories.map((memory, idx) => (
                <motion.div
                  key={memory.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-2xl border ${getColorClass(memory.type)} flex flex-col gap-2 relative group`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      {getIcon(memory.type)}
                      {memory.type === 'moment' ? 'Schöner Moment' : memory.type === 'quote' ? 'Zitat' : 'Anekdote'}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(memory.timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                    {memory.title}
                  </h4>

                  {memory.type === 'quote' ? (
                    <blockquote className="text-sm font-serif italic text-stone-700 dark:text-stone-300 border-l-2 border-amber-300 dark:border-amber-700 pl-3 py-1 my-1">
                      "{memory.text}"
                    </blockquote>
                  ) : (
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-snug">
                      {memory.text}
                    </p>
                  )}

                  <button aria-label="Erinnerung löschen"
                    onClick={() => {
                      const updated = memories.filter(m => m.id !== memory.id);
                      setMemories(updated);
                      klarStorage.setItem("klar_date_memories", JSON.stringify(updated));
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
