import { klarStorage } from '../lib/userScopedStorage';
import { useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// useUsageAnalytics — bewusst wirkungslos
//
// BEFUND (09.08.2026): `Dashboard.tsx` importierte dieses Modul, es existierte
// nie. Verdeckt hat das `// @ts-nocheck` in Zeile 1 derselben Datei: Damit
// meldet `tsc` auch fehlende Module nicht. Die Typprüfung war grün, die App
// im Browser weiß. Fünfter Fall dieser Art in diesem Projekt.
//
// WARUM DIESE DATEI NICHTS VERSCHICKT
//
// Die einzige Aufrufstelle ist `trackEvent('profile_interaction', …)` in
// Dashboard.tsx:677 — sie meldet, welches Profil eine Person wie behandelt
// hat. Das ist Verhaltensdatum zu einer identifizierten Person.
//
// Zum Versenden fehlt alles, was es dafür braucht:
//   · eine Rechtsgrundlage (Art. 6 Abs. 1 DSGVO) — Einwilligung ist hier die
//     einzige tragfähige, und es gibt keinen Einwilligungsdialog
//   · ein Empfänger — es existiert kein Endpunkt, der Ereignisse annimmt
//   · ein Eintrag im Verzeichnis der Verarbeitungstätigkeiten (Art. 30)
//
// Und es widerspricht dem Produktversprechen: „Du zahlst mit Geld oder ein
// paar Sekunden Transparenz — niemals mit deiner Würde." Eine stille
// Verhaltensmessung ist genau das, wogegen sich Klar positioniert.
//
// Ein Modul, das heimlich sendet, wäre also schlechter als die weiße Seite,
// die es ersetzt.
//
// WENN MESSUNG GEWOLLT IST — dann als eigene Entscheidung, nicht als
// Nebenwirkung eines Imports. Nötig wären: Einwilligung vor dem ersten
// Ereignis, ein serverseitiger Endpunkt unter `/api`, Zweckbindung und
// Löschfrist, und ein Widerruf, der sofort wirkt. Erst dann bekommt die
// Funktion unten einen Rumpf.
// ═══════════════════════════════════════════════════════════════════════════

export type UsageEvent =
  | 'profile_interaction'
  | 'contact_sent'
  | 'verification_started';

export interface UsageAnalytics {
  /** Nimmt das Ereignis entgegen und verwirft es. Absichtlich. */
  trackEvent: (event: UsageEvent | string, daten?: Record<string, unknown>) => void;
}

export function useUsageAnalytics(): UsageAnalytics {
  const trackEvent = useCallback((_event: UsageEvent | string, _daten?: Record<string, unknown>) => {
    // Kein Netzaufruf, kein klarStorage, keine Konsolenausgabe.
    //
    // Auch `console.log` wäre hier falsch: Es würde im Entwicklungsbetrieb
    // den Eindruck erzeugen, es werde etwas gemessen, und niemand sähe
    // nach, ob am anderen Ende jemand zuhört. Genau so entstehen die
    // Anzeigen mit erfundenen Daten, die in STAND.md unter „offen" stehen.
  }, []);

  return { trackEvent };
}

export default useUsageAnalytics;
