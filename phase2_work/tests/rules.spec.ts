import { readFileSync } from 'node:fs';
import { afterAll as after, beforeAll as before, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

// ═══════════════════════════════════════════════════════════════════════════
// Firestore-Regeln gegen den Emulator
//
// WOZU: Regeln, die nie ausgeführt wurden, sind Vermutungen. Dieser Punkt
// steht seit dem ersten Prüfbericht offen. Die Regeln behaupten seither
// Dinge — dass sich niemand selbst verifizieren kann, dass Meldungen für
// niemanden lesbar sind, dass der Kontingentzähler dem Server gehört. Erst
// dieser Lauf sagt, ob das stimmt.
//
// AUSFÜHREN:
//   npm run test:rules
//   (startet den Firestore-Emulator, braucht Java 17 — im Devcontainer da)
//
// Jeder Test prüft GENAU EINE Regel. Ein Test, der drei Dinge auf einmal
// prüft, sagt bei Rot nicht, welches davon kaputt ist.
// ═══════════════════════════════════════════════════════════════════════════

let env: RulesTestEnvironment;

const ANNA = 'anna';
const BEA = 'bea';
const CARL = 'carl';

before(async () => {
  // Das Präfix `demo-` ist Pflicht, kein Geschmack: Nur bei einer so
  // benannten Projekt-ID verlangt die Firebase-CLI keine Anmeldung und
  // spricht garantiert nie mit echten Daten. Dieselbe ID steht in
  // `test:rules` hinter `--project`; weichen beide voneinander ab, lehnt
  // der Emulator wegen `singleProjectMode` jede Anfrage ab.
  // BEFUND 11.08.2026: Hier standen Wirt und Port fest verdrahtet auf
  // 127.0.0.1:8080 — derselbe Port, den `npm run dev:lokal` benutzt. Lief
  // der Entwicklungsserver, brach `npm run verify` an dieser Stelle ab
  // („Port 8080 is not open… could not start Firestore Emulator"). Das ist
  // an einem Tag fuenfmal passiert und hat jedes Mal Zeit gekostet, ohne
  // dass am Code etwas falsch war.
  //
  // `firebase emulators:exec` setzt FIRESTORE_EMULATOR_HOST auf den
  // tatsaechlich verwendeten Wirt und Port. Wird der gelesen statt geraten,
  // koennen Regeltests und Entwicklungsserver nebeneinander laufen — die
  // Regeltests benutzen ueber `firebase.pruefung.json` den Port 8085.
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

after(async () => {
  await env?.cleanup();
});

/** Ausgangslage vor jedem Test: Anna verifiziert, Bea verifiziert,
 *  Carl NICHT verifiziert. Geschrieben mit umgangenen Regeln — sonst
 *  liesse sich `isVerified` gar nicht setzen, was ja der Punkt ist. */
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/anna'), {
      uid: ANNA, createdAt: '2026-08-01', updatedAt: '2026-08-01', isVerified: true, name: 'Anna',
    });
    await setDoc(doc(db, 'users/bea'), {
      uid: BEA, createdAt: '2026-08-01', updatedAt: '2026-08-01', isVerified: true, name: 'Bea',
    });
    await setDoc(doc(db, 'users/carl'), {
      uid: CARL, createdAt: '2026-08-01', updatedAt: '2026-08-01', isVerified: false, name: 'Carl',
    });
  });
});

const als = (uid: string) => env.authenticatedContext(uid).firestore();
const anonym = () => env.unauthenticatedContext().firestore();

// ── GAST-01 (14.08.2026) ──────────────────────────────────────────────────
// Ein Gastkonto ist ANGEMELDET, aber anonym. Der Unterschied steht im Token:
// Firebase setzt bei `signInAnonymously()` `firebase.sign_in_provider` auf
// "anonymous". Genau darauf prueft `istGast()` in firestore.rules.
//
// `authenticatedContext(uid, tokenOptions)` reicht die Angaben in das
// Mock-Token durch. Ob die Bibliothek `firebase.sign_in_provider` dabei
// tatsaechlich uebernimmt, ist die EINE Annahme in diesem Abschnitt, die ich
// nicht am Schreibtisch pruefen konnte.
//
// Deshalb steht unten eine Kontrollprobe: Ein Gast DARF sein Nutzerdokument
// anlegen und darf es NICHT aendern. Griffe die Angabe nicht, wuerde der
// zweite Test gruen statt rot — und der Abschnitt meldete genau das, was er
// nicht mehr leisten kann. Ein Test, der bei fehlender Wirkung stillschweigend
// durchlaeuft, ist schlimmer als keiner.
const alsGast = (uid: string) =>
  env
    .authenticatedContext(uid, {
      firebase: { sign_in_provider: 'anonymous', identities: {} },
    })
    .firestore();

// ── Profile ────────────────────────────────────────────────────────────────

describe('Profile', () => {
  // DAT-02 — DIESER TEST STAND HIER GENAU ANDERSHERUM.
  // Er lautete „fremdes Profil lesbar — sonst gäbe es keine Vorschläge" und
  // hielt damit die Annahme fest, die der Prüfbericht als Befund benannte.
  // Nachgesehen: Kein Lesezugriff im Client betrifft ein fremdes Profil, die
  // Vorschläge kommen aus vier erfundenen Datensätzen in src/data.ts. Die
  // Begründung im Testnamen war falsch — und ein Test, der eine falsche
  // Annahme festschreibt, verteidigt sie.
  it('fremdes Vollprofil ist NICHT lesbar (Stimmungen, Plan, Geburtsdatum)', async () => {
    await assertFails(getDoc(doc(als(ANNA), 'users/bea')));
  });

  it('eigenes Profil bleibt lesbar', async () => {
    await assertSucceeds(getDoc(doc(als(ANNA), 'users/anna')));
  });

  it('nicht angemeldet: nichts lesbar', async () => {
    await assertFails(getDoc(doc(anonym(), 'users/bea')));
  });

  it('eigenes Profil bearbeiten geht', async () => {
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users/anna'), { name: 'Anna B.', updatedAt: '2026-08-09' }));
  });

  it('fremdes Profil bearbeiten geht nicht', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users/bea'), { name: 'Hacked', updatedAt: '2026-08-09' }));
  });

  // DER BEFUND AUS DEM AUDIT: Vorher hiess die Regel-Funktion isVerified(),
  // prüfte aber nur die Anmeldung — und das Feld war frei schreibbar.
  it('SELBSTVERIFIZIERUNG ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(CARL), 'users/carl'), { isVerified: true, updatedAt: '2026-08-09' }));
  });

  it('sich selbst Klar Plus geben ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(CARL), 'users/carl'), { plan: 'plus', updatedAt: '2026-08-09' }));
  });

  it('sich selbst eine Rolle geben ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(CARL), 'users/carl'), { roles: ['moderator'], updatedAt: '2026-08-09' }));
  });

  it('den Kontingentzähler selbst setzen ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users/anna'), { contactCount: 0, updatedAt: '2026-08-09' }));
  });

  it('Profil anlegen mit unbekanntem Client-Feld ist gesperrt', async () => {
    await assertFails(setDoc(doc(als('neu-schema'), 'users/neu-schema'), {
      uid: 'neu-schema', createdAt: 'x', updatedAt: 'x', name: 'Neu', bio: '', interests: [], goal: 'undecided',
      clientInjectedRole: 'admin',
    }));
  });

  it('Profil anlegen mit ungültigem Theme ist gesperrt', async () => {
    await assertFails(setDoc(doc(als('neu-theme'), 'users/neu-theme'), {
      uid: 'neu-theme', createdAt: 'x', updatedAt: 'x', name: 'Neu', bio: '', interests: [], goal: 'undecided', theme: 'admin',
    }));
  });

  it('Profil anlegen mit isVerified im Dokument ist gesperrt', async () => {
    await assertFails(setDoc(doc(als('neu'), 'users/neu'), {
      uid: 'neu', createdAt: 'x', updatedAt: 'x', isVerified: true,
    }));
  });

  // DSG-02: Alter und Einwilligung sind Serverfelder. Vorher stand
  // `isAdult: true` fest verdrahtet im Client.
  it('sich selbst volljährig setzen ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(CARL), 'users/carl'), { isAdult: true, updatedAt: '2026-08-09' }));
  });

  it('Geburtsdatum selbst setzen ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(CARL), 'users/carl'), { geburtsdatum: '1990-01-01', updatedAt: '2026-08-09' }));
  });

  it('sich selbst eine Einwilligung eintragen ist gesperrt', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users/anna'),
      { einwilligung: { version: 1, zwecke: { ki_auswertung: true } }, updatedAt: '2026-08-09' }));
  });

  it('Profil anlegen mit isAdult im Dokument ist gesperrt', async () => {
    await assertFails(setDoc(doc(als('neu2'), 'users/neu2'), {
      uid: 'neu2', createdAt: 'x', updatedAt: 'x', isAdult: true,
    }));
  });

  it('Einwilligungsnachweis ist für Clients unsichtbar und unschreibbar', async () => {
    await assertFails(getDoc(doc(als(ANNA), 'users/anna/einwilligungen/e1')));
    await assertFails(setDoc(doc(als(ANNA), 'users/anna/einwilligungen/e1'), { version: 1 }));
  });

  it('Fehlversuche bei der Altersangabe sind gesperrt', async () => {
    await assertFails(addDoc(collection(als(ANNA), 'age_attempts'), { uid: ANNA }));
    await assertFails(getDoc(doc(als(ANNA), 'age_attempts/x')));
  });

  // DAT-07: `theme` und `moodHistory` standen in keiner Feldliste. Beide
  // Widgets schrieben sie trotzdem — und wurden abgelehnt, ohne dass es
  // jemandem auffiel.
  it('Theme speichern geht', async () => {
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users/anna'), { theme: 'dark', updatedAt: '2026-08-09' }));
  });

  it('Stimmungseintrag speichern geht', async () => {
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users/anna'), {
      moodHistory: [{ mood: 'gut', timestamp: 1 }], updatedAt: '2026-08-09',
    }));
  });

  it('gültige Musikpräferenzen sind speicherbar', async () => {
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users/anna'), {
      interests: ['Musik'],
      musicPreferences: {
        genres: ['Rock', 'Jazz'],
        concertGoer: true,
        playingInstrument: false,
      },
      updatedAt: '2026-09-20',
    }));
  });

  it('unvollständige oder übergroße Musikpräferenzen werden abgelehnt', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users/anna'), {
      musicPreferences: { genres: ['Rock'], concertGoer: true },
      updatedAt: '2026-09-20',
    }));
    await assertFails(updateDoc(doc(als(ANNA), 'users/anna'), {
      musicPreferences: {
        genres: Array.from({ length: 21 }, (_, i) => `genre-${i}`),
        concertGoer: true,
        playingInstrument: false,
      },
      updatedAt: '2026-09-20',
    }));
  });

  // Die Kehrseite von hasOnly: ein Feld, das in keiner Liste steht, wird
  // abgelehnt — auch wenn ein erlaubtes danebensteht. Vorher liess `hasAny`
  // genau das durch.
  it('ein nicht vorgesehenes Feld wird abgelehnt, auch neben einem erlaubten', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users/anna'), {
      name: 'Anna', irgendwas: 'x', updatedAt: '2026-08-09',
    }));
  });

  it('Profil löschen geht nur über den Server', async () => {
    await assertFails(deleteDoc(doc(als(ANNA), 'users/anna')));
  });
});

// ── Öffentliches Profil (DAT-02) ───────────────────────────────────────────

describe('Öffentliches Profil', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/anna'), { isAdult: true }, { merge: true });
      await setDoc(doc(ctx.firestore(), 'users/bea'), { isAdult: true }, { merge: true });
      await setDoc(doc(ctx.firestore(), 'public_profiles/bea'), {
        uid: BEA, name: 'Bea', age: 31, ort: 'Leipzig', bio: 'kurz', isVerified: true,
      });
    });
  });

  it('angemeldet lesbar — hier stehen die Vorschläge, wenn K-2 gebaut ist', async () => {
    await assertSucceeds(getDoc(doc(als(ANNA), 'public_profiles/bea')));
  });

  it('nicht angemeldet: nichts', async () => {
    await assertFails(getDoc(doc(anonym(), 'public_profiles/bea')));
  });

  it('blockiert: auch das öffentliche Profil verschwindet', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocks/bea_anna'), { blockerUid: BEA, blockedUid: ANNA });
    });
    await assertFails(getDoc(doc(als(ANNA), 'public_profiles/bea')));
  });

  it('der Client kann den Spiegel nicht schreiben', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'public_profiles/anna'), { uid: ANNA, name: 'Anna' }));
  });
});

// ── Sozialgraph (DAT-03) ───────────────────────────────────────────────────

describe('Verbindungen', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'connections/x1'), { fromUid: ANNA, toUid: BEA });
      await setDoc(doc(ctx.firestore(), 'connections/x2'), { senderId: BEA, receiverId: CARL });
    });
  });

  it('Beteiligte dürfen lesen', async () => {
    await assertSucceeds(getDoc(doc(als(ANNA), 'connections/x1')));
    await assertSucceeds(getDoc(doc(als(BEA), 'connections/x1')));
  });

  // DER BEFUND: vorher las jedes angemeldete Konto den gesamten Sozialgraphen.
  it('Unbeteiligte dürfen NICHT lesen', async () => {
    await assertFails(getDoc(doc(als(CARL), 'connections/x1')));
  });

  it('auch bei der zweiten Feldbenennung greift die Regel', async () => {
    await assertSucceeds(getDoc(doc(als(CARL), 'connections/x2')));
    await assertFails(getDoc(doc(als(ANNA), 'connections/x2')));
  });

  it('eine UID als Teil der Dokument-ID gewährt keinen Zugriff', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'connections/anna-is-not-a-participant'), {
        fromUid: BEA,
        toUid: CARL,
      });
    });
    await assertFails(getDoc(doc(als(ANNA), 'connections/anna-is-not-a-participant')));
  });

  it('schreiben darf nur der Server', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'connections/neu'), { fromUid: ANNA, toUid: BEA }));
  });
});

// ── Blockierungen ──────────────────────────────────────────────────────────

describe('Blockierungen', () => {
  it('blockieren geht mit der Doc-ID <von>_<an>', async () => {
    await assertSucceeds(setDoc(doc(als(ANNA), 'blocks/anna_bea'), { blockerUid: ANNA, blockedUid: BEA }));
  });

  it('im fremden Namen blockieren ist gesperrt', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'blocks/bea_carl'), { blockerUid: BEA, blockedUid: CARL }));
  });

  it('Doc-ID, die nicht zum Feld passt, wird abgelehnt', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'blocks/anna_carl'), { blockerUid: ANNA, blockedUid: BEA }));
  });

  it('eine eigene Blockierung kann wieder aufgehoben werden', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocks/anna_bea'), { blockerUid: ANNA, blockedUid: BEA });
    });
    await assertSucceeds(deleteDoc(doc(als(ANNA), 'blocks/anna_bea')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocks/anna_bea'), { blockerUid: ANNA, blockedUid: BEA });
    });
    await assertFails(deleteDoc(doc(als(BEA), 'blocks/anna_bea')));
  });

  it('eigene Blockierung lesbar, fremde nicht', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocks/bea_carl'), { blockerUid: BEA, blockedUid: CARL });
    });
    await assertSucceeds(getDoc(doc(als(BEA), 'blocks/bea_carl')));
    // Auch die blockierte Person darf den Eintrag nicht sehen — eine
    // Blockierung, die sich nachweisen lässt, ist keine.
    await assertFails(getDoc(doc(als(CARL), 'blocks/bea_carl')));
  });

  // Der Eintrag ist gerichtet, die WIRKUNG beidseitig: blocked() prüft
  // beide Richtungen. Carl blockiert Anna — Anna sieht Carl nicht mehr.
  //
  // Geprüft wird das jetzt an `public_profiles`, nicht mehr an `users`:
  // Seit DAT-02 ist ein fremdes Profil ohnehin nicht lesbar, ein Test
  // dagegen wäre also auch bei kaputtem blocked() grün. Ein Test, der aus
  // dem falschen Grund besteht, ist schlimmer als keiner.
  it('Blockierte verschwinden beidseitig aus den Vorschlägen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'public_profiles/anna'), { uid: ANNA, name: 'Anna' });
      await setDoc(doc(ctx.firestore(), 'public_profiles/carl'), { uid: CARL, name: 'Carl' });
      await setDoc(doc(ctx.firestore(), 'blocks/carl_anna'), { blockerUid: CARL, blockedUid: ANNA });
    });
    await assertFails(getDoc(doc(als(ANNA), 'public_profiles/carl')));
    await assertFails(getDoc(doc(als(CARL), 'public_profiles/anna')));
  });
});

// ── Gespräche ──────────────────────────────────────────────────────────────

describe('Gespräche', () => {
  it('kann das Gate weder bei Erstellung noch per Update selbst freischalten', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'chats/forged_gate'), {
      participants: [ANNA, BEA], createdAt: '2026-09-22', gateAntwortenA: 2, gateAntwortenB: 2,
    }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/anna_bea'), {
        participants: [ANNA, BEA], createdAt: '2026-09-22', gateAntwortenA: 0, gateAntwortenB: 0,
      });
    });
    await assertFails(updateDoc(doc(als(ANNA), 'chats/anna_bea'), { gateAntwortenA: 2, gateAntwortenB: 2 }));
    await assertFails(updateDoc(doc(als(BEA), 'chats/anna_bea'), { gateFragen: [] }));
  });

  it('verifizierte Person kann ein Gespräch beginnen', async () => {
    await assertSucceeds(setDoc(doc(als(ANNA), 'chats/anna_bea'), {
      participants: [ANNA, BEA], createdAt: '2026-08-09',
    }));
  });

  it('bestehende Blockierung verhindert die Anlage eines neuen Gesprächs in beide Richtungen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocks/bea_anna'), { blockerUid: BEA, blockedUid: ANNA });
    });
    await assertFails(setDoc(doc(als(ANNA), 'chats/blocked_pair'), {
      participants: [ANNA, BEA], createdAt: '2026-09-29',
    }));
  });

  // Kernmechanik: ohne Verifizierung kein Kontakt.
  it('NICHT verifizierte Person kann kein Gespräch beginnen', async () => {
    await assertFails(setDoc(doc(als(CARL), 'chats/carl_bea'), {
      participants: [CARL, BEA], createdAt: '2026-08-09',
    }));
  });

  it('Gespräch ohne eigene Beteiligung anlegen ist gesperrt', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'chats/bea_carl'), {
      participants: [BEA, CARL], createdAt: '2026-08-09',
    }));
  });

  it('fremdes Gespräch lesen ist gesperrt', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/bea_carl'), { participants: [BEA, CARL], createdAt: 'x' });
    });
    await assertFails(getDoc(doc(als(ANNA), 'chats/bea_carl')));
  });

  it('Teilnehmerliste nachträglich ändern ist gesperrt', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/anna_bea'), { participants: [ANNA, BEA], createdAt: 'x' });
    });
    await assertFails(updateDoc(doc(als(ANNA), 'chats/anna_bea'), {
      participants: [ANNA, CARL], lastMessage: 'x', lastMessageAt: 'y',
    }));
  });

  it('Gespräch einseitig löschen ist gesperrt', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/anna_bea'), { participants: [ANNA, BEA], createdAt: 'x' });
    });
    await assertFails(deleteDoc(doc(als(ANNA), 'chats/anna_bea')));
  });
});

// ── Nachrichten ────────────────────────────────────────────────────────────

describe('Nachrichten', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/anna_bea'), {
        participants: [ANNA, BEA], createdAt: 'x', gateAntwortenA: 2, gateAntwortenB: 2,
      });
      await setDoc(doc(ctx.firestore(), 'chats/anna_bea/messages/m1'), {
        senderId: ANNA, text: 'Hallo', createdAt: 'x', isRead: false,
      });
    });
  });

  it('Teilnehmerin kann nicht mehr direkt schreiben (nur Server)', async () => {
    await assertFails(addDoc(collection(als(ANNA), 'chats/anna_bea/messages'), {
      chatId: 'anna_bea', senderId: ANNA, text: 'Hallo', createdAt: '2026-08-09',
    }));
  });

  it('im fremden Namen schreiben ist gesperrt', async () => {
    await assertFails(addDoc(collection(als(ANNA), 'chats/anna_bea/messages'), {
      chatId: 'anna_bea', senderId: BEA, text: 'Gefälscht', createdAt: '2026-08-09',
    }));
  });

  it('Aussenstehende können nicht schreiben', async () => {
    await assertFails(addDoc(collection(als(CARL), 'chats/anna_bea/messages'), {
      chatId: 'anna_bea', senderId: CARL, text: 'Hallo', createdAt: '2026-08-09',
    }));
  });

  it('Aussenstehende können nicht mitlesen', async () => {
    await assertFails(getDoc(doc(als(CARL), 'chats/anna_bea/messages/x')));
  });

  it('Teilnehmende können Nachrichten erst nach vollständig offenem Gate lesen', async () => {
    await assertSucceeds(getDoc(doc(als(ANNA), 'chats/anna_bea/messages/m1')));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'chats/anna_bea'), { gateAntwortenB: 1 });
    });
    await assertFails(getDoc(doc(als(ANNA), 'chats/anna_bea/messages/m1')));
  });

  it.each([
    ['anna_bea', ANNA, BEA],
    ['bea_anna', BEA, ANNA],
  ])('Blockierung %s sperrt Chat-Metadaten und Nachrichten beidseitig', async (blockId, blockerUid, blockedUid) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocks/' + blockId), { blockerUid, blockedUid });
    });
    await assertFails(getDoc(doc(als(ANNA), 'chats/anna_bea')));
    await assertFails(getDoc(doc(als(BEA), 'chats/anna_bea')));
    await assertFails(getDoc(doc(als(ANNA), 'chats/anna_bea/messages/m1')));
    await assertFails(getDoc(doc(als(BEA), 'chats/anna_bea/messages/m1')));
  });

  it('laufende Kontolöschung der Gegenperson sperrt direkte Chat- und Nachrichtenreads', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'account_deletions/bea'), { uid: BEA, status: 'pending' });
    });
    await assertFails(getDoc(doc(als(ANNA), 'chats/anna_bea')));
    await assertFails(getDoc(doc(als(ANNA), 'chats/anna_bea/messages/m1')));
  });

  // Nachträglich änderbare Nachrichten machen jede Meldung nach DSA Art. 16
  // wertlos — der gemeldete Inhalt wäre dann nicht mehr da.
  it('Nachrichten sind unveränderlich', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/anna_bea/messages/m1'), {
        chatId: 'anna_bea', senderId: ANNA, text: 'Original', createdAt: 'x',
      });
    });
    await assertFails(updateDoc(doc(als(ANNA), 'chats/anna_bea/messages/m1'), { text: 'Geändert' }));
    await assertFails(deleteDoc(doc(als(ANNA), 'chats/anna_bea/messages/m1')));
  });

  it('Text über 1000 Zeichen wird abgelehnt', async () => {
    await assertFails(addDoc(collection(als(ANNA), 'chats/anna_bea/messages'), {
      chatId: 'anna_bea', senderId: ANNA, text: 'x'.repeat(1001), createdAt: '2026-08-09',
    }));
  });
});

// ── Serverseitige Sammlungen ───────────────────────────────────────────────

describe('Was nur dem Server gehört', () => {
  it('Meldungen: weder lesen noch schreiben', async () => {
    await assertFails(addDoc(collection(als(ANNA), 'reports'), { reporterId: ANNA }));
    await assertFails(getDoc(doc(als(ANNA), 'reports/irgendeine')));
  });

  it('Kontakte: nicht schreibbar — sonst zählt niemand mit', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'contacts/anna_bea'), { fromUid: ANNA, toUid: BEA }));
  });

  it('eigene Kontakte sind lesbar', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'contacts/anna_bea'), { fromUid: ANNA, toUid: BEA });
    });
    await assertSucceeds(getDoc(doc(als(ANNA), 'contacts/anna_bea')));
    await assertSucceeds(getDoc(doc(als(BEA), 'contacts/anna_bea')));
    await assertFails(getDoc(doc(als(CARL), 'contacts/anna_bea')));
  });

  it('KI-Zwischenspeicher: weder lesen noch schreiben — auch nicht der eigene', async () => {
    // ENTSCHEIDUNG 11.08.2026: Der Zwischenspeicher enthaelt KI-Auswertungen
    // ueber die Person. Waere er direkt lesbar, umginge man die Regel, dass
    // solche Auswertungen nur MIT ausgewiesener Herkunft und ausgewiesenem
    // Alter ausgeliefert werden — beides setzt der Server beim Antworten.
    // Auskunft gibt es ueber /api/account/export, nicht ueber die Datenbank.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${ANNA}/ki_zwischenspeicher/api_mood-monitor`), {
        daten: { moodCategory: 'harmonisch' },
        zeit: '2026-08-12T10:00:00.000Z',
      });
    });
    await assertFails(getDoc(doc(als(ANNA), `users/${ANNA}/ki_zwischenspeicher/api_mood-monitor`)));
    await assertFails(setDoc(doc(als(ANNA), `users/${ANNA}/ki_zwischenspeicher/api_mood-monitor`), { daten: {}, zeit: 'x' }));
    await assertFails(getDoc(doc(als(BEA), `users/${ANNA}/ki_zwischenspeicher/api_mood-monitor`)));
  });

  it('Verifizierungsanträge sind für Clients unsichtbar', async () => {
    await assertFails(getDoc(doc(als(ANNA), 'verification_requests/x')));
    await assertFails(setDoc(doc(als(ANNA), 'verification_requests/x'), { uid: ANNA }));
  });

  it('Abo: eigenes lesbar, nicht schreibbar', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'subscriptions/anna'), { plan: 'plus' });
    });
    await assertSucceeds(getDoc(doc(als(ANNA), 'subscriptions/anna')));
    await assertFails(getDoc(doc(als(BEA), 'subscriptions/anna')));
    await assertFails(setDoc(doc(als(ANNA), 'subscriptions/anna'), { plan: 'plus' }));
  });

  it('Kontingent-Ledger: eigenes lesbar, nicht schreibbar', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'users/anna/quota_ledger/e1'), { plus: 3 }));
  });

  it('Warteschlangen und Protokolle sind vollständig gesperrt', async () => {
    for (const pfad of ['mail_queue', 'refund_queue', 'deletion_log', 'subscription_events', 'ad_transactions']) {
      await assertFails(addDoc(collection(als(ANNA), pfad), { x: 1 }));
      await assertFails(getDoc(doc(als(ANNA), `${pfad}/x`)));
    }
  });
});

// ── Gastzugang ─────────────────────────────────────────────────────────────
//
// BEFUND 14.08.2026: Diese Datei hatte 54 Tests und keinen einzigen fuer ein
// Gastkonto — weil die Regeln bis dahin keines kannten. „Als Gast
// fortfahren" gab volle Rechte.
//
// Die Linie steht in `src/server/gastrechte.ts`: Vorschau ja, Interaktion
// nein. Was der Server abweist, weisen die Regeln unabhaengig davon noch
// einmal ab — der Server ist die eine Sperre, die Regeln sind die zweite.
// Faellt eine aus, haelt die andere.

describe('Gastzugang', () => {
  const GAST = 'gast';

  // ── KONTROLLPROBE ────────────────────────────────────────────────────────
  // Erst nachweisen, dass der Gast-Kontext ueberhaupt schreiben KANN. Ohne
  // diesen Test wuerde ein Gastkontext, der aus einem ganz anderen Grund
  // scheitert (falsche uid, fehlendes Pflichtfeld), alle folgenden Tests
  // gruen faerben — und der Abschnitt behauptete eine Sperre, die er nie
  // geprueft hat.
  it('KONTROLLE: ein Gast darf sein Nutzerdokument anlegen', async () => {
    // Ohne das kaeme ein Gast nicht durch die Altersabfrage und damit
    // nirgendwohin. Anlegen ja, Aendern nein — siehe naechster Test.
    await assertSucceeds(
      setDoc(doc(alsGast(GAST), `users/${GAST}`), {
        uid: GAST, createdAt: '2026-08-14', updatedAt: '2026-08-14', name: 'Gast', bio: '', interests: [], goal: 'undecided',
      }),
    );
  });

  it('ein Gast darf sein Nutzerdokument NICHT aendern', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `users/${GAST}`), {
        uid: GAST, createdAt: '2026-08-14', updatedAt: '2026-08-14', name: 'Gast',
      });
    });
    await assertFails(
      updateDoc(doc(alsGast(GAST), `users/${GAST}`), { name: 'Neu', updatedAt: '2026-08-15' }),
    );
  });

  it('ein dauerhaftes Konto darf sein Nutzerdokument weiterhin aendern', async () => {
    // Die Gegenprobe zum vorigen Test in derselben Datei: Waere die Sperre zu
    // weit gefasst, faende man es hier — und nicht erst im Betrieb.
    await assertSucceeds(
      updateDoc(doc(als(ANNA), 'users/anna'), { name: 'Anna neu', updatedAt: '2026-08-15' }),
    );
  });

  it('ein Gast kann keinen Chat anlegen', async () => {
    // Zwei Sperren treffen hier zusammen: `isVerified` (ein Gast ist nie
    // verifiziert) und `istGast()`. Der Test sagt nur, DASS es scheitert.
    await assertFails(
      setDoc(doc(alsGast(GAST), 'chats/c1'), {
        participants: [GAST, ANNA], createdAt: '2026-08-14', updatedAt: '2026-08-14',
      }),
    );
  });

  it('ein Gast kann in einen bestehenden Chat keine Nachricht schreiben', async () => {
    // Der Chat wird mit umgangenen Regeln angelegt, damit WIRKLICH die
    // Nachrichtenregel geprueft wird und nicht die Chatregel davor.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/c1'), {
        participants: [GAST, ANNA], createdAt: '2026-08-14', updatedAt: '2026-08-14',
      });
    });
    await assertFails(
      setDoc(doc(alsGast(GAST), 'chats/c1/messages/m1'), {
        chatId: 'c1', senderId: GAST, text: 'Hallo', createdAt: '2026-08-14',
      }),
    );
  });

  it('ein Gast kann keinen Kontakt eintragen', async () => {
    // Kontakte schreibt ohnehin nur der Server. Der Test haelt fest, dass das
    // auch fuer Gaeste gilt — und faellt auf, falls jemand die Sammlung
    // spaeter fuer Clients oeffnet.
    await assertFails(
      setDoc(doc(alsGast(GAST), `contacts/${GAST}_anna`), { fromUid: GAST, toUid: ANNA }),
    );
  });

  it('ein Gast kann seine Einwilligung nicht selbst schreiben', async () => {
    await assertFails(
      setDoc(doc(alsGast(GAST), `users/${GAST}/einwilligungen/e1`), { zweck: 'ki_auswertung' }),
    );
  });
});

// ── Vorgabe ────────────────────────────────────────────────────────────────

describe('Vorgabe ist Verweigerung', () => {
  it('eine Sammlung, die in den Regeln nicht steht, ist gesperrt', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'irgendwas/x'), { a: 1 }));
    await assertFails(getDoc(doc(als(ANNA), 'irgendwas/x')));
  });
});

describe('Enterprise RBAC and append-only audit logs', () => {
  const alsAdmin = (uid: string) => env.authenticatedContext(uid, { roles: ['admin'] }).firestore();
  const alsTrustSafety = (uid: string) => env.authenticatedContext(uid, { roles: ['trust_safety'] }).firestore();

  it('custom-claim admin can read audit logs', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_logs/a1'), {
        schemaVersion: 1,
        type: 'test.audit',
        actorPseudonym: 'a'.repeat(64),
        timestamp: new Date(),
        metadata: {},
      });
    });
    await assertSucceeds(getDoc(doc(alsAdmin(ANNA), 'audit_logs/a1')));
  });

  it('ordinary users cannot read audit logs', async () => {
    await assertFails(getDoc(doc(als(ANNA), 'audit_logs/a1')));
  });

  it('trust-and-safety custom claim can read audit logs', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_logs/a2'), {
        schemaVersion: 1,
        type: 'test.audit',
        actorPseudonym: 'b'.repeat(64),
        timestamp: new Date(),
        metadata: {},
      });
    });
    await assertSucceeds(getDoc(doc(alsTrustSafety(BEA), 'audit_logs/a2')));
  });

  it('audit logs are append-only even for privileged claims', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'audit_logs/a3'), {
        schemaVersion: 1,
        type: 'test.audit',
        actorPseudonym: 'c'.repeat(64),
        timestamp: new Date(),
        metadata: {},
      });
    });
    await assertFails(setDoc(doc(alsAdmin(ANNA), 'audit_logs/a3'), { schemaVersion: 1 }));
    await assertFails(updateDoc(doc(alsAdmin(ANNA), 'audit_logs/a3'), { type: 'test.changed' }));
    await assertFails(deleteDoc(doc(alsAdmin(ANNA), 'audit_logs/a3')));
  });
});
