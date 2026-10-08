// ═══════════════════════════════════════════════════════════════════════════
// RUNDE 3 — was die Regelsprache tatsaechlich tut
//
// ── WARUM DIESE FORM ──────────────────────────────────────────────────────
// Runde 1 und 2 haben die ECHTEN Regeln befragt. Ergebnis: eine praezise
// Beschreibung, wann es kracht — aber keine Ursache, weil in jeder Regel
// mehrere Konstruktionen gleichzeitig stecken.
//
// Diese Runde befragt deshalb WINZIGE Regeln mit je EINER Konstruktion.
// `initializeTestEnvironment` nimmt beliebigen Regeltext; die echte
// firestore.rules wird hier gar nicht geladen.
//
// Zweimal habe ich vorher aus zwei gleichzeitigen Unterschieden geschlossen
// und lag falsch. Hier gibt es je Fall genau einen.
//
// ── DIE FRAGEN ───────────────────────────────────────────────────────────
// A  Schliesst `&&` bei `false && <Fehler>` kurz — oder kracht es?
// B  Schliesst der Ternaer `? :` richtig kurz?
// C  Kracht ein Feldzugriff auf ein fehlendes Feld ueberhaupt?
// D  Ist `resource` bei fehlendem Dokument `null` — und darf man das lesen?
// E  Was macht `data.get(feld, standard)`?
//
// AUSFUEHREN:  npm run test:rules-sprache
// ═══════════════════════════════════════════════════════════════════════════
// `before` entfaellt seit Runde 4: Jeder Fall baut seine eigene Umgebung
// (`mitRegel`/`frageMitFunktion`), es gibt keine gemeinsame Vorbereitung mehr.
// `noUnusedLocals` hat das gefangen — TS6133, dieselbe Form wie bei `PORT`
// (12.08.) und `contactDay` (14.08.).
import { afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const ergebnisse: { frage: string; ergebnis: string }[] = [];

/** Baut eine Umgebung mit GENAU der uebergebenen Bedingung. */
async function mitRegel(bedingung: string): Promise<RulesTestEnvironment> {
  const [wirt, hafen] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  return initializeTestEnvironment({
    projectId: 'demo-klar',
    firestore: {
      rules: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /probe/{id} {
      allow read: if true;
      allow write: if ${bedingung};
    }
  }
}`,
      host: wirt || '127.0.0.1',
      port: Number(hafen) || 8080,
    },
  });
}

async function frage(name: string, bedingung: string, daten: Record<string, unknown>, merge = false) {
  const env = await mitRegel(bedingung);
  try {
    await env.clearFirestore();
    const db = env.authenticatedContext('anna').firestore();
    await setDoc(doc(db, 'probe/p1'), daten, merge ? { merge: true } : {});
    ergebnisse.push({ frage: name, ergebnis: 'durchgelassen' });
  } catch (fehler) {
    const m = fehler instanceof Error ? fehler.message : String(fehler);
    ergebnisse.push({
      frage: name,
      ergebnis: /evaluation error/i.test(m) ? 'ABSTURZ' : 'sauber abgelehnt',
    });
  } finally {
    await env.cleanup();
  }
}

const D = 'request.resource.data';

describe('Runde 3: die Regelsprache selbst', () => {
  it('A · false && <Feldzugriff auf fehlendes Feld>', async () => {
    // DIE Kernfrage. Wenn das kracht, ist `&&` KEIN Schutz — und jede
    // Absicherung muss anders aussehen.
    await frage('A  false && data.fehlt is string', `false && ${D}.fehlt is string`, { a: 1 });
  });

  it('B · Ternaer: false ? <Feldzugriff> : true', async () => {
    await frage('B  false ? data.fehlt is string : true', `false ? ${D}.fehlt is string : true`, { a: 1 });
  });

  it('C · Feldzugriff auf ein fehlendes Feld, allein', async () => {
    await frage('C  data.fehlt is string (allein)', `${D}.fehlt is string`, { a: 1 });
  });

  it('D · hasAll(fehlt) && Feldzugriff — die Bauform aus isValidUser', async () => {
    await frage(
      'D  hasAll([b]) && data.b is string',
      `${D}.keys().hasAll(['b']) && ${D}.b is string`,
      { a: 1 },
    );
  });

  it('E · get() mit Standardwert statt direktem Zugriff', async () => {
    await frage('E  data.get(fehlt, "") == ""', `${D}.get('fehlt', '') == ''`, { a: 1 });
  });

  it('F · `in` vor dem Zugriff — die Form, die ich benutzt habe', async () => {
    await frage(
      'F  (!("b" in data) || data.b is string)',
      `(!('b' in ${D}) || ${D}.b is string)`,
      { a: 1 },
    );
  });

  it('G · resource bei fehlendem Dokument lesen', async () => {
    await frage('G  resource == null', 'resource == null', { a: 1 });
  });

  it('H · resource != null && resource.data.x == 1', async () => {
    await frage('H  resource != null && resource.data.x == 1', 'resource != null && resource.data.x == 1', { a: 1 });
  });

  it('I · Ternaer um resource herum', async () => {
    await frage('I  resource != null ? resource.data.x == 1 : true', 'resource != null ? resource.data.x == 1 : true', { a: 1 });
  });
});



// ═══════════════════════════════════════════════════════════════════════════
// RUNDE 4 — warum der Ternaer in der ECHTEN Regel nicht half
//
// Runde 3, Fall I zeigte: `resource != null ? resource.data.x == 1 : true`
// traegt. In `firestore.rules` eingebaut, aenderte es NICHTS.
//
// Der Unterschied zwischen Fall I und der echten Regel ist EINER:
// In der echten Regel steht kein direkter Zugriff, sondern ein
// FUNKTIONSAUFRUF mit `resource.data` als ARGUMENT:
//
//     resource != null ? isValidUserUpdate(request.resource.data, resource.data) : false
//
// Verdacht: Firestore wertet Funktionsargumente aus, BEVOR der Ternaer
// entscheidet. Dann waere jede Absicherung um den Aufruf herum wirkungslos,
// und die Pruefung muesste INNERHALB der Funktion sitzen.
//
// J und K trennen das. L prueft die Gegenmassnahme.
// ═══════════════════════════════════════════════════════════════════════════

async function frageMitFunktion(name: string, rumpf: string, bedingung: string) {
  const [wirt, hafen] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  const env = await initializeTestEnvironment({
    projectId: 'demo-klar',
    firestore: {
      rules: `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function pruef(d) { return ${rumpf}; }
    match /probe/{id} {
      allow read: if true;
      allow write: if ${bedingung};
    }
  }
}`,
      host: wirt || '127.0.0.1',
      port: Number(hafen) || 8080,
    },
  });
  try {
    await env.clearFirestore();
    await setDoc(doc(env.authenticatedContext('anna').firestore(), 'probe/p1'), { a: 1 });
    ergebnisse.push({ frage: name, ergebnis: 'durchgelassen' });
  } catch (fehler) {
    const m = fehler instanceof Error ? fehler.message : String(fehler);
    ergebnisse.push({
      frage: name,
      ergebnis: /evaluation error/i.test(m) ? 'ABSTURZ' : 'sauber abgelehnt',
    });
  } finally {
    await env.cleanup();
  }
}

describe('Runde 4: Funktionsaufruf im Ternaer', () => {
  it('J · Ternaer um einen FUNKTIONSAUFRUF mit resource.data', async () => {
    // Die exakte Bauform der echten Regel.
    await frageMitFunktion('J  cond ? pruef(resource.data) : true', 'd.x == 1', 'resource != null ? pruef(resource.data) : true');
  });

  it('K · Funktionsaufruf OHNE Ternaer, zum Vergleich', async () => {
    await frageMitFunktion('K  pruef(resource.data) allein', 'd.x == 1', 'pruef(resource.data)');
  });

  it('L · Pruefung INNERHALB der Funktion', async () => {
    // Die Gegenmassnahme, falls J kracht: Die Funktion bekommt `resource`
    // selbst und entscheidet drinnen.
    await frageMitFunktion('L  pruef(resource) mit Pruefung drinnen', 'd == null ? true : d.data.x == 1', 'pruef(resource)');
  });

  it('M · exists() statt resource != null', async () => {
    await frageMitFunktion(
      'M  !exists(pfad) || pruef(resource.data)',
      'd.x == 1',
      "!exists(/databases/(default)/documents/probe/$(id)) || pruef(resource.data)",
    );
  });
});



// ═══════════════════════════════════════════════════════════════════════════
// RUNDE 5 — der Ternaer in einer &&-Kette
//
// Runde 4, Fall J: `cond ? pruef(resource.data) : true` traegt — ALLEIN.
// In firestore.rules eingebaut, stuerzt L202 weiterhin ab. Der einzige
// verbliebene Unterschied: Dort steht der Ternaer nicht allein, sondern am
// Ende einer &&-Kette.
//
// N prueft genau das. O und P pruefen die beiden Auswege aus Runde 4
// (L und M) in derselben Einbettung.
// ═══════════════════════════════════════════════════════════════════════════
describe('Runde 5: Ternaer in einer &&-Kette', () => {
  it('N · true && (cond ? pruef(resource.data) : true)', async () => {
    await frageMitFunktion(
      'N  kette && (cond ? pruef(res.data) : true)',
      'd.x == 1',
      'request.auth != null && (resource != null ? pruef(resource.data) : true)',
    );
  });

  it('O · Kette + Pruefung INNERHALB der Funktion (Variante L)', async () => {
    await frageMitFunktion(
      'O  kette && pruef(resource) [drinnen]',
      'd == null ? true : d.data.x == 1',
      'request.auth != null && pruef(resource)',
    );
  });

  it('P · Kette + exists() (Variante M)', async () => {
    await frageMitFunktion(
      'P  kette && (!exists(pfad) || pruef(res.data))',
      'd.x == 1',
      "request.auth != null && (!exists(/databases/(default)/documents/probe/$(id)) || pruef(resource.data))",
    );
  });
});

afterAll(() => {
  console.log('\n\n══ RUNDE 3 — DIE REGELSPRACHE ' + '═'.repeat(45));
  console.log('\n  Frage                                        | Ergebnis');
  console.log('  ' + '-'.repeat(64));
  for (const e of ergebnisse) {
    console.log(`  ${e.frage.padEnd(44).slice(0, 44)} | ${e.ergebnis}`);
  }
  console.log('\n  ABSTURZ = evaluation error');
  console.log('  Alle Faelle sind so gebaut, dass sie OHNE Absturz `false`');
  console.log('  ergeben muessten — ausser E, F, G, I, die `true` ergeben sollten.\n');
  console.log('═'.repeat(75) + '\n');
});
