import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from "react";
import { Award, MessageCircle, Compass, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: unknown;
  color: string;
  progress: number;
  total: number;
  unlocked: boolean;
}

export function SmartVerbindungBadgeWidget() {
  const [badges, setBadges] = useState<Badge[]>([
    {
      id: "compass",
      name: "Verbindung-Entdecker",
      description: "Verbindung-Vorschläge im Kompass geprüft",
      icon: Compass,
      color: "bg-blue-500",
      progress: 0,
      total: 10,
      unlocked: false
    },
    {
      id: "icebreaker",
      name: "Icebreaker-Experte",
      description: "Erfolgreiche Eisbrecher-Konversationen",
      icon: Zap,
      color: "bg-amber-500",
      progress: 0,
      total: 5,
      unlocked: false
    },
    {
      id: "conversation",
      name: "Konversations-Profi",
      description: "Tiefgründige Unterhaltungen geführt",
      icon: MessageCircle,
      color: "bg-purple-500",
      progress: 0,
      total: 15,
      unlocked: false
    }
  ]);

  useEffect(() => {
    // Simulate reading from activity logs
    const savedNotified = klarStorage.getItem('klar_notified_matches');
    const notifiedCount = savedNotified ? JSON.parse(savedNotified).length : 0;

    // Icebreaker count
    const icebreakerCount = 3;
    const conversationCount = 8;

    setBadges(prev => prev.map(badge => {
      let currentProgress = badge.progress;
      if (badge.id === "compass") currentProgress = notifiedCount * 3 + 2; // Add some base progress
      else if (badge.id === "icebreaker") currentProgress = icebreakerCount;
      else if (badge.id === "conversation") currentProgress = conversationCount;

      return {
        ...badge,
        progress: Math.min(currentProgress, badge.total),
        unlocked: currentProgress >= badge.total
      };
    }));
  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-6 shadow-sm h-full flex flex-col relative z-10 overflow-hidden">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Award size={20} className="text-amber-500" />
            Smart-Verbindung-Badges
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Deine Meilensteine & Erfolge
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {badges.map((badge, idx) => {
          const Icon = badge.icon;
          const percent = Math.round((badge.progress / badge.total) * 100);
          return (
            <motion.div
              key={badge.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`p-4 rounded-2xl border ${badge.unlocked ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30' : 'bg-stone-50 dark:bg-stone-800/50 border-stone-100 dark:border-stone-700'}`}
            >
              <div className="flex items-center gap-4 mb-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 ${badge.unlocked ? badge.color + ' text-white shadow-md' : 'bg-stone-200 dark:bg-stone-700 text-stone-400'}`}>
                  {badge.unlocked ? <Icon size={24} /> : <Icon size={24} className="opacity-50" />}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    {badge.name}
                    {badge.unlocked && <CheckCircle2 size={14} className="text-amber-500" />}
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {badge.description}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-medium text-stone-500">
                  <span>{badge.progress} / {badge.total}</span>
                  <span>{percent}%</span>
                </div>
                <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 1, delay: 0.2 + (idx * 0.1) }}
                    className={`h-full rounded-full ${badge.unlocked ? badge.color : 'bg-stone-400 dark:bg-stone-500'}`}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
