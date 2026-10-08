import { useState } from "react";
import { PenTool, CheckCircle2, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router";

export function DailyPromptWidget() {
  const [isAnswered, ] = useState(false);
  const prompt = "Was hast du aus deinem letzten Date über dich selbst gelernt?";

  return (
    <div className=" from-stone-50 to-stone-100 dark:from-stone-800 dark:to-stone-900 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm relative overflow-hidden h-full flex flex-col justify-center">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <PenTool size={100} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2 py-1 bg-brand/10 text-brand dark:text-brand-light text-[10px] font-bold uppercase tracking-wider rounded-md">
            Daily Journal Prompt
          </div>
        </div>

        <h3 className="text-lg font-serif font-medium text-stone-900 dark:text-stone-100 leading-snug mb-4">
          "{prompt}"
        </h3>

        <AnimatePresence mode="wait">
          {!isAnswered ? (
            <motion.div
              key="unanswered"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Link
                to="/coach"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand dark:text-brand-light hover:opacity-80 transition-opacity bg-white dark:bg-stone-800 px-3 py-2 rounded-xl shadow-sm border border-stone-200 dark:border-stone-700"
              >
                <PenTool size={16} /> Im Journal beantworten <ChevronRight size={16} />
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="answered"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 size={16} /> Beantwortet für heute!
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
