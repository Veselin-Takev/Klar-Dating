import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Daily Mood — die eigene Stimmung eintragen und den Verlauf ansehen
//
// ── WAS HIER AM 14.08.2026 BEHOBEN WURDE ──────────────────────────────────
// Die Datei trug oben den P2-Vermerk „erzeugt Daten, die es nicht gibt".
// Der Grund war dieser Block:
//
//     // Mock some history if empty for demo purposes
//     for (let i = 6; i >= 1; i--) {
//       const randomMood = MOODS[0];
//       mockHistory.push({ date: …, mood: randomMood?.value || 3, … });
//     }
//     setHistory(mockHistory);
//
// Er ist weg. Wichtig war er nicht wegen der Anzeige, sondern wegen der
// Folge: `handleSelectMood` nahm den vorhandenen Verlauf — also die sechs
// erfundenen Tage — und schrieb ihn beim ersten echten Eintrag mit in den
// Speicher. Aus einer Anzeige wurde eine dauerhafte Aufzeichnung von Tagen,
// an denen die Person nie etwas gesagt hat.
//
// Anders als beim `ConversationStatsWidget` war Streichen hier NICHT die
// Antwort: Dieses Widget hat eine echte Aufgabe. Die Person trägt selbst
// ein, die Einträge sind ihre. Erfunden war nur der Anfangszustand.
//
// ── WAS SICH SICHTBAR AENDERT ─────────────────────────────────────────────
// Wer noch nichts eingetragen hat, sieht in der Trendansicht keinen Balken,
// sondern den Satz „Noch nichts eingetragen. Ab dem ersten Mal entsteht hier
// dein Verlauf." Ein leerer Verlauf ist der ehrliche Anfangszustand.
//
// ── WO DIE LOGIK LIEGT ────────────────────────────────────────────────────
// Lesen, Prüfen, Sortieren und Ersetzen stehen in `src/lib/tagesstimmung.ts`
// — importiert nichts, geprüft in `tests/tagesstimmung.spec.ts` (12 Fälle).
// Dort steckt auch die zweite Reparatur: gelesen wurde bisher mit
// `JSON.parse(…) as MoodEntry[]`, also einer Behauptung statt einer Prüfung.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { Smile, TrendingUp, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  SPEICHERSCHLUESSEL,
  STUFEN,
  eintraegeAusText,
  eintragZu,
  letzte,
  mitEintrag,
  stufeZu,
  tagesschluessel,
  zusammenfassung,
  type Eintrag,
  type Stufe,
} from "../lib/tagesstimmung";
import { melde } from "../lib/fehler";

export function DailyMoodWidget() {
  const [verlauf, setVerlauf] = useState<Eintrag[]>([]);
  const [heuteEingetragen, setHeuteEingetragen] = useState<Eintrag | null>(null);
  const [zeigeVerlauf, setZeigeVerlauf] = useState(false);

  useEffect(() => {
    const gelesen = eintraegeAusText(klarStorage.getItem(SPEICHERSCHLUESSEL));
    setVerlauf(gelesen);
    setHeuteEingetragen(eintragZu(gelesen, tagesschluessel(new Date())));
  }, []);

  const waehle = (stufe: Stufe) => {
    const heute = tagesschluessel(new Date());
    const neu: Eintrag = { date: heute, mood: stufe.wert, emoji: stufe.emoji };
    setHeuteEingetragen(neu);
    setVerlauf((vorher) => {
      const aktualisiert = mitEintrag(vorher, neu);
      try {
        klarStorage.setItem(SPEICHERSCHLUESSEL, JSON.stringify(aktualisiert));
      } catch (e) {
        // Ein voller oder gesperrter Speicher darf den Eintrag nicht
        // verschlucken — die Anzeige stimmt, nur das Merken schlaegt fehl.
        melde("Stimmung konnte nicht gespeichert werden", e);
      }
      return aktualisiert;
    });
  };

  const letzteSieben = letzte(verlauf, 7);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 p-2 rounded-lg">
            <Smile size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">Daily Mood</h3>
            <p className="text-xs text-stone-500">Wie geht's dir heute?</p>
          </div>
        </div>
        <button
          onClick={() => setZeigeVerlauf(!zeigeVerlauf)}
          aria-pressed={zeigeVerlauf}
          className={`p-2 rounded-full transition-colors ${zeigeVerlauf ? 'bg-brand dark:bg-brand-light text-white dark:text-stone-900' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 bg-stone-50 dark:bg-stone-800'}`}
          title="Verlauf ansehen"
        >
          <TrendingUp size={16} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!zeigeVerlauf ? (
          <motion.div
            key="auswahl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {heuteEingetragen ? (
              <div className="text-center py-4 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-700/50">
                <p className="text-sm text-stone-600 dark:text-stone-400 mb-2">Heute dokumentiert:</p>
                <div className="text-4xl mb-2">{heuteEingetragen.emoji}</div>
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  {stufeZu(heuteEingetragen.mood)?.name}
                </p>
                <button
                  onClick={() => setHeuteEingetragen(null)}
                  className="mt-3 text-xs text-brand hover:text-brand-light font-medium"
                >
                  Stimmung ändern
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center gap-2 mt-4">
                {STUFEN.map((stufe) => (
                  <button
                    key={stufe.wert}
                    onClick={() => waehle(stufe)}
                    className="flex flex-col items-center gap-1 p-2 flex-1 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors group"
                  >
                    <span className="text-3xl group- transition-transform duration-200">
                      {stufe.emoji}
                    </span>
                    <span className="text-[10px] text-stone-500 font-medium">
                      {stufe.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="verlauf"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="pt-2"
          >
            <p className="text-sm text-stone-600 dark:text-stone-400 mb-4 flex items-center gap-2">
              <CalendarDays size={14} /> Deine letzten Einträge
            </p>

            {letzteSieben.length === 0 ? (
              // Leer heisst leer. Kein Platzhalter-Balken, keine Grundlinie.
              <p className="text-sm text-stone-500 dark:text-stone-400 py-6 text-center">
                {zusammenfassung(verlauf)}
              </p>
            ) : (
              <>
                <div className="flex items-end justify-between h-24 gap-1.5 pb-2 border-b border-stone-100 dark:border-stone-700">
                  {letzteSieben.map((eintrag) => (
                    <div key={eintrag.date} className="flex flex-col items-center flex-1 gap-2 relative group h-full">
                      <div className="w-full bg-stone-100 dark:bg-stone-800 rounded-t-sm flex flex-col justify-end transition-all h-full overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${(eintrag.mood / 5) * 100}%` }}
                          className={`w-full rounded-t-sm opacity-80 ${
                            eintrag.mood >= 4 ? 'bg-green-400' : eintrag.mood === 3 ? 'bg-amber-400' : 'bg-rose-400'
                          }`}
                        />
                      </div>
                      <span className="text-lg absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        {eintrag.emoji}
                      </span>
                      <span className="text-[9px] text-stone-400 -rotate-45 origin-top-left mt-1 whitespace-nowrap">
                        {eintrag.date.slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Sagt, worauf die Balken beruhen — sieben Balken sind nicht
                    sieben Tage, sondern die letzten sieben Eintraege. */}
                <p className="text-xs text-stone-400 mt-3">{zusammenfassung(verlauf)}</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
