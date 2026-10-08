// ═══════════════════════════════════════════════════════════════════════════
// Antworttext — stellt eine Modellantwort lesbar dar
//
// ── WOZU ──────────────────────────────────────────────────────────────────
// Bis zum 14.08.2026 gab der KI-Coach den Antworttext unverändert aus
// (`{msg.text}` mit `whitespace-pre-wrap`). Auf dem Bildschirm stand
// deshalb wörtlich:
//
//   * **Option 1 (Werte):** „Hallo! Dein Profil hat mich direkt …
//
// Das Modell antwortet in Markdown; ein Darsteller dafür gab es im Projekt
// nicht.
//
// ── WARUM DAS HIER UND NICHT `react-markdown` ─────────────────────────────
// Die Zerlegung liegt in `src/lib/textform.ts` und ergibt DATEN — kein
// Markup. Dieser Baustein macht daraus React-Elemente. Damit kann über eine
// Modellantwort weder HTML noch ein Skript in die Seite gelangen, anders
// als bei jeder Lösung mit `dangerouslySetInnerHTML`.
//
// Bei einem Text, der aus einem Sprachmodell kommt und fremde Profilangaben
// enthalten kann, ist das kein theoretischer Punkt: Was ein Gegenüber in
// seine Bio schreibt, geht durch den Prompt und kann in der Antwort wieder
// auftauchen.
// ═══════════════════════════════════════════════════════════════════════════
import { alsZeilen } from '../lib/textform';

interface Props {
  text: string;
  /** Zusätzliche Klassen für den umschliessenden Bereich. */
  className?: string;
}

export function Antworttext({ text, className = '' }: Props) {
  const zeilen = alsZeilen(text);
  if (zeilen.length === 0) return null;

  return (
    <div className={className}>
      {zeilen.map((zeile, i) => {
        // Ein leerer Absatz ist der Abstand, den der Verfasser gemeint hat.
        if (zeile.stuecke.length === 0) return <div key={i} className="h-2" aria-hidden="true" />;

        const inhalt = zeile.stuecke.map((s, j) =>
          s.fett ? <strong key={j}>{s.text}</strong> : <span key={j}>{s.text}</span>,
        );

        if (zeile.art === 'punkt') {
          return (
            <div key={i} className="flex gap-2 mb-1.5">
              {/* Der Punkt ist Schmuck; vorgelesen wird nur der Inhalt. */}
              <span aria-hidden="true" className="shrink-0 select-none">
                •
              </span>
              <span>{inhalt}</span>
            </div>
          );
        }

        return (
          <p key={i} className="mb-1.5 last:mb-0">
            {inhalt}
          </p>
        );
      })}
    </div>
  );
}

export default Antworttext;
