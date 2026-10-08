import { klarStorage } from '../lib/userScopedStorage';
import { useState } from 'react';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { hapticFeedback } from '../lib/haptics';

// ═══════════════════════════════════════════════════════════════════════════
// `// @ts-nocheck` ENTFERNT am 12.08.2026. Was die Zeile verdeckt hat:
//
//   1. DER WICHTIGSTE FUND — eine gebaute Mechanik ohne Aufrufer.
//      `Dashboard.tsx:1468` rendert `<ValuesQuizWidget onComplete={…} />`.
//      Diese Komponente nahm bis heute ÜBERHAUPT KEINE Eigenschaften
//      entgegen. Die Eigenschaft wurde also stillschweigend verworfen, und
//      `handleQuizComplete` in `Dashboard.tsx:801` ist nie gelaufen — die
//      Werte aus dem Quiz landeten nie in den Interessen, und die
//      angekündigte Meldung „Werte erfolgreich hinzugefügt!" kam nie.
//      Ohne `@ts-nocheck` in BEIDEN Dateien wäre das ein Typfehler gewesen.
//
//   2. `questions[step].text` und `questions[i].values[ans]` — mit
//      `noUncheckedIndexedAccess` ist ein Zugriff über einen Index immer
//      `… | undefined`. Der Compiler hätte an fünf Stellen gewarnt.
//
//   3. `JSON.parse(klarStorage…)` lieferte `any`. Steht unter
//      `klar_user_values` etwas anderes als ein Array aus Zeichenketten,
//      wurde es ungeprüft weitergereicht und zurückgeschrieben.
//
// ── WAS SICH SICHTBAR ÄNDERT ──────────────────────────────────────────────
// Nach Abschluss des Quiz läuft jetzt `onComplete`. Auf dem Dashboard heisst
// das: Die drei gewählten Werte werden zu den Interessen hinzugefügt und es
// erscheint die Bestätigungsmeldung. Das ist das Verhalten, das dort seit
// jeher vorgesehen war — es hat nur nie stattgefunden.
//
// Die Eigenschaft ist bewusst OPTIONAL: Die Komponente muss auch ohne
// Aufrufer funktionieren.
//
// ── EINE ZWEITE, KLEINERE ÄNDERUNG AM TEXT ────────────────────────────────
// Der Abschlusstext lautete: „Deine Kernwerte wurden analysiert und zu
// deinem Profil hinzugefügt. Das hilft dem KI-Verbindungsberater, noch tiefere
// Verbindungen für dich zu finden."
//
// Analysiert wird nichts — die Antwort wird über eine feste Tabelle einem
// Wort zugeordnet. Und ob der Verbindungsberater diese Werte benutzt, weiss diese
// Komponente nicht. Geblieben ist der Teil, der stimmt: „Deine Kernwerte
// wurden zu deinem Profil hinzugefügt." Falls Sie den alten Text wollen,
// sagen Sie es — dann setze ich ihn zurück.
// ═══════════════════════════════════════════════════════════════════════════

interface Frage {
  text: string;
  /** Antworttexte. Gleiche Länge wie `values`. */
  options: string[];
  /** Der Wert, für den die Antwort an derselben Stelle steht. */
  values: string[];
}

// Ausserhalb der Komponente: Die Fragen sind fest und wurden bisher bei
// jedem Neuzeichnen neu aufgebaut.
const FRAGEN: Frage[] = [
  {
    text: 'Ein freier Sonntag liegt vor dir. Was machst du am liebsten?',
    options: [
      'Spontan einen Roadtrip machen (Abenteuer)',
      'Ein Buch lesen oder meditieren (Ruhe & Achtsamkeit)',
      'Freunde zum Brunch einladen (Soziales & Gemeinschaft)',
      'Ein neues Projekt oder Hobby starten (Kreativität)',
    ],
    values: ['Abenteuer', 'Achtsamkeit', 'Gemeinschaft', 'Kreativität'],
  },
  {
    text: 'Wie gehst du mit einem Konflikt in einer Beziehung um?',
    options: [
      'Direkt ansprechen und diskutieren (Ehrlichkeit & Direktheit)',
      'Erst nachdenken, dann ruhig klären (Harmonie & Reflexion)',
      'Einen Kompromiss finden, der beide glücklich macht (Teamwork)',
      'Ich brauche erst einmal Abstand (Unabhängigkeit)',
    ],
    values: ['Ehrlichkeit', 'Harmonie', 'Teamwork', 'Unabhängigkeit'],
  },
  {
    text: 'Was ist dir bei einem ersten Date am wichtigsten?',
    options: [
      'Lachen und Leichtigkeit (Humor)',
      'Tiefgründige Gespräche (Tiefgang)',
      'Gemeinsam etwas erleben (Aktivität)',
      'Ein stilvolles Ambiente (Ästhetik & Genuss)',
    ],
    values: ['Humor', 'Tiefgang', 'Aktivität', 'Genuss'],
  },
];

/** Höchstzahl gespeicherter Werte. War vorher als `.slice(0, 5)` versteckt. */
const HOECHSTZAHL_WERTE = 5;

/** Zeichenketten aus einem unbekannten Wert holen — alles andere fällt weg. */
function nurZeichenketten(roh: unknown): string[] {
  return Array.isArray(roh) ? roh.filter((w): w is string => typeof w === 'string') : [];
}

function gespeicherteWerte(): string[] {
  try {
    const roh: unknown = JSON.parse(klarStorage.getItem('klar_user_values') ?? '[]');
    return nurZeichenketten(roh);
  } catch {
    return [];
  }
}

interface Eigenschaften {
  /**
   * Wird nach dem letzten Schritt mit den gewählten Werten aufgerufen.
   * Optional — die Komponente funktioniert auch allein.
   */
  onComplete?: (werte: string[]) => void;
}

export function ValuesQuizWidget({ onComplete }: Eigenschaften = {}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [gewaehlteWerte, setGewaehlteWerte] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleAnswer = (index: number) => {
    hapticFeedback(50);
    const newAnswers = [...answers, index];
    setAnswers(newAnswers);

    if (step < FRAGEN.length - 1) {
      setStep(step + 1);
      return;
    }

    setIsCompleted(true);
    hapticFeedback([100, 50, 100, 50, 200]);

    // Zu jeder Antwort den Wert an derselben Stelle. Was nicht auflösbar
    // ist, fällt weg — statt `undefined` in die Liste zu schreiben.
    const werte = newAnswers
      .map((antwort, i) => FRAGEN[i]?.values[antwort])
      .filter((w): w is string => typeof w === 'string');
    setGewaehlteWerte(werte);

    const zusammen = Array.from(new Set([...gespeicherteWerte(), ...werte])).slice(
      0,
      HOECHSTZAHL_WERTE,
    );
    klarStorage.setItem('klar_user_values', JSON.stringify(zusammen));

    // Ab hier neu: Der Aufrufer erfährt davon.
    onComplete?.(werte);
  };

  const aktuelleFrage = FRAGEN[step];

  return (
    <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-3xl p-5 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-bl-full -z-10" />

      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
          <Sparkles size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">Werte-Kompass Quiz</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Finde deine wahren Kernwerte</p>
        </div>
      </div>

      {!isCompleted && aktuelleFrage ? (
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center text-[10px] font-medium text-stone-400">
            <span>
              Frage {step + 1} von {FRAGEN.length}
            </span>
            <span>{Math.round((step / FRAGEN.length) * 100)}%</span>
          </div>
          <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-purple-500 transition-all duration-500"
              style={{ width: `${(step / FRAGEN.length) * 100}%` }}
            />
          </div>

          <p className="text-sm font-medium text-stone-800 dark:text-stone-200 mb-2">
            {aktuelleFrage.text}
          </p>

          <div className="flex flex-col gap-2">
            {aktuelleFrage.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(i)}
                className="text-left p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/10 hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors text-xs text-stone-700 dark:text-stone-300 flex justify-between items-center group"
              >
                <span>{opt}</span>
                <ArrowRight
                  size={14}
                  className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h4 className="font-serif text-lg text-stone-900 dark:text-stone-100 mb-2">
            Quiz abgeschlossen!
          </h4>
          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
            Deine Kernwerte wurden zu deinem Profil hinzugefügt.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {gewaehlteWerte.map((wert, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-full text-xs font-medium border border-stone-200 dark:border-stone-700"
              >
                {wert}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
