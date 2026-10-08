import { klarStorage } from '../lib/userScopedStorage';
import { useEffect, useRef, useState, type ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// BeiSicht — hängt seine Kinder erst ein, wenn sie in die Nähe des
// sichtbaren Bereichs kommen.
//
// BEFUND FE-05 (Final Audit 08.08.2026), heute nachgemessen:
//   · 92 Widgets im JSX des Dashboards
//   · 117 Dateien lesen beim Einhängen synchron aus dem klarStorage
//   · 32 setInterval im Baum
// Alles läuft beim ersten Rendern des Dashboards, in einem Zug, im
// Hauptthread. Auf einem schwachen Mobilgerät ist das der Grund für das
// Ruckeln beim Öffnen.
//
// WAS DIESE KOMPONENTE NICHT LÖST: Sie verschiebt Arbeit, sie beseitigt sie
// nicht. Wer bis ans Ende scrollt, bekommt am Ende dieselben 92 Widgets. Die
// eigentliche Frage — gehören 92 Widgets auf einen Bildschirm — ist eine
// Produktentscheidung und keine, die eine Komponente beantwortet.
//
// WARUM SIE NUR AN 17 VON 76 STELLEN STEHT: Die übrigen 59 Widgets liegen in
// Behältern mit `empty:hidden`. Diese Regel blendet den Behälter aus, wenn
// das Widget nichts rendert — in den waagerechten Karussells verhindert sie
// leere Karten von 85 % Breite. Ein Platzhalter, der auf das Sichtbarwerden
// wartet, ist aber kein leerer Behälter: `empty:hidden` griffe nicht mehr,
// und es entstünden bis zu 59 fast leere Karussellplätze. Das wäre ein
// sichtbarer Rückschritt für einen unsichtbaren Gewinn.
//
// Damit die 59 nachziehen können, ist genau eine Sache nötig: Die Widgets
// müssen selbst entscheiden, ob sie erscheinen, statt `null` zu liefern —
// oder der Behälter verliert `empty:hidden`. Beides gehört gesehen, nicht
// geraten.
// ═══════════════════════════════════════════════════════════════════════════

interface Props {
  children: ReactNode;
  /** Wie früh vorgeladen wird. 400 px bedeutet: gut einen Bildschirm vorher —
   *  weit genug, dass beim normalen Scrollen nichts nachpoppt. */
  vorlauf?: string;
  /** Mindesthöhe des Platzhalters, damit die Bildlaufleiste nicht springt. */
  platzhalterHoehe?: string;
}

export function BeiSicht({ children, vorlauf = "400px", platzhalterHoehe = "8rem" }: Props) {
  const [sichtbar, setSichtbar] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (sichtbar) return;

    // Ohne IntersectionObserver (sehr alte Browser, manche Testumgebungen)
    // wird sofort eingehängt. Ein Widget, das nie erscheint, wäre schlimmer
    // als eines, das zu früh erscheint.
    if (typeof IntersectionObserver === "undefined") {
      setSichtbar(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (eintraege.some((e) => e.isIntersecting)) {
          setSichtbar(true);
          beobachter.disconnect();   // einmal eingehängt, bleibt eingehängt
        }
      },
      { rootMargin: vorlauf },
    );
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [sichtbar, vorlauf]);

  if (sichtbar) return <>{children}</>;

  return (
    <div
      ref={ref}
      style={{ minHeight: platzhalterHoehe }}
      // Für Vorlesewerkzeuge ist ein leerer Platzhalter nichts: Er trägt
      // keine Information und würde nur eine Leerstelle ankündigen.
      aria-hidden="true"
      className="bg-stone-200 rounded-md rounded-card"
    />
  );
}

export default BeiSicht;
