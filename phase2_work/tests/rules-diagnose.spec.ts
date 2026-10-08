// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSE — der `evaluation error` in firestore.rules
//
// ── DIES IST KEINE PRÜFUNG ────────────────────────────────────────────────
// Diese Datei behauptet NICHTS und schlägt NICHT fehl. Sie stellt einen im
// Browser beobachteten Fall nach und schreibt auf, was der Emulator dazu
// sagt. Sie hängt deshalb NICHT in `npm run verify` — sie wird einmal von
// Hand gestartet:
//
//     npm run test:rules-diagnose
//
// Grund für diese Form: Ich kann sie in meiner Umgebung nicht ausführen (kein
// Emulator, `npm install` gesperrt). Ein Test, der behauptet und den ich nie
// laufen liess, wäre eine Vermutung mit grünem Anstrich. Ein Protokoll, das
// nur berichtet, ist ehrlich — und liefert genau die Angabe, die fehlt.
//
// ── DER BEOBACHTETE FALL (14.08.2026, Browser-Konsole) ────────────────────
//
//   Could not save theme to Firestore FirebaseError: PERMISSION_DENIED:
//   evaluation error at L169:24 for 'create' @ L169,
//   false for 'update' @ L181, false for 'update' @ L181
//
// Ausgelöst von `ThemeProvider.tsx` mit
//
//   setDoc(doc(db, 'users', uid), { theme: 'dark' }, { merge: true })
//
// auf ein Dokument, das es NOCH NICHT GAB. Firestore wertet ein `merge` auf
// ein fehlendes Dokument als `create` — deshalb landet der Aufruf in der
// `allow create`-Regel (Zeile 169) und nicht in `allow update` (181).
//
// ── WARUM DAS WICHTIGER IST ALS DER GAST-FALL ─────────────────────────────
// `evaluation error` ist NICHT dasselbe wie `false`. `false` heisst: Die
// Regel hat entschieden und abgelehnt. `evaluation error` heisst: Die Regel
// ist beim Rechnen abgestürzt. Eine abgestürzte Regel lehnt zwar ebenfalls
// ab — aber aus dem falschen Grund, und man weiss nicht, wann sie das nächste
// Mal an anderer Stelle abstürzt.
//
// Vor allem: Der Fall hängt NICHT am Gastkonto. Er kann jedes Konto beim
// allerersten Teil-Schreibvorgang treffen. Genau das prüft Abschnitt 2.
//
// ── WAS DIESE DATEI EINGRENZT ─────────────────────────────────────────────
//   1. Gast, Teil-Schreibvorgang auf fehlendes Dokument   (der beobachtete)
//   2. ANGEMELDET, derselbe Vorgang                        (die eigentliche Frage)
//   3. ANGEMELDET, vollständiges Anlegen                   (Gegenstück)
//   4. ANGEMELDET, `theme` auf VORHANDENES Dokument        (Gegenstück)
//
// Ergibt 2 einen Fehler und 3 einen Erfolg, liegt es am Teil-Schreibvorgang
// ohne die Pflichtfelder aus `isValidUser` — und der Wortlaut aus dem
// Protokoll sagt, an welcher Teilbedingung.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  const [wirt, hafen] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-klar',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: wirt || '127.0.0.1',
      port: Number(hafen) || 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

/**
 * Führt einen Schreibvorgang aus und PROTOKOLLIERT das Ergebnis.
 * Wirft nie — der Zweck ist die Auskunft, nicht das Urteil.
 */
const ergebnisse: { name: string; art: string; create: string; update: string }[] = [];

/** Zieht aus der Meldung heraus, was Firestore je Zweig gesagt hat. */
function zweig(meldung: string, welcher: 'create' | 'update'): string {
  if (new RegExp(`evaluation error[^,]*for '${welcher}'`).test(meldung)) return 'ABSTURZ';
  if (new RegExp(`false for '${welcher}'`).test(meldung)) return 'false';
  return '—';
}

async function protokolliere(name: string, tuWas: () => Promise<unknown>): Promise<void> {
  try {
    await tuWas();
    ergebnisse.push({ name, art: 'durchgelassen', create: 'ja', update: '—' });
    console.log(`\n  [${name}]\n    ERGEBNIS: durchgelassen\n`);
  } catch (fehler) {
    const meldung = fehler instanceof Error ? fehler.message : String(fehler);
    const art = /evaluation error/i.test(meldung)
      ? 'ABGESTUERZT'
      : /PERMISSION_DENIED|permission-denied/i.test(meldung)
        ? 'sauber abgelehnt'
        : 'anderer Fehler';
    ergebnisse.push({ name, art, create: zweig(meldung, 'create'), update: zweig(meldung, 'update') });
    console.log(`\n  [${name}]\n    ERGEBNIS: ${art}\n    WORTLAUT: ${meldung}\n`);
  }
}

// ── ÜBERSICHT AM ENDE ─────────────────────────────────────────────────────
// Beim Lauf vom 14.08.2026 sind mir die Faelle 2a bis 2c weggescrollt, und
// ich habe trotzdem eine Reparatur gebaut. Sie war falsch. Eine Diagnose,
// deren Ergebnis man nicht am Stueck sehen kann, verleitet genau dazu.
afterAll(() => {
  console.log('\n\n══ UEBERSICHT ' + '═'.repeat(61));
  console.log('\n  Fall                                    | Ergebnis        | create | update');
  console.log('  ' + '-'.repeat(76));
  for (const e of ergebnisse) {
    console.log(
      `  ${e.name.padEnd(38).slice(0, 38)} | ${e.art.padEnd(15)} | ${e.create.padEnd(6)} | ${e.update}`,
    );
  }
  console.log('\n  ABSTURZ = evaluation error (Regel gerechnet und gestolpert)');
  console.log('  false   = Regel hat entschieden und abgelehnt (richtig)\n');
  console.log('═'.repeat(75) + '\n');
});

describe('Diagnose: Teil-Schreibvorgang auf ein fehlendes Nutzerdokument', () => {
  // 1 — der beobachtete Fall. Gast, `merge` auf ein Dokument, das es nicht
  //     gibt. Erwartet wird eine Ablehnung (GAST-01). Die Frage ist, OB sie
  //     sauber ist oder ein Absturz.
  it('1 · Gast schreibt nur `theme` (Dokument fehlt)', async () => {
    const gast = env.authenticatedContext('gast', {
      firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
    await protokolliere('1 Gast, nur theme, Dokument fehlt', () =>
      setDoc(doc(gast, 'users/gast'), { theme: 'dark' }, { merge: true }),
    );
  });

  // 2 — DIE EIGENTLICHE FRAGE. Ein normal angemeldetes Konto, derselbe
  //     Vorgang. Trifft es auch hier, ist es kein Gast-Thema.
  it('2 · Angemeldetes Konto schreibt nur `theme` (Dokument fehlt)', async () => {
    const anna = env.authenticatedContext('anna', {
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    await protokolliere('2 Angemeldet, nur theme, Dokument fehlt', () =>
      setDoc(doc(anna, 'users/anna'), { theme: 'dark' }, { merge: true }),
    );
  });

  // 3 — Gegenstück: vollständiges Anlegen mit allen Pflichtfeldern.
  //     Gelingt das, liegt es am fehlenden Pflichtfeld und nicht am
  //     Anlegen an sich.
  it('3 · Angemeldetes Konto legt vollstaendig an', async () => {
    const anna = env.authenticatedContext('anna', {
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    await protokolliere('3 Angemeldet, vollstaendiges create', () =>
      setDoc(doc(anna, 'users/anna'), {
        uid: 'anna',
        createdAt: '2026-08-14',
        updatedAt: '2026-08-14',
        theme: 'dark',
      }),
    );
  });

  // 4 — Gegenstück: `theme` auf ein VORHANDENES Dokument. `theme` steht in
  //     der erlaubten Liste von `isValidUserUpdate`; das muss gelingen.
  //     Tut es das nicht, ist DAT-07 nicht vollstaendig behoben.
  it('4 · Angemeldetes Konto aendert `theme` am vorhandenen Dokument', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/anna'), {
        uid: 'anna',
        createdAt: '2026-08-01',
        updatedAt: '2026-08-01',
      });
    });
    const anna = env.authenticatedContext('anna', {
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    await protokolliere('4 Angemeldet, theme am vorhandenen Dokument', () =>
      setDoc(doc(anna, 'users/anna'), { theme: 'dark', updatedAt: '2026-08-14' }, { merge: true }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RUNDE 2 — welche Teilbedingung stuerzt ab?
//
// Runde 1 ergab: Teil-Schreibvorgang auf ein fehlendes Dokument stuerzt ab
// (Fall 2), vollstaendiges Anlegen geht durch (Fall 3). ZWEI Dinge waren an
// diesem Vergleich aber gleichzeitig verschieden:
//
//   Fall 2:  { theme }                        MIT    merge: true
//   Fall 3:  { uid, createdAt, updatedAt }    OHNE   merge
//
// Damit laesst sich nicht sagen, ob es an den fehlenden Pflichtfeldern liegt
// oder an `merge` selbst. Runde 2 trennt beides — jeweils genau EINE
// Aenderung gegenueber dem bekannten Fall.
//
// LESEART DES ERGEBNISSES:
//   · Stuerzt 2a (Pflichtfelder + merge) AB, liegt es an `merge`.
//   · Geht 2a DURCH, liegt es an den fehlenden Pflichtfeldern — und 2c/2d
//     sagen, an welchem.
//   · Stuerzt 2b (nur theme, OHNE merge) ebenfalls ab, ist `merge`
//     unbeteiligt und es liegt allein am Inhalt.
// ═══════════════════════════════════════════════════════════════════════════

const alsAnna = () =>
  env.authenticatedContext('anna', { firebase: { sign_in_provider: 'password' } }).firestore();

describe('Runde 2: merge oder Pflichtfelder?', () => {
  it('2a · Pflichtfelder vollstaendig, ABER mit merge', async () => {
    await protokolliere('2a vollstaendig + merge', () =>
      setDoc(
        doc(alsAnna(), 'users/anna'),
        { uid: 'anna', createdAt: '2026-08-14', updatedAt: '2026-08-14' },
        { merge: true },
      ),
    );
  });

  it('2b · nur `theme`, OHNE merge', async () => {
    await protokolliere('2b nur theme, ohne merge', () =>
      setDoc(doc(alsAnna(), 'users/anna'), { theme: 'dark' }),
    );
  });

  it('2c · nur `uid` (+ merge)', async () => {
    await protokolliere('2c nur uid + merge', () =>
      setDoc(doc(alsAnna(), 'users/anna'), { uid: 'anna' }, { merge: true }),
    );
  });

  it('2d · `uid` + `createdAt`, es fehlt nur `updatedAt` (+ merge)', async () => {
    await protokolliere('2d uid+createdAt, updatedAt fehlt', () =>
      setDoc(
        doc(alsAnna(), 'users/anna'),
        { uid: 'anna', createdAt: '2026-08-14' },
        { merge: true },
      ),
    );
  });

  it('2e · Pflichtfelder + ein GESPERRTES Feld (isVerified)', async () => {
    // Kontrollprobe: Dieser Fall MUSS abgelehnt werden — aber sauber, nicht
    // mit einem Absturz. Er prueft die zweite Bedingung der create-Regel
    // (`!keys().hasAny([...])`) getrennt von `isValidUser`.
    await protokolliere('2e vollstaendig + isVerified', () =>
      setDoc(doc(alsAnna(), 'users/anna'), {
        uid: 'anna',
        createdAt: '2026-08-14',
        updatedAt: '2026-08-14',
        isVerified: true,
      }),
    );
  });

  it('2f · leeres Objekt mit merge', async () => {
    // Der Grenzfall: gar nichts schreiben. Sagt, ob schon das blosse
    // Auswerten ohne jedes Feld stolpert.
    await protokolliere('2f leeres Objekt + merge', () =>
      setDoc(doc(alsAnna(), 'users/anna'), {}, { merge: true }),
    );
  });
});
