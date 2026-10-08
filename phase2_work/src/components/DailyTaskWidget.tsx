import { Link } from 'react-router';
import { Target, ArrowRight, Leaf } from 'lucide-react';

export function DailyTaskWidget({ isCompleted = false }: { isCompleted?: boolean }) {
  if (isCompleted) {
    return (
      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-[24px] p-5 transition-colors duration-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Leaf size={16} />
          </div>
          <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
            Ritual abgeschlossen
          </h3>
        </div>
        <p className="text-sm text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
          Du hast deine heutigen Vorschläge angesehen. Nimm dir Zeit für Dinge offline – bis morgen.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-[24px] p-5 transition-colors duration-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand-light/10 flex items-center justify-center text-brand dark:text-brand-light">
          <Target size={16} />
        </div>
        <h3 className="font-semibold text-stone-900 dark:text-stone-100">
          Tages-Aufgabe
        </h3>
      </div>
      <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 leading-relaxed">
        Klar ist als entschleunigtes, tägliches Ritual gedacht. Nimm dir einen Moment Zeit, um deine 8 heutigen Vorschläge in Ruhe kennenzulernen.
      </p>
      <Link
        to="/discover"
        className="w-full flex items-center justify-between bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-stone-100 text-stone-50 dark:text-stone-900 py-3 px-4 rounded-xl font-medium transition-colors duration-200"
      >
        <span>Zu den Vorschlägen</span>
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
