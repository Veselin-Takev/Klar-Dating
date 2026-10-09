import { klarStorage } from '../lib/userScopedStorage';
import { fetchDatePlans } from '../lib/datePlans';
import { authFetch } from '../lib/authFetch';
import { useState, useEffect, useRef } from "react";
import { Trophy, MessageCircle, CalendarHeart, TrendingUp, Share2, Star, ChevronDown, ChevronUp, CheckCircle, Heart } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function SuccessDashboardWidget() {
  const [uiError, setUiError] = useState<string | null>(null);


  const [deepChats, setDeepChats] = useState(0);
  const [dateCount, setDateCount] = useState(0);
  const [successfulDates, setSuccessfulDates] = useState(0);
  const [checklistXp, setChecklistXp] = useState(0);

  const [justAchievedDate, setJustAchievedDate] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const prevDateCount = useRef<number | null>(null);

  useEffect(() => {
    let isInitialLoad = true;

    const updateStats = () => {
      // Planned dates are server-authoritative; do not read calendar state from browser storage.
      let dates = 0;
      fetchDatePlans().then(plans => {
        dates = plans.length; setDateCount(dates);
      }).catch(() => setUiError('Kalenderdaten konnten nicht geladen werden.'));

      // Check successful dates
      const savedHistory = klarStorage.getItem('klar_date_history');
      let successful = 0;
      if (savedHistory) {
        try {
          const parsed: unknown = JSON.parse(savedHistory);
          const historyList = Array.isArray(parsed) ? parsed.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object' && !Array.isArray(entry)) : [];
          successful = historyList.filter(entry => Boolean(entry.rating || entry.note)).length;
        } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      }

      // Check interactions for deep chats
      const savedInteractions = klarStorage.getItem('klar_interactions');
      let interactionsCount = 0;
      if (savedInteractions) {
        try {
          interactionsCount = Object.keys(JSON.parse(savedInteractions)).length;
        } catch (e) { console.warn(e); setUiError("Fehler beim Laden/Verarbeiten der Daten.");; }
      }

      // Date-prep checklist is server-authoritative. Do not read browser storage.
      let currentChecklistXp = 0;
      void authFetch('/api/checklists/date_prep').then(async response => {
        if (!response.ok) return;
        const data = await response.json();
        const checklist = data?.checklist;
        if (checklist && typeof checklist === 'object' && !Array.isArray(checklist)) {
          const completed = Object.values(checklist as Record<string, unknown>).filter(value => value === true).length;
          setChecklistXp(completed * 5);
        }
      }).catch(() => { /* Dashboard metrics degrade without affecting the checklist. */ });

      const displayDates = dates;
      const displayDeepChats = Math.max(interactionsCount, 5);
      const displaySuccessful = successful || 1;

      setDateCount(displayDates);
      setDeepChats(displayDeepChats);
      setSuccessfulDates(displaySuccessful);
      setChecklistXp(currentChecklistXp);

      if (!isInitialLoad && prevDateCount.current !== null && displayDates > prevDateCount.current) {
        setJustAchievedDate(true);
        setTimeout(() => setJustAchievedDate(false), 3000);
      }

      prevDateCount.current = displayDates;
      isInitialLoad = false;
    };

    void updateStats();

    // In a real app we might want to listen to a storage event, but this is fine for dashboard load
    window.addEventListener('storage', updateStats);
    return () => window.removeEventListener('storage', updateStats);
  }, []);

  const conversionRate = deepChats > 0 ? Math.round((dateCount / deepChats) * 100) : 0;

  // Calculate Level and XP
  const currentLevelXp = (deepChats * 10) + (dateCount * 50) + (successfulDates * 100) + checklistXp;
  const currentLevel = Math.floor(currentLevelXp / 200) + 1;
  const nextLevelXp = currentLevel * 200;
  const progressPercentage = Math.min(100, Math.max(0, ((currentLevelXp % 200) / 200) * 100));

  const milestones = [
    {
      id: 1,
      title: "Gesprächig",
      description: "5 Gespräche in die Tiefe",
      icon: MessageCircle,
      isActive: deepChats >= 5,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      id: 2,
      title: "Es knistert",
      description: "Erstes Date vereinbart",
      icon: CalendarHeart,
      isActive: dateCount > 0,
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-900/20"
    },
    {
      id: 3,
      title: "Beziehungsziel",
      description: "Erfolgreiches Treffen",
      icon: Heart,
      isActive: successfulDates > 0,
      color: "text-brand dark:text-brand-light",
      bgColor: "bg-brand/10 dark:bg-brand-light/10"
    }
  ];


  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl p-4 shadow-sm h-full flex flex-col justify-center">
      {uiError && <div className="p-3 m-4 text-sm text-red-700 bg-red-100 rounded-xl border border-red-200">{uiError}</div>}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" />
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">Dein Erfolgs-Dashboard</h3>
        </div>
        <button
          onClick={() => {}}
          className="text-stone-400 hover:text-brand dark:hover:text-brand-light transition-colors"
          title="Erfolge teilen"
        >
          <Share2 size={16} />
        </button>
      </div>

      <div className="mb-4 bg-stone-50 dark:bg-stone-800/50 p-3 rounded-xl border border-stone-100 dark:border-stone-700">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Level {currentLevel}</span>
          </div>
          <span className="text-[10px] font-medium text-stone-500">{currentLevelXp} / {nextLevelXp} XP</span>
        </div>
        <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full  from-yellow-400 to-yellow-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <p className="text-[10px] text-stone-500 mt-2 text-center">
          +10 XP/Gespräch • +50 XP/Date • +100 XP/Erfolg
        </p>
      </div>

      <div className="flex justify-between items-end gap-2 mb-4">

                <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
              <MessageCircle size={14} className="text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Gespräche in die Tiefe</p>
              <p className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-none mt-0.5">{deepChats}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.div
              className="w-8 h-8 rounded-full bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center shrink-0"
              animate={justAchievedDate ? { scale: [1, 1.2, 1], rotate: [0, -10, 10, -10, 0] } : {}}
              transition={{ duration: 0.5 }}
            >
              <CalendarHeart size={14} className="text-pink-500" />
            </motion.div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Dates vereinbart</p>
              <motion.p
                className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-none mt-0.5"
                animate={justAchievedDate ? { scale: [1, 1.3, 1], color: ['#1c1917', '#ec4899', '#1c1917'] } : {}}
                transition={{ duration: 0.5 }}
              >
                {dateCount}
              </motion.p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center shrink-0">
              <CheckCircle size={14} className="text-green-500" />
            </div>
            <div>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Erfolgreiche Treffen</p>
              <p className="text-lg font-bold text-stone-900 dark:text-stone-100 leading-none mt-0.5">{successfulDates}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end text-right bg-stone-50 dark:bg-stone-800/50 p-2.5 rounded-xl border border-stone-100 dark:border-stone-700">
          <div className="flex items-center gap-1 text-emerald-500 mb-0.5">
            <TrendingUp size={14} />
            <span className="text-sm font-bold">{conversionRate}%</span>
          </div>
          <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-wider font-medium max-w-[70px]">Erfolgs-Quote</p>
        </div>
      </div>

      <div className="border-t border-stone-100 dark:border-stone-700 pt-3">
        <button
          onClick={() => setShowTimeline(!showTimeline)}
          className="w-full flex items-center justify-between text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <span>Beziehungs-Zeitstrahl ansehen</span>
          {showTimeline ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <AnimatePresence>
          {showTimeline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4 relative">
                <div className="absolute left-3.5 top-6 bottom-4 w-0.5 bg-stone-100 dark:bg-stone-800 z-0"></div>
                {milestones.map((step) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="relative z-10 flex gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                        step.isActive
                          ? 'border-white dark:border-stone-900 ' + step.bgColor
                          : 'border-white dark:border-stone-900 bg-stone-100 dark:bg-stone-800'
                      }`}>
                        {step.isActive ? (
                          <CheckCircle size={14} className={step.color} />
                        ) : (
                          <Icon size={12} className="text-stone-400" />
                        )}
                      </div>
                      <div className={`pt-1 ${step.isActive ? 'opacity-100' : 'opacity-50'}`}>
                        <h4 className={`text-xs font-bold ${step.isActive ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500'}`}>
                          {step.title}
                        </h4>
                        <p className="text-[10px] text-stone-500 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
