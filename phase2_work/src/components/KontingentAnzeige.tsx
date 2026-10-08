import { klarStorage } from '../lib/userScopedStorage';
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// ═══════════════════════════════════════════════════════════════════════════
// P1 — Kontingent-Anzeige
//
// Design-Richtlinie §1: „Ehrliche Grenzen — Limits sichtbar, nie versteckt.
// Verletzung erkennt man daran, dass der Nutzer vom Limit erst beim
// Anstoßen erfährt."
//
// Die Zahl kommt vom Server (`GET /api/quota`). Vorher stand sie im
// klarStorage — eine clientseitige Restzahl wäre eine zweite Wahrheit
// neben der Transaktion, die tatsächlich zählt.
//
// BEWUSST NICHT: kein Countdown, kein Rot bei „1 übrig", kein pulsender
// Punkt. Künstliche Dringlichkeit ist in §12 verboten.
// ═══════════════════════════════════════════════════════════════════════════

export const KONTINGENT_AKTUALISIEREN = "klar:kontingent";

/** Nach einem Kontakt aufrufen. Ohne das bliebe die Anzeige stehen — und
 *  eine Restanzeige, die nicht stimmt, ist schlechter als keine. */
export function meldeKontaktVerbraucht(): void {
  window.dispatchEvent(new Event(KONTINGENT_AKTUALISIEREN));
}

export function KontingentAnzeige({ kompakt = false }: { kompakt?: boolean }) {
  const { t } = useTranslation();
  const [stand, setStand] = useState<{ uebrig: number | null; gesamt: number | null; plan: string } | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let weg = false;
    async function laden() {
      try {
        const res = await fetch("/api/quota");
        if (!res.ok) throw new Error(String(res.status));
        const d = await res.json();
        if (!weg) { setStand(d); setFehler(false); }
      } catch {
        // Kein erfundener Wert bei Fehler: Die Anzeige sagt, dass sie es
        // nicht weiß.
        if (!weg) setFehler(true);
      }
    }
    laden();
    window.addEventListener(KONTINGENT_AKTUALISIEREN, laden);
    return () => { weg = true; window.removeEventListener(KONTINGENT_AKTUALISIEREN, laden); };
  }, []);

  if (fehler) return <span role="status" className="text-sm text-stone-500">Kontingent gerade nicht abrufbar</span>;
  if (!stand) return <span className="inline-block h-5 w-28 rounded bg-stone-200 dark:bg-stone-800" aria-hidden="true" />;

  if (stand.plan === "plus") {
    return <span role="status" className="text-sm text-stone-600 dark:text-stone-300">{t("header.klarPlus")}</span>;
  }

  const uebrig = stand.uebrig ?? 0;
  return (
    <span
      role="status"
      aria-live="polite"
      className={kompakt
        ? "text-sm text-stone-600 dark:text-stone-300"
        : "inline-flex items-center gap-2 rounded-full border border-stone-300 dark:border-stone-600 px-4 py-2 text-sm text-stone-800 dark:text-stone-200"}
    >
      {uebrig === 0
        ? <>Heute keine Kontakte mehr <span className="text-stone-500"> · neue ab 4 Uhr</span></>
        : `${uebrig} von ${stand.gesamt} Kontakten übrig`}
    </span>
  );
}
