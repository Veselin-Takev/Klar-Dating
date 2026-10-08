import { useState, useEffect } from 'react';
import { getUserStorageItem, klarStorage } from '../lib/userScopedStorage';
import { Target, CheckCircle2, Circle, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ── ENTFERNT 14.08.2026 — die feste Wochenkurve ───────────────────────────
// Hier stand:
//
//   const data = [
//     { name: 'Mo', initiated: 2, replies: 1 },
//     { name: 'Di', initiated: 3, replies: 2 },
//     { name: 'Mi', initiated: 5, replies: 4 },
//     { name: 'Do', initiated: 4, replies: 3 },
//     { name: 'Fr', initiated: 6, replies: 5 },
//     { name: 'Sa', initiated: 8, replies: 7 },
//     { name: 'So', initiated: 7, replies: 6 },
//   ];
//
// Darunter, als Ueberschrift: „Deine Aktivitaet der letzten 7 Tage". Jeder
// Mensch sah dieselbe steigende Kurve — am ersten Tag wie im dritten Monat,
// mit oder ohne ein einziges Gespraech. Eine steigende Kurve ist die
// glaubwuerdigste Form von Erfindung: Sie sagt „es laeuft", und eine gute
// Nachricht prueft niemand nach.
//
// Ersatzlos gestrichen statt nachgebaut: Die Zahlen „gestartete Gespraeche"
// und „Antworten" gibt es heute nirgends. Sie zu erheben ist eine eigene
// Aufgabe (Firestore-Zaehler je Tag), keine Anzeigefrage.
//
// WIEDERVORLAGE: Wenn es echte Gespraechszahlen gibt, gehoert hier eine
// Kurve hin — dann aber aus den Daten und mit dem leeren Zustand als
// gueltigem Fall („noch nichts auszuwerten"), nicht mit einer Vorgabe.


const goalLabels: Record<string, string> = {
  relationship: 'Feste Beziehung finden',
  casual: 'Lockere Dates',
  friends: 'Neue Leute kennenlernen',
  undecided: 'Offen bleiben & Entdecken'
};

const goalMilestones: Record<string, string[]> = {
  relationship: ['Profil optimiert', '3 tiefe Gespräche geführt', 'Erstes Date planen'],
  casual: ['Profil erstellt', '5 lockere Chats', 'Spontanes Treffen vereinbaren'],
  friends: ['Interessen geteilt', '3 Gleichgesinnte gefunden', 'Auf einen Kaffee verabreden'],
  undecided: ['Profil ausgefüllt', 'Verschiedene Verbindungen entdeckt', 'Erstes lockeres Treffen']
};

export function InsightsChart() {
  const [userGoal, setUserGoal] = useState<string>('undecided');
  const [completedMilestones, setCompletedMilestones] = useState<number>(0);

  useEffect(() => {
    const savedGoal = getUserStorageItem('userGoal');
    if (savedGoal) {
      setUserGoal(savedGoal);
    }
    const savedMilestones = klarStorage.getItem('klar_completed_milestones');
    if (savedMilestones) {
      setCompletedMilestones(parseInt(savedMilestones, 10));
    }
  }, []);

  const milestones = goalMilestones[userGoal] || goalMilestones['undecided'] || [];
  const goalTitle = goalLabels[userGoal] || goalLabels['undecided'] || 'Dein Ziel';

  const completeNextMilestone = () => {
    if (completedMilestones < milestones.length - 1) {
      const newCount = completedMilestones + 1;
      setCompletedMilestones(newCount);
      klarStorage.setItem('klar_completed_milestones', newCount.toString());
      klarStorage.setItem('klar_last_milestone_engagement', Date.now().toString());

      // Trigger confetti
          }
  };

  return (
    <div className="p-4 bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl shadow-sm">
      {/* 14.08.2026: Der Knopf „Test Push" stand hier — er rief
          `NotificationService.simulateInactivity()` und war eine
          Entwicklerhilfe in der ausgelieferten Oberflaeche. Wer ihn
          antippte, bekam eine Benachrichtigung ueber 48 Stunden
          Untaetigkeit, die nicht stattgefunden hatte.

          Auch die Ueberschrift ist berichtigt: „Dating Insights" und
          „Deine Aktivitaet der letzten 7 Tage" bezogen sich auf die feste
          Kurve. Was hier steht, ist die Zielverfolgung — also heisst es
          jetzt so. */}

      {/* Milestone Tracker Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-brand dark:text-brand-light" />
            {/* ── BEFUND 14.08.2026, im Browser beobachtet ─────────────
                Diese Karte stand direkt ueber der Meilenstein-Karte. Dort
                hiess es „Profil geprueft — 0 von 1", hier „Profil
                optimiert" mit gesetztem Haken. Zwei fast gleich klingende
                Aussagen, zwei verschiedene Zustaende, ein Bildschirm.

                Der Unterschied ist echt und wichtig:
                  · MEILENSTEINE sind ABGELEITET. Sie ergeben sich aus
                    Daten (src/lib/meilensteine.ts) und lassen sich nicht
                    von Hand setzen.
                  · Diese Liste hier ist SELBST ERKLAERT. Man hakt sie ab.
                    Das ist eine ehrliche Quelle — solange erkennbar ist,
                    dass sie es ist.

                Deshalb heisst sie jetzt „Deine naechsten Schritte" statt
                „Ziel/Meilenstein", und der Satz darunter sagt, wer hier
                abhakt. */}
            <h3 className="font-medium text-stone-900 dark:text-stone-100">
              Deine nächsten Schritte
            </h3>
          </div>
          {completedMilestones < milestones.length - 1 && (
            <button
              onClick={completeNextMilestone}
              className="px-3 py-1.5 bg-brand dark:bg-brand-light text-white dark:text-stone-900 shadow-sm rounded-full text-xs font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <PartyPopper size={14} />
              Abhaken
            </button>
          )}
        </div>

        {/* Wer hakt hier ab — und wer nicht. Ohne diesen Satz sehen die
            Punkte aus wie die abgeleiteten Meilensteine eine Karte
            weiter unten. */}
        <p className="text-xs text-stone-500 dark:text-stone-400 mb-3">
          Ziel: {goalTitle}. Diese Schritte hakst du selbst ab — die
          Meilensteine darunter ergeben sich aus deinen Daten.
        </p>

        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before: before:from-transparent before:via-stone-200 dark:before:via-stone-800 before:to-transparent">
          {milestones.map((milestone, index) => {
            const isCompleted = index <= completedMilestones;
            const isCurrent = index === completedMilestones;

            return (
              <motion.div
                key={index}
                initial={false}
                animate={{
                  scale: isCurrent ? 1.02 : 1,
                  opacity: isCompleted ? 1 : 0.6
                }}
                className="relative flex items-center gap-4"
              >
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isCompleted ? 'var(--color-brand)' : 'transparent',
                    borderColor: isCompleted ? 'var(--color-brand)' : 'var(--color-stone-200)',
                  }}
                  className={`flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 z-10 bg-white dark:bg-stone-800 ${
                    isCompleted
                      ? 'border-brand dark:border-brand-light text-brand dark:text-brand-light'
                      : 'border-stone-200 dark:border-stone-700 text-stone-300 dark:text-stone-600'
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isCompleted ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      >
                        <CheckCircle2 size={16} className="text-white" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="circle"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <Circle size={10} className="fill-current text-stone-300 dark:text-stone-600" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div className={`flex-1 p-3 rounded-xl border transition-colors duration-300 ${
                  isCurrent
                    ? 'border-brand/30 dark:border-brand-light/30 bg-brand/5 dark:bg-brand-light/5'
                    : isCompleted
                      ? 'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800'
                      : 'border-stone-100 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50'
                }`}>
                  <p className={`text-sm font-medium transition-colors duration-300 ${
                    isCompleted ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'
                  }`}>
                    {milestone}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
