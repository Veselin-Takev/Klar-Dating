import { klarStorage } from '../lib/userScopedStorage';
// ═══════════════════════════════════════════════════════════════════════════
// Meilensteine — die kompakte Anzeige
//
// Ersetzt drei Bausteine, die nebeneinander dasselbe zeigten:
//   · DatingMilestones.tsx        (7 Badges, englische Namen, Konfetti)
//   · UserAchievementsWidget.tsx  (3 Auszeichnungen)
//   · DatingMilestonesWidget.tsx  (7 Meilensteine, 5 davon fest auf `false`)
// Auf dem Dashboard standen zwei davon gleichzeitig.
//
// ── WAS SICH INHALTLICH AENDERT ───────────────────────────────────────────
// 1. KEIN ERFUNDENER FORTSCHRITT MEHR. `DatingMilestones` setzte bei einem
//    frischen Konto „For demo purposes" zwei Zaehler von Hand und loeste
//    damit Konfetti und eine echte Benachrichtigung aus. Das ist ersatzlos
//    weg; die Zahlen kommen jetzt ausschliesslich aus dem Speicher.
// 2. NUR ERREICHBARE ZIELE. Elf Eintraege haben die Liste verlassen, weil
//    ihr Fortschritt nirgends gezaehlt wird — geprueft von
//    `scripts/meilensteine-erreichbar.mjs` bei jedem `verify`.
// 3. DREI STATT SECHS KAESTCHEN. Gezeigt werden die drei, die am naechsten
//    liegen, mit Balken. Der Rest steht auf /meilensteine. Ein Raster, in
//    dem fast alles grau ist, zeigt vor allem, was man nicht geschafft hat
//    (klar/27, Abschnitt 7).
//
// ── WAS SICH TECHNISCH AENDERT ────────────────────────────────────────────
// Das alte `setInterval(loadStats, 2000)` ist weg. Es las alle zwei
// Sekunden sieben Speicherschluessel und schrieb dabei gelegentlich zurueck
// — dauerhaft, auf jeder Seite, auf der der Baustein stand. Stattdessen:
// einmal beim Anzeigen, dann auf `storage` (anderes Fenster) und auf
// `focus` (Rueckkehr zur App).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Trophy, ChevronRight, Check } from 'lucide-react';
import {
  ALLE_SCHLUESSEL,
  MEILENSTEINE,
  anteil,
  erreichte,
  naechste,
  zusammenfassung,
  type Rohdaten,
} from '../lib/meilensteine';

/** Liest genau die Schluessel, die gebraucht werden — nicht den ganzen Speicher. */
export function leseRohdaten(): Rohdaten {
  const r: Rohdaten = {};
  for (const s of ALLE_SCHLUESSEL) {
    try {
      r[s] = klarStorage.getItem(s);
    } catch {
      // Privater Modus, gesperrter Speicher: dann eben nichts. Ein leerer
      // Stand ist richtig; ein erfundener waere es nicht.
      r[s] = null;
    }
  }
  return r;
}

export function Meilensteine() {
  const [roh, setRoh] = useState<Rohdaten>({});

  const lesen = useCallback(() => setRoh(leseRohdaten()), []);

  useEffect(() => {
    lesen();
    window.addEventListener('storage', lesen);
    window.addEventListener('focus', lesen);
    return () => {
      window.removeEventListener('storage', lesen);
      window.removeEventListener('focus', lesen);
    };
  }, [lesen]);

  const fertig = erreichte(roh);
  const drei = naechste(roh, 3);

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-2xl p-5 shadow-sm mb-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 p-1.5 rounded-lg">
          <Trophy size={16} aria-hidden="true" />
        </div>
        <h3 className="font-semibold text-stone-900 dark:text-stone-100">Meilensteine</h3>
        <span className="ml-auto text-xs font-medium text-stone-500 dark:text-stone-400">
          {zusammenfassung(roh)}
        </span>
      </div>

      {drei.length === 0 ? (
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-3">
          Alle {MEILENSTEINE.length} erreicht.
        </p>
      ) : (
        <>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
            {fertig.length === 0 ? 'Womit du anfangen kannst:' : 'Was als Nächstes ansteht:'}
          </p>
          <ul className="space-y-3">
            {drei.map((m) => {
              const a = anteil(m, roh);
              const stand = m.stand(roh);
              return (
                <li key={m.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      {m.name}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 shrink-0">
                      {stand} von {m.ziel}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 mb-1.5">
                    {m.beschreibung}
                  </p>
                  {/* `aria-hidden`, weil der Stand daneben bereits als Text
                      steht. Zweimal dieselbe Angabe vorzulesen hilft
                      niemandem. */}
                  <div
                    aria-hidden="true"
                    className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-brand dark:bg-brand-light"
                      style={{ width: `${Math.round(a * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {fertig.length > 0 && (
        <p className="mt-4 text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
          <Check size={14} className="text-brand dark:text-brand-light" aria-hidden="true" />
          Erreicht: {fertig.map((m) => m.name).join(', ')}
        </p>
      )}

      <Link
        to="/meilensteine"
        className="mt-4 flex items-center justify-between text-sm text-brand dark:text-brand-light min-h-[44px]"
      >
        Alle {MEILENSTEINE.length} ansehen
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default Meilensteine;
