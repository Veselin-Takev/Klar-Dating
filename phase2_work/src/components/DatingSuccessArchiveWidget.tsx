import { Award, Star, TrendingUp, Calendar, Medal } from "lucide-react";
import { motion } from "motion/react";

export function DatingSuccessArchiveWidget() {
  const milestones = [
    { id: 1, title: "5 Tage Streak erreicht", date: "Gestern", icon: <TrendingUp size={16} />, color: "text-orange-500", bg: "bg-orange-500/10" },
    { id: 2, title: "Erstes KI-Coaching absolviert", date: "Vor 3 Tagen", icon: <Star size={16} />, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { id: 3, title: "Profil zu 100% ausgefüllt", date: "Letzte Woche", icon: <Award size={16} />, color: "text-brand", bg: "bg-brand/10" },
    { id: 4, title: "Klar beigetreten", date: "Vor 2 Wochen", icon: <Medal size={16} />, color: "text-indigo-500", bg: "bg-indigo-500/10" }
  ];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
          <Award size={16} className="text-brand dark:text-brand-light" />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Erfolgs-Archiv</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Deine Dating-Reise im Überblick</p>
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-stone-200 dark:bg-stone-800"></div>
        <div className="space-y-6 relative">
          {milestones.map((m, i) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={m.id}
              className="flex gap-4 items-start"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${m.bg} ${m.color} border-2 border-white dark:border-stone-900 shadow-sm`}>
                {m.icon}
              </div>
              <div className="pt-1.5">
                <h4 className="text-sm font-medium text-stone-800 dark:text-stone-200">{m.title}</h4>
                <div className="flex items-center gap-1 mt-1 text-xs text-stone-500">
                  <Calendar size={12} /> {m.date}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
