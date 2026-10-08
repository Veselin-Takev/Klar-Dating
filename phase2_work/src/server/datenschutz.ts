import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getDb as getFirestore } from './db';
import { persistConsentDecision } from './consentPersistence';
import { processAgeVerification } from './platform/ageGateEngine';
import { revokeExplicitConsent, type Art9Purpose } from './platform/consentEngine';
import {
  EINWILLIGUNG_VERSION,
  pruefeEinwilligung,
  ZWECKE,
} from './pure';

// ═══════════════════════════════════════════════════════════════════════════
// DSG-02 und DSG-04 — Alter, Einwilligung, Datenauskunft
//
// Alles Serverseitige zu diesen drei Befunden liegt hier, damit es genau
// eine Stelle gibt, an der `isAdult` und `einwilligung` geschrieben werden.
// Bei `isVerified` hat sich gezeigt, wie teuer eine zweite Schreibstelle
// ist: Ein vergessener Endpunkt hat die ganze Verifizierung ausgehebelt.
//
// Die Entscheidungslogik selbst steht in pure.ts und ist dort getestet
// (npm run test:pure). Hier steht nur, was ohne Firebase nicht geht.
// ═══════════════════════════════════════════════════════════════════════════

function uid(req: Request): string {
  return (req as { user?: { uid?: string } }).user?.uid as string;
}

function fehler(res: Response, code: number, nachricht: string): void {
  res.status(code).json({ error: nachricht });
}

// ── DSG-02a: Alter ─────────────────────────────────────────────────────────

/**
 * POST /api/account/alter   { geburtsdatum: "JJJJ-MM-TT" }
 *
 * Die EINZIGE Stelle, an der `isAdult` gesetzt wird. Der Client kann das
 * Feld nach den Firestore-Regeln nicht schreiben.
 *
 * Gespeichert wird das Geburtsdatum, nicht nur das Ergebnis: Ohne das Datum
 * liesse sich die Angabe später nicht nachvollziehen, und der 18. Geburtstag
 * einer heute 17-jährigen Person würde nie bemerkt. Datenminimierung spricht
 * dagegen — die Nachvollziehbarkeit der Alterszusage wiegt hier schwerer.
 */
export async function handleAlter(req: Request, res: Response): Promise<void> {
  const meineUid = uid(req);
  try {
    const outcome = await processAgeVerification(
      getFirestore(),
      meineUid,
      req.body?.geburtsdatum
    );

    if (!outcome.ok) {
      const statusCode = outcome.status === 'locked_underage'
        ? 403
        : outcome.code === 'underage_locked'
          ? 422
          : 400;
      const code = outcome.code === 'underage_locked'
        ? 'UNDERAGE_RESTRICTION'
        : outcome.status === 'locked_underage'
          ? 'UNDERAGE_ACCOUNT_LOCKED'
          : outcome.code === 'invalid_birthdate_zukunft'
            ? 'INVALID_BIRTHDATE_FUTURE'
            : outcome.code === 'invalid_birthdate_unplausibel'
              ? 'INVALID_BIRTHDATE_PLAUSIBILITY'
              : 'INVALID_BIRTHDATE';
      return res.status(statusCode).json({ code, error: outcome.error || 'Altersprüfung fehlgeschlagen.' });
    }

    res.json({ ok: true, alter: outcome.age, isAdult: true, evidenceDigest: outcome.evidenceDigest });
  } catch (e) {
    console.error('/api/account/alter', e);
    fehler(res, 500, 'Die Angabe konnte nicht gespeichert werden. Bitte erneut versuchen.');
  }
}

// ── DSG-02b: Einwilligung ──────────────────────────────────────────────────

/**
 * POST /api/einwilligung   { zwecke: { ki_auswertung: true, … } }
 *
 * Art. 7 Abs. 1 DSGVO verlangt den Nachweis, dass und WOZU eingewilligt
 * wurde. Deshalb wird jede Erteilung als eigener, unveränderlicher Eintrag
 * abgelegt — nicht als Feld, das die nächste Erteilung überschreibt. Der
 * aktuelle Stand steht zusätzlich am Profil, damit die Regeln und die
 * Endpunkte ihn ohne zweite Abfrage lesen können.
 */
export async function handleEinwilligung(req: Request, res: Response): Promise<void> {
  try {
    const pruefung = pruefeEinwilligung(req.body?.zwecke ?? req.body);
    if (!pruefung.ok) {
      fehler(res, 400, pruefung.grund);
      return;
    }
    const recordedAt = new Date().toISOString();
    const result = await persistConsentDecision(uid(req), () => ({
      action: 'granted',
      effectiveAt: recordedAt,
      state: {
        version: EINWILLIGUNG_VERSION,
        erteiltAm: recordedAt,
        zwecke: pruefung.zwecke,
        widerrufenAm: null,
      },
    }));
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('/api/einwilligung', e);
    fehler(res, 503, 'Die Einwilligung konnte nicht gespeichert werden. Bitte erneut versuchen.');
  }
}

/**
 * POST /api/einwilligung/widerruf   { zweck?: "ki_auswertung" }
 *
 * Ohne `zweck` wird die gesamte Einwilligung widerrufen. Der Widerruf muss
 * so einfach sein wie die Erteilung (Art. 7 Abs. 3 Satz 4) — deshalb ein
 * Aufruf ohne Pflichtangaben, ohne Rückfrage, ohne Halteschirm.
 *
 * Die Wirkung tritt sofort ein: `zweckErlaubt()` in pure.ts wertet
 * `widerrufenAm` aus, bevor irgendetwas verarbeitet wird.
 */
export async function handleEinwilligungWiderruf(req: Request, res: Response): Promise<void> {
  try {
    const zweck = req.body?.zweck;
    if (zweck !== undefined && (typeof zweck !== 'string' || !ZWECKE.includes(zweck as (typeof ZWECKE)[number]))) {
      fehler(res, 400, 'Unbekannter Einwilligungszweck.');
      return;
    }
    const jetzt = new Date().toISOString();
    const result = await persistConsentDecision(uid(req), bisher => ({
      action: 'withdrawn',
      effectiveAt: jetzt,
      withdrawnPurpose: zweck ?? 'alle',
      state: {
        version: bisher?.version ?? EINWILLIGUNG_VERSION,
        erteiltAm: bisher?.erteiltAm ?? null,
        zwecke: zweck
          ? { ...(bisher?.zwecke ?? {}), [zweck]: false, notwendig: true }
          : { notwendig: true },
        // A partial withdrawal must never revive a previously revoked grant.
        widerrufenAm: zweck ? (bisher?.widerrufenAm ?? null) : jetzt,
      },
    }));

    // Trigger cascade purge of Art. 9 data and immutable withdrawal audit log
    await revokeExplicitConsent(
      getFirestore(),
      uid(req),
      (zweck === 'ki_auswertung' ? 'ai_personality_insights' : (zweck as Art9Purpose || 'all'))
    ).catch((err) => {
      console.warn('Cascade Art. 9 purge log:', err);
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('/api/einwilligung/widerruf', e);
    fehler(res, 503, 'Der Widerruf konnte nicht gespeichert werden. Bitte erneut versuchen.');
  }
}


/**
 * POST /api/einwilligung/zweck — atomare Einzelentscheidung für einen optionalen Zweck.
 * Die Servertransaktion liest den aktuellen Stand und schreibt die neue
 * Entscheidung zusammen mit einem signierten HMAC-SHA256-Nachweis.
 */
export async function handleEinwilligungZweck(req: Request, res: Response): Promise<void> {
  const zweck = req.body?.zweck;
  const erlaubt = req.body?.erlaubt;
  if (typeof zweck !== 'string' || !ZWECKE.includes(zweck as (typeof ZWECKE)[number]) || zweck === 'notwendig' || typeof erlaubt !== 'boolean') {
    fehler(res, 400, 'Ungültige Einwilligungsentscheidung.');
    return;
  }
  try {
    const jetzt = new Date().toISOString();
    const result = await persistConsentDecision(uid(req), bisher => {
      const zwecke = {
        notwendig: true,
        ...(bisher?.zwecke ?? {}),
        [zweck]: erlaubt,
      } as Record<(typeof ZWECKE)[number], boolean>;
      return {
        action: erlaubt ? 'granted' : 'withdrawn',
        effectiveAt: jetzt,
        withdrawnPurpose: erlaubt ? undefined : zweck,
        state: {
          version: EINWILLIGUNG_VERSION,
          erteiltAm: bisher?.erteiltAm ?? jetzt,
          zwecke,
          widerrufenAm: erlaubt ? (bisher?.widerrufenAm ?? null) : jetzt,
        },
      };
    });
    if (!erlaubt) {
      await revokeExplicitConsent(getFirestore(), uid(req), zweck === 'ki_auswertung' ? 'ai_personality_insights' : (zweck as Art9Purpose || 'all')).catch(err => console.warn('Cascade Art. 9 purge log:', err));
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('/api/einwilligung/zweck', e);
    fehler(res, 503, 'Die Einwilligungsänderung konnte nicht gespeichert werden.');
  }
}

/** GET /api/einwilligung — aktueller Stand und die geltende Fassung. */
export async function handleEinwilligungLesen(req: Request, res: Response): Promise<void> {
  try {
    const snapshot = await getFirestore().collection('users').doc(uid(req)).get();
    res.json({
      einwilligung: snapshot.data()?.einwilligung ?? null,
      aktuelleVersion: EINWILLIGUNG_VERSION,
      zwecke: ZWECKE,
    });
  } catch (e) {
    console.error('/api/einwilligung (lesen)', e);
    fehler(res, 503, 'Der Stand konnte nicht geladen werden.');
  }
}

// ── DSG-04: Datenauskunft (Art. 15) und Übertragbarkeit (Art. 20) ──────────

/**
 * GET /api/account/export
 *
 * BEFUND: `DataExportWidget.tsx` las zwei localStorage-Schlüssel. Damit
 * enthielt die Auskunft weder Profil noch Nachrichten noch Verbindungen —
 * also fast nichts von dem, was tatsächlich gespeichert ist. Eine Antwort
 * auf ein Auskunftsersuchen wäre materiell unvollständig gewesen.
 *
 * JSON, weil Art. 20 ein „strukturiertes, gängiges und maschinenlesbares
 * Format" verlangt.
 *
 * NICHT ENTHALTEN und bewusst so:
 *   · Nachrichten der jeweils anderen Person. Sie sind deren Daten; eine
 *     Auskunft an A darf B nicht mit ausliefern. Enthalten sind daher nur
 *     die selbst verfassten Nachrichten und die Gesprächsteilnahme.
 *   · Meldungen ÜBER diese Person — sonst wäre jede Meldung durch ein
 *     Auskunftsersuchen aufdeckbar (Art. 15 Abs. 4).
 */
export async function handleExport(req: Request, res: Response): Promise<void> {
  const meineUid = uid(req);
  try {
    const db = getFirestore() as unknown;

    const profil = await db.collection('users').doc(meineUid).get();

    // GEGENPRÜFUNG: E-Mail und Anzeigename liegen in Firebase Auth, nicht in
    // Firestore. Sie fehlten im Export, obwohl die Verarbeitungsübersicht sie
    // ausdrücklich als verarbeitetes Datum nennt.
    let konto: Record<string, unknown> = { uid: meineUid };
    try {
      const a = await getAuth().getUser(meineUid);
      konto = {
        uid: meineUid,
        email: a.email ?? null,
        anzeigename: a.displayName ?? null,
        anbieter: a.providerData.map((p) => p.providerId),
        angelegtAm: a.metadata.creationTime,
        letzteAnmeldung: a.metadata.lastSignInTime,
      };
    } catch (e) {
      console.error('Export: Auth-Daten nicht ladbar', e);
      fehler(res, 503, 'Die Auskunft konnte wegen nicht verfügbarer Kontodaten nicht vollständig erstellt werden. Bitte erneut versuchen.');
      return;
    }

    const CHAT_GRENZE = 200;
    const chats = await db.collection('chats').where('participants', 'array-contains', meineUid).limit(CHAT_GRENZE + 1).get();
    const gespraeche: unknown[] = [];
    // GEGENPRÜFUNG: Der Export lief unbegrenzt über alle Chats, mit einer
    // Abfrage je Chat. Bei vielen Gesprächen läuft die Anfrage in die
    // Zeitgrenze und liefert gar nichts — eine Auskunft, die bei Vielnutzern
    // scheitert, ist keine. Grenze mit sichtbarem Hinweis statt stiller
    // Kürzung.
    const chatDocs = chats.docs.slice(0, CHAT_GRENZE);
    for (const c of chatDocs) {
      const nachrichten = await c.ref.collection('messages').where('senderId', '==', meineUid).get();
      // GEGENPRÜFUNG: `lastMessage` am Chatdokument kann der Text der
      // ANDEREN Person sein. Deshalb wird das Feld nicht ausgegeben.
      gespraeche.push({
        chatId: c.id,
        beteiligte: c.data().participants,
        begonnenAm: c.data().createdAt ?? null,
        eigeneNachrichten: nachrichten.docs.map((m: unknown) => ({
          id: m.id, text: m.data().text, createdAt: m.data().createdAt,
        })),
        hinweis: 'Nachrichten der anderen Person sind deren Daten und deshalb nicht enthalten.',
      });
    }
    // Eigene Antworten im Icebreaker-Gate: bis zu 1000 Zeichen selbst
    // verfasster Freitext je Antwort. Fehlten im ersten Entwurf.
    const gateAntworten: unknown[] = [];
    for (const c of chatDocs) {
      const g = await c.ref.collection('gate_answers').get();
      g.docs
        .filter((d: unknown) => d.data().uid === meineUid || d.id.startsWith(meineUid + '_'))
        .forEach((d: unknown) => gateAntworten.push({ chatId: c.id, id: d.id, ...d.data() }));
    }

    const sammeln = async (pfad: string, feld: string) =>
      (await db.collection(pfad).where(feld, '==', meineUid).get()).docs.map((d: unknown) => ({ id: d.id, ...d.data() }));

    const [kontakteVon, kontakteAn, blockiert, meldungen, einwilligungen, quota,
           abo, verifizierung, altersversuche, kiZwischenspeicher, aiBudget] = await Promise.all([
      sammeln('contacts', 'fromUid'),
      sammeln('contacts', 'toUid'),
      sammeln('blocks', 'blockerUid'),
      sammeln('reports', 'reporterId'),
      db.collection('users').doc(meineUid).collection('einwilligungen').get(),
      db.collection('users').doc(meineUid).collection('quota_ledger').get(),
      // GEGENPRÜFUNG: Abo, Verifizierung und Altersversuche fehlten — alles
      // Daten zu dieser Person, alle unter Art. 15 auskunftspflichtig.
      db.collection('subscriptions').doc(meineUid).get(),
      db.collection('verification_events').where('uid', '==', meineUid).get(),
      db.collection('age_attempts').where('uid', '==', meineUid).get(),
      // 11.08.2026: Der Zwischenspeicher fuer KI-Auswertungen. Er enthaelt
      // Aussagen UEBER diese Person und ist damit auskunftspflichtig. Neu
      // angelegte Ablagen gehoeren hier eingetragen — sonst entsteht eine
      // Luecke, die niemandem auffaellt.
      db.collection('users').doc(meineUid).collection('ki_zwischenspeicher').get(),
      db.collection('users').doc(meineUid).collection('ai_budget').get(),
    ]);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="klar-auskunft-${meineUid.slice(0, 8)}.json"`);
    res.json({
      erstelltAm: new Date().toISOString(),
      rechtsgrundlage: 'Art. 15 und Art. 20 DSGVO',
      konto,
      produktanalyse: await sammeln('funnel_events', 'userId'),
      profil: profil.exists ? profil.data() : null,
      gespraeche,
      gespraechsvollstaendig: chats.size <= CHAT_GRENZE,
      gespraecheGesamt: chats.size,
      gateAntworten,
      abo: abo.exists ? abo.data() : null,
      verifizierung: verifizierung.docs.map((d: unknown) => ({ id: d.id, ...d.data() })),
      altersversuche: altersversuche.docs.map((d: unknown) => ({ id: d.id, ...d.data() })),
      kontakte: { ausgehend: kontakteVon, eingehend: kontakteAn },
      blockierungen: blockiert,
      eigeneMeldungen: meldungen,
      einwilligungen: einwilligungen.docs.map((d: unknown) => ({ id: d.id, ...d.data() })),
      kontingent: quota.docs.map((d: unknown) => ({ id: d.id, ...d.data() })),
      kiZwischenspeicher: kiZwischenspeicher.docs.map((d: unknown) => ({ id: d.id, ...d.data() })),
      aiBudget: aiBudget.docs.map((d: unknown) => ({ id: d.id, ...d.data() })),
      nichtEnthalten: [
        'Nachrichten anderer Personen — deren Daten.',
        'Die Vorschauzeile eines Gesprächs (lastMessage) — sie kann von der anderen Person stammen.',
        'Meldungen über dieses Konto — Art. 15 Abs. 4 DSGVO.',
        'Serverprotokolle mit technischen Kennungen.',
        chats.size > CHAT_GRENZE
          ? `Nur die ersten ${CHAT_GRENZE} von ${chats.size} Gesprächen. Für den Rest bitte melden.`
          : null,
      ].filter(Boolean),
    });
  } catch (e) {
    console.error('/api/account/export', e);
    fehler(res, 500, 'Die Auskunft konnte nicht vollständig erstellt werden. Bitte erneut versuchen.');
  }
}
