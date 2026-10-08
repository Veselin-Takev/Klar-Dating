import React, { useState } from 'react';
import { Flower2, Wind, HeartHandshake, CheckCircle2 } from 'lucide-react';

const exercises = [
  {
    day: 1,
    title: 'Erwartungen vs. Realität',
    icon: Wind,
    description: 'Nimm dir 3 Minuten Zeit, um aufzuschreiben, was du von deinem nächsten Date erwartest. Sind diese Erwartungen realistisch oder projizierst du ein Idealbild?',
  },
  {
    day: 2,
    title: 'Aktives Zuhören',
    icon: HeartHandshake,
    description: 'Nimm dir heute vor, in einem Gespräch (egal ob Date oder Freund) mehr zuzuhören als zu sprechen. Achte auf Details und Emotionen.',
  },
  {
    day: 3,
    title: 'Dankbarkeit im Prozess',
    icon: Flower2,
    description: 'Finde eine Sache, die du am Dating-Prozess schätzt, selbst wenn es gerade anstrengend ist. Z.B. "Ich lerne mich selbst besser kennen."',
  },
];

export const MindfulDatingExercisesWidget: React.FC = () => {
  const [completed, setCompleted] = useState<number[]>([]);

  const toggleCompletion = (day: number) => {
    if (completed.includes(day)) {
      setCompleted(completed.filter((d) => d !== day));
    } else {
      setCompleted([...completed, day]);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 dark:text-stone-400 mb-6">
        Kleine Übungen, um deine innere Haltung beim Kennenlernen zu stärken und Enttäuschungen vorzubeugen.
      </p>

      {exercises.map((exercise) => {
        const isDone = completed.includes(exercise.day);

        return (
          <div
            key={exercise.day}
            className={`p-4 rounded-2xl border transition-all ${
              isDone
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/50'
                : 'bg-white dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-brand/30 dark:hover:border-brand/30'
            }`}
          >
            <div className="flex gap-4">
              <button aria-label="Übung als erledigt markieren"
                onClick={() => toggleCompletion(exercise.day)}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                <CheckCircle2 size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <exercise.icon size={14} className="text-stone-400 dark:text-stone-500" />
                  <span className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Übung {exercise.day}
                  </span>
                </div>
                <h4 className={`font-serif text-lg mb-2 ${
                  isDone ? 'text-emerald-900 dark:text-emerald-100' : 'text-stone-900 dark:text-stone-100'
                }`}>
                  {exercise.title}
                </h4>
                <p className={`text-sm leading-relaxed ${
                  isDone ? 'text-emerald-700 dark:text-emerald-300' : 'text-stone-600 dark:text-stone-400'
                }`}>
                  {exercise.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
