import { klarStorage } from '../lib/userScopedStorage';
import { useState, useEffect } from 'react';
import { Battery, BatteryMedium, BatteryLow, HeartPulse } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026. Was die Zeile verdeckt hat:
//
//   1. `import React` — nirgends benutzt. Mit `noUnusedLocals` ein Fehler.
//   2. `const now` und `const twoWeeksAgo` — berechnet und nie verwendet.
//      Der danebenstehende Kommentar sagt es selbst: „We'll simulate it by
//      looking at length for the MVP." Die Zwei-Wochen-Grenze war nie
//      angeschlossen.
//   3. `import { BatteryCharging }` — importiert, nie gerendert.
//   4. `JSON.parse(saved)` lieferte `any`. Damit war `history.length` für
//      den Compiler in Ordnung, AUCH wenn unter dem Schlüssel gar kein
//      Array steht. Dann ist `.length` `undefined`, `100 - undefined * 15`
//      ist `NaN`, und die Anzeige wird zu „NaN%" mit `style={{width:'NaN%'}}`.
//      Das ist der eine Fund, der sichtbar kaputt gewesen wäre.
//
// Punkt 4 ist jetzt abgefangen: Steht dort kein Array, bleibt es bei 100 %.
//
// ── NICHT BEHOBEN, WEIL PRODUKTENTSCHEIDUNG ───────────────────────────────
// Die Formel `100 − Anzahl_Dates × 15` ist gesetzt, nicht gemessen. Sie
// zählt ALLE je gespeicherten Dates, nicht die der letzten zwei Wochen —
// wer viel unternommen hat, bekommt dauerhaft „Deine soziale Batterie ist
// niedrig" zu lesen. Das ist eine Aussage über die lesende Person, die auf
// keiner Beobachtung beruht. Steht in `klar/22` zur Entscheidung.
// ═══════════════════════════════════════════════════════════════════════════

/** Wie viel Prozent ein gespeichertes Date von der Batterie abzieht. */
const ABZUG_JE_DATE = 15;
/** Untergrenze, damit der Balken nie ganz leer wirkt. */
const MINDESTSTAND = 20;
/** Dauer des Energiesparmodus in Millisekunden. */
const SPARMODUS_DAUER_MS = 48 * 60 * 60 * 1000;

/**
 * Liest die Date-Historie und gibt ihre Länge zurück — oder `null`, wenn
 * unter dem Schlüssel nichts Verwertbares steht.
 *
 * Bewusst `unknown` statt `any`: `JSON.parse` weiss nicht, was kommt, und
 * ein Feld, das keines ist, darf nicht als eines behandelt werden.
 */
function anzahlDates(roh: string | null): number | null {
  if (!roh) return null;
  try {
    const geparst: unknown = JSON.parse(roh);
    return Array.isArray(geparst) ? geparst.length : null;
  } catch {
    return null;
  }
}

export function SocialEnergyWidget() {
  const [energyLevel, setEnergyLevel] = useState(100);
  const [suggestion, setSuggestion] = useState(
    'Voll aufgeladen! Ein perfekter Tag für neue Verbindungen.',
  );
  const [powerSavingMode, setPowerSavingMode] = useState(false);
  const [powerSavingUntil, setPowerSavingUntil] = useState<number | null>(null);

  useEffect(() => {
    // Der Sparmodus hängt nicht an der Historie — deshalb zuerst und
    // unabhängig davon. Vorher stand er INNERHALB des `if (saved)`: Ohne
    // gespeicherte Dates wurde ein laufender Sparmodus nicht wiederhergestellt.
    const gespeicherteFrist = klarStorage.getItem('klar_power_saving_until');
    if (gespeicherteFrist) {
      const bis = Number.parseInt(gespeicherteFrist, 10);
      if (Number.isFinite(bis) && bis > Date.now()) {
        setPowerSavingMode(true);
        setPowerSavingUntil(bis);
      } else {
        klarStorage.removeItem('klar_power_saving_until');
      }
    }

    const dates = anzahlDates(klarStorage.getItem('klar_date_history'));
    if (dates === null) return;

    const stand = Math.max(MINDESTSTAND, 100 - dates * ABZUG_JE_DATE);
    setEnergyLevel(stand);

    if (stand > 80) {
      setSuggestion(
        'Hohe soziale Energie! Du bist bereit, neue Leute kennenzulernen und offene Gespräche zu führen.',
      );
    } else if (stand > 40) {
      setSuggestion(
        'Gute Balance. Ein Date am Wochenende wäre super, aber nimm dir auch Zeit für dich.',
      );
    } else {
      setSuggestion(
        'Deine soziale Batterie ist niedrig. Mache eine Dating-Pause für mentale Gesundheit. Mach etwas für dich!',
      );
    }
  }, []);

  const togglePowerSaving = () => {
    if (powerSavingMode) {
      setPowerSavingMode(false);
      setPowerSavingUntil(null);
      klarStorage.removeItem('klar_power_saving_until');
    } else {
      setPowerSavingMode(true);
      const bis = Date.now() + SPARMODUS_DAUER_MS;
      setPowerSavingUntil(bis);
      klarStorage.setItem('klar_power_saving_until', bis.toString());
    }
  };

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 p-4 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 text-sm">
          <HeartPulse size={16} className="text-brand dark:text-brand-light" />
          Soziale Energie
        </h4>
        <div className="flex items-center gap-1 text-xs font-bold text-stone-500">
          {energyLevel > 80 ? (
            <Battery size={16} className="text-emerald-500" />
          ) : energyLevel > 40 ? (
            <BatteryMedium size={16} className="text-amber-500" />
          ) : (
            <BatteryLow size={16} className="text-rose-500" />
          )}
          {energyLevel}%
        </div>
      </div>

      {/* Batteriebalken */}
      <div className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${energyLevel > 80 ? 'bg-emerald-500' : energyLevel > 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
          style={{ width: `${energyLevel}%` }}
        ></div>
      </div>

      <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">{suggestion}</p>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100 dark:border-stone-700">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium text-stone-700 dark:text-stone-300">
            Energiespar-Modus
          </span>
          <span className="text-[9px] text-stone-500">
            {powerSavingMode
              ? `Aktiv bis ${new Date(powerSavingUntil ?? 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Uhr`
              : 'Reduziert Benachrichtigungen'}
          </span>
        </div>
        <button
          role="switch"
          aria-checked={powerSavingMode}
          aria-label="Energiesparmodus"
          onClick={togglePowerSaving}
          className={`w-9 h-5 rounded-full relative transition-colors ${powerSavingMode ? 'bg-emerald-500' : 'bg-stone-200 dark:bg-stone-700'}`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${powerSavingMode ? 'left-4.5 translate-x-[18px]' : 'left-0.5 translate-x-0'}`}
          />
        </button>
      </div>
    </div>
  );
}
