// ═══════════════════════════════════════════════════════════════════════════
// Alle Meilensteine — die vollständige Liste
//
// Die kompakte Anzeige auf der Profilseite und dem Dashboard zeigt drei.
// Hier stehen alle, mit Stand und Beschreibung. Getrennt, weil eine
// vollständige Liste eine Seite verdient und keine 600 px in einem Reiter,
// durch den man zu etwas anderem hindurchmuss (klar/27, Abschnitt 7).
//
// Am Fuss steht, was ENTFALLEN ist — mit Grund. Das ist ungewöhnlich für
// eine Nutzeroberfläche und hier trotzdem richtig: Wer die App seit Wochen
// benutzt, hat „Icebreaker-Experte" gesehen und würde sich sonst fragen, wo
// die Auszeichnung hin ist. Eine Antwort ist besser als ihr Verschwinden.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import { MEILENSTEINE, ENTFALLEN, anteil, istErreicht, zusammenfassung } from '../lib/meilensteine';
import { leseRohdaten } from '../components/Meilensteine';
import type { Rohdaten } from '../lib/meilensteine';
import { hapticFeedback, HAPTIC_PATTERNS } from '../lib/haptics';

export default function MeilensteineAlle() {
  const [roh, setRoh] = useState<Rohdaten>({});

  useEffect(() => {
    setRoh(leseRohdaten());
  }, []);

  return (
    <div className="min-h-[100dvh] bg-canvas px-6 py-8 mx-auto w-full max-w-2xl">
            <Link to="/profile" className="inline-flex items-center gap-2 text-muted mb-8">
        <ArrowLeft size={18} aria-hidden="true" />
        Zurück
      </Link>

      <h1 className="text-3xl font-serif text-ink mb-2">Meilensteine</h1>
      <p className="text-muted mb-8">{zusammenfassung(roh)} erreicht.</p>

      <ul className="space-y-4">
        {MEILENSTEINE.map((m) => {
          const fertig = istErreicht(m, roh);
          const a = anteil(m, roh);
          return (

            <li
              key={m.id}
              onClick={() => {
                if (!fertig) {
                  hapticFeedback(HAPTIC_PATTERNS.MEDIUM_TAP);

                }
              }}
              className={`rounded-2xl border border-line-ui p-4 flex gap-3 items-start ${!fertig ? 'cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors' : ''}`}
            >
              {fertig ? (
                <Check size={18} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
              ) : (
                <Circle size={18} className="text-muted shrink-0 mt-0.5" aria-hidden="true" />
              )}
              <div className="flex-1">
                <p className="text-ink font-medium">
                  {m.name}
                  <span className="sr-only">{fertig ? ' — erreicht' : ' — offen'}</span>
                </p>
                <p className="text-muted text-sm mt-0.5 mb-2">{m.beschreibung}</p>
                <p className="text-muted text-xs mb-1.5">
                  {m.stand(roh)} von {m.ziel}
                </p>
                <div
                  aria-hidden="true"
                  className="h-1.5 w-full rounded-full bg-accent-quiet overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round(a * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <h2 className="text-xl font-serif text-ink mt-12 mb-2">Was weggefallen ist</h2>
      <p className="text-muted text-sm mb-4">
        Diese Auszeichnungen gab es früher in der App. Sie konnten nicht
        erreicht werden — der Fortschritt dazu wurde nirgends gezählt. Ein
        Ziel, das niemand erreichen kann, ist keins.
      </p>
      <ul className="space-y-2">
        {ENTFALLEN.map((e) => (
          <li key={e.name} className="text-sm">
            <span className="text-ink">{e.name}</span>
            <span className="text-muted"> — {e.grund}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
