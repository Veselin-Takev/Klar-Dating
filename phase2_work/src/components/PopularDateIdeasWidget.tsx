import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'motion/react';
import { Coffee, Utensils, Music, Map, Palette, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';

const POPULAR_IDEAS = [
  {
    id: 1,
    title: 'Kaffee & Spaziergang',
    category: 'Casual',
    icon: <Coffee size={24} className="text-amber-600" />,
    description: 'Ein entspannter Spaziergang durch den Park mit einem Kaffee To-Go. Perfekt für das erste Kennenlernen.',
    color: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
  },
  {
    id: 2,
    title: 'Streetfood Markt',
    category: 'Foodie',
    icon: <Utensils size={24} className="text-orange-600" />,
    description: 'Verschiedene Stände ausprobieren und das Essen teilen. Ungezwungen und interaktiv.',
    color: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  },
  {
    id: 3,
    title: 'Live-Musik Bar',
    category: 'Unterhaltung',
    icon: <Music size={24} className="text-purple-600" />,
    description: 'Gemeinsam Live-Musik genießen. Bietet gute Gesprächspausen und lockere Stimmung.',
    color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
  },
  {
    id: 4,
    title: 'Museum oder Galerie',
    category: 'Kultur',
    icon: <Palette size={24} className="text-blue-600" />,
    description: 'Viel Gesprächsstoff durch die Ausstellungsstücke. Ideal für kreative Köpfe.',
    color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  },
  {
    id: 5,
    title: 'Botanischer Garten',
    category: 'Natur',
    icon: <Map size={24} className="text-emerald-600" />,
    description: 'Eine ruhige Umgebung, ideal für tiefere Gespräche abseits vom Trubel.',
    color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
  }
];

export function PopularDateIdeasWidget() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-scroll logic
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % POPULAR_IDEAS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % POPULAR_IDEAS.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + POPULAR_IDEAS.length) % POPULAR_IDEAS.length);
  };

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-yellow-600 dark:text-yellow-400">
          <Lightbulb size={20} />
        </div>
        <h3 className="font-bold text-stone-900 dark:text-stone-100">Beliebte Date-Ideen</h3>
      </div>

      <div className="relative flex-1 flex flex-col justify-center">
        <div className="overflow-hidden px-1 py-2 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className={`p-5 rounded-2xl border ${POPULAR_IDEAS[currentIndex]?.color} flex flex-col items-center text-center gap-3`}
            >
              <div className="w-14 h-14 rounded-full bg-white dark:bg-stone-800 flex items-center justify-center shadow-sm">
                {POPULAR_IDEAS[currentIndex]?.icon}
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                {POPULAR_IDEAS[currentIndex]?.category}
              </span>
              <h4 className="font-bold text-stone-900 dark:text-stone-100">
                {POPULAR_IDEAS[currentIndex]?.title}
              </h4>
              <p className="text-sm opacity-80 leading-snug">
                {POPULAR_IDEAS[currentIndex]?.description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            aria-label="Vorherige Date-Idee"
            onClick={handlePrev}
            className="p-1.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex gap-1.5">
            {POPULAR_IDEAS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-4 bg-brand' : 'w-1.5 bg-stone-200 dark:bg-stone-700'}`}
              />
            ))}
          </div>

          <button
            aria-label="Nächste Date-Idee"
            onClick={handleNext}
            className="p-1.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
