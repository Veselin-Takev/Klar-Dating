// ═══════════════════════════════════════════════════════════════════════════
// Reiterleiste — der Segmentwähler über einem Bildschirm
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Die Profilseite war vier Seiten in einer: das Profil, die Werkzeuge zu
// seiner Verbesserung, ein Statistikbereich und die App-Einstellungen. Die
// vier werden zu völlig verschiedenen Anlässen aufgerufen; sie in eine
// Bildlaufliste zu stapeln zwingt jede Nutzung durch alle anderen hindurch.
// Siehe klar/27-profilseite-layout.
//
// ── WARUM REITER UND KEIN SIEBTER EINTRAG IN DER UNTEREN LEISTE ───────────
// Die untere Navigationsleiste hat bereits sechs Felder. Ein siebtes macht
// die Tippfläche kleiner als die 44 px, die Design-Richtlinie 2.0 verlangt.
//
// ── ZUGÄNGLICHKEIT ────────────────────────────────────────────────────────
// Die Leiste ist ein echtes `tablist` nach WAI-ARIA: `role="tab"`,
// `aria-selected`, und die Pfeiltasten wechseln. Ein Segmentwähler aus
// blossen `<button>`-Elementen sieht gleich aus, ist mit einer Vorlesehilfe
// aber nicht als zusammengehörige Auswahl erkennbar.
//
// Der zugehörige Inhalt bekommt `role="tabpanel"` und `aria-labelledby` —
// das steht beim Aufrufer, weil nur er weiss, was er rendert.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from 'react';

export interface Reiter<T extends string> {
  id: T;
  beschriftung: string;
}

interface Props<T extends string> {
  reiter: readonly Reiter<T>[];
  aktiv: T;
  aufWechsel: (id: T) => void;
  /** Für `id`-Zuweisungen, damit mehrere Leisten auf einer Seite möglich sind. */
  name?: string;
}

export function Reiterleiste<T extends string>({ reiter, aktiv, aufWechsel, name = 'reiter' }: Props<T>) {
  const knoepfe = useRef<Record<string, HTMLButtonElement | null>>({});

  const beiTaste = (e: React.KeyboardEvent, index: number) => {
    let ziel: number | null = null;
    if (e.key === 'ArrowRight') ziel = (index + 1) % reiter.length;
    if (e.key === 'ArrowLeft') ziel = (index - 1 + reiter.length) % reiter.length;
    if (e.key === 'Home') ziel = 0;
    if (e.key === 'End') ziel = reiter.length - 1;
    if (ziel === null) return;
    e.preventDefault();
    const naechster = reiter[ziel];
    if (!naechster) return;
    aufWechsel(naechster.id);
    knoepfe.current[naechster.id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Bereiche"
      className="flex gap-1 p-1 mb-6 bg-stone-100 dark:bg-stone-800 rounded-2xl"
    >
      {reiter.map((r, i) => {
        const istAktiv = r.id === aktiv;
        return (
          <button
            key={r.id}
            ref={(el) => { knoepfe.current[r.id] = el; }}
            role="tab"
            id={`${name}-${r.id}`}
            aria-selected={istAktiv}
            aria-controls={`${name}-${r.id}-inhalt`}
            // Nur der aktive Reiter ist mit der Tabulatortaste erreichbar;
            // innerhalb der Leiste wird mit den Pfeiltasten gewechselt. So
            // verlangt es das WAI-ARIA-Muster, und so bleibt der Weg durch
            // die Seite kurz.
            tabIndex={istAktiv ? 0 : -1}
            onClick={() => aufWechsel(r.id)}
            onKeyDown={(e) => beiTaste(e, i)}
            className={`flex-1 py-2.5 px-3 text-sm font-medium rounded-xl transition-colors ${
              istAktiv
                ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
            }`}
          >
            {r.beschriftung}
          </button>
        );
      })}
    </div>
  );
}

export default Reiterleiste;
