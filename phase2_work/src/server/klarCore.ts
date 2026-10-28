import { getAppBucket } from './storage';
import { toPublicProfile } from './platform/launchPlatform';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
/**
 * ── STRATEGISCHER ENTSCHEID (08.09.2026) ─────────────────────────────────
 * GAMIFICATION & MONETARISIERUNGS-PIVOT PAUSIERT (Ab 500 Nutzer)
 *
 * Siehe Dokumentation in server.ts: Das erweiterte Monetarisierungs-
 * und Gamification-Konzept bleibt pausiert. Die Kern-Mechanik bleibt
 * minimalistisch: 8 Kontakte/Tag, 2 Zahlwege (Klar Plus / Ads).
 * ────────────────────────────────────────────────────────────────────────
 */

import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from './db';
import { getDb as getFirestore } from './db';
import { ContractError, acceptDeclaration, declarationSchema } from './contracts';
import {
  CHALLENGE_TTL_MS,
  DAILY_CONTACTS,
  InputError,
  contactDay,
  entscheideKontakt,
  optionalString,
  pruefeChallenge,
  requireString,
  verifizierungsStatus,
  waehleGeste,
  withdrawalPossible,
} from './pure';

// ═══════════════════════════════════════════════════════════════════════════
// Klar — Kernmechanik (P1)
//
//   Kontingent      8 KONTAKTE pro Tag, serverseitig in einer Transaktion
//   Verifizierung   Server gibt die Geste vor, Sichtprüfung entscheidet
//   Icebreaker-Gate zwei Fragen beidseitig, dann freier Chat
//   § 312k / § 356a Kündigung und Widerruf als getrennte Wege
//
// BEFUND, den das ablöst: Das Kontingent lag vollständig im localStorage
// (`klar_contacts_left`). Der Client entschied, wie viele Kontakte er hatte —
// ein Wert, den jede Person in der Entwicklerkonsole ändern kann. Damit war
// das Limit eine Anzeige, keine Grenze.
// ═══════════════════════════════════════════════════════════════════════════

const db = () => getFirestore();
const uid = (req: Request): string => {
  const value = req.user?.uid;
  if (!value) throw new Error('Unauthorized');
  return value;
};

function fehler(res: Response, e: unknown, wo: string) {
  if (e instanceof InputError) {
    res.status(400).json({ error: e.message });
    return;
  }
  console.error(wo, e);
  res.status(500).json({ error: 'Das hat gerade nicht geklappt. Bitte erneut versuchen.' });
}

function zuDatum(v: unknown): Date | null {
  if (!v) return null;
  const m = v as { toDate?: () => Date };
  if (typeof m.toDate === 'function') return m.toDate();
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Kontingent ─────────────────────────────────────────────────────────────

export async function handleQuota(req: Request, res: Response): Promise<void> {
  try {
    const snap = await db().collection('users').doc(uid(req)).get();
    const d = snap.data() ?? {};
    const heute = contactDay();
    const verbraucht = d.contactDay === heute ? (d.contactCount ?? 0) : 0;
    const plan = d.plan === 'plus' ? 'plus' : 'frei';
    // 14.08.2026: Vorher stand hier `plan === 'plus' ? null : …` — Klar+
    // bekam „unbegrenzt" gemeldet. Acht gelten fuer alle (klar/27, 9c);
    // `plan` wird weiterhin gemeldet, weil die Oberflaeche ihn anzeigt,
    // aber er aendert die Zahlen nicht mehr.
    res.json({
      uebrig: Math.max(0, DAILY_CONTACTS - verbraucht),
      gesamt: DAILY_CONTACTS,
      plan,
      naechsterTag: '04:00',
    });
  } catch (e) {
    fehler(res, e, '/api/quota');
  }
}

/**
 * Beginnt einen Kontakt. Zähler und Kontaktdokument entstehen in EINER
 * Transaktion — zwei gleichzeitige Anfragen können sich nicht überholen,
 * und ein Abbruch dazwischen kann den Zähler nicht erhöhen, ohne dass der
 * Kontakt entsteht.
 *
 * Die Dokument-ID ist `<von>_<an>`: Ein zweiter Kontakt an dieselbe Person
 * ist damit technisch unmöglich, ohne dass eine Abfrage nötig wäre.
 */
export async function handleContact(req: Request, res: Response): Promise<void> {
  const meine = uid(req);
  try {
    const ziel = requireString(req.body?.targetUid, 'targetUid', 128);
    if (ziel === meine) throw new InputError('Kein Kontakt zum eigenen Konto.');

    const firestore = db();
    const heute = contactDay();
    const nutzer = firestore.collection('users').doc(meine);
    const kontakt = firestore.collection('contacts').doc(`${meine}_${ziel}`);

    const ergebnis = await firestore.runTransaction(async (t: Transaction) => {
      const [u, k, target, deletion] = await Promise.all([t.get(nutzer), t.get(kontakt),
        t.get(firestore.collection('users').doc(ziel)), t.get(firestore.collection('account_deletions').doc(ziel))]);
      if (!target.exists || deletion.exists) throw new InputError('Profil nicht verfügbar.');
      const d = u.data() ?? {};

      // Verifizierung ist Voraussetzung — dieselbe Bedingung wie in den
      // Firestore-Regeln. Zwei Stellen, eine Aussage.
      if (d.isVerified !== true) return { ok: false as const, grund: 'nicht_verifiziert' as const };
      if (k.exists) return { ok: false as const, grund: 'bereits_kontaktiert' as const };

      const e = entscheideKontakt(
        {
          tag: d.contactDay ?? '',
          verbraucht: d.contactCount ?? 0,
          plan: d.plan === 'plus' ? 'plus' : 'frei',
          // 14.08.2026: `extraContacts`/`extraTag` entfallen — die Werbe-
          // belohnung samt /api/admob-ssv ist gestrichen (MVP-Entscheidung).
        },
        heute,
      );
      if (!e.erlaubt) return { ok: false as const, grund: 'limit' as const };

      t.set(nutzer, { contactDay: heute, contactCount: e.neuVerbraucht }, { merge: true });
      t.set(kontakt, {
        fromUid: meine,
        toUid: ziel,
        at: FieldValue.serverTimestamp(),
        tag: heute,
      });
      return { ok: true as const, uebrig: e.uebrig };
    });

    if (ergebnis.ok) {
      res.json({
        ok: true,
        uebrig: ergebnis.uebrig,
        gesamt: DAILY_CONTACTS,
      });
      return;
    }

    const meldung = {
      limit: `Für heute sind alle ${DAILY_CONTACTS} Kontakte vergeben. Morgen um 4 Uhr gibt es neue.`,
      nicht_verifiziert: 'Für den ersten Kontakt ist die Verifizierung nötig.',
      bereits_kontaktiert: 'Diese Person hast du bereits angeschrieben.',
    }[ergebnis.grund as "limit" | "nicht_verifiziert" | "bereits_kontaktiert"];
    res.status(409).json({ ok: false, grund: ergebnis.grund, error: meldung });
  } catch (e) {
    fehler(res, e, '/api/contact');
  }
}

/**
 * Rücknahme innerhalb von 5 Sekunden — mit vollständigem Revert, AUCH des
 * Zählers. Eine Rücknahme, die den Zähler nicht zurücksetzt, ist keine.
 */
export async function handleContactUndo(req: Request, res: Response): Promise<void> {
  const meine = uid(req);
  try {
    const ziel = requireString(req.body?.targetUid, 'targetUid', 128);
    const firestore = db();
    const nutzer = firestore.collection('users').doc(meine);
    const kontakt = firestore.collection('contacts').doc(`${meine}_${ziel}`);

    const ok = await firestore.runTransaction(async (t: Transaction) => {
      const [u, k, target, deletion] = await Promise.all([t.get(nutzer), t.get(kontakt),
        t.get(firestore.collection('users').doc(ziel)), t.get(firestore.collection('account_deletions').doc(ziel))]);
      if (!target.exists || deletion.exists) throw new InputError('Profil nicht verfügbar.');
      if (!k.exists) return false;
      const angelegt = zuDatum(k.data()?.at);
      // Frist serverseitig prüfen. Eine clientseitig gemessene Frist ist
      // keine Frist.
      if (angelegt && Date.now() - angelegt.getTime() > 5_000) return false;
      const d = u.data() ?? {};
      t.delete(kontakt);
      t.set(nutzer, { contactCount: Math.max(0, (d.contactCount ?? 1) - 1) }, { merge: true });
      return true;
    });

    if (!ok) {
      res.status(409).json({ error: 'Die Rücknahme ist nicht mehr möglich.' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    fehler(res, e, '/api/contact/undo');
  }
}

// ── Verifizierung ──────────────────────────────────────────────────────────

export async function handleVerificationStatus(req: Request, res: Response): Promise<void> {
  try {
    const d = (await db().collection('users').doc(uid(req)).get()).data() ?? {};
    const status = verifizierungsStatus(d);
    res.json({
      status,
      begruendung: d.verificationBegruendung ?? null,
      offeneGeste: status === 'nicht_begonnen' || status === 'abgelehnt' ? (d.verificationGeste ?? null) : null,
    });
  } catch (e) {
    fehler(res, e, '/api/verification/status');
  }
}

export async function handleVerificationChallenge(req: Request, res: Response): Promise<void> {
  const meine = uid(req);
  try {
    const d = (await db().collection('users').doc(meine).get()).data() ?? {};
    if (d.isVerified === true) {
      res.status(409).json({ error: 'Das Konto ist bereits verifiziert.' });
      return;
    }
    if (d.verificationStatus === 'in_pruefung') {
      res.status(409).json({ error: 'Es läuft bereits eine Prüfung.' });
      return;
    }
    const geste = waehleGeste(0);
    await db().collection('users').doc(meine).set(
      {
        verificationGeste: geste,
        verificationChallengeAt: FieldValue.serverTimestamp(),
        verificationChallengeUsedAt: null,
      },
      { merge: true },
    );
    res.json({ geste, gueltigSekunden: Math.floor(CHALLENGE_TTL_MS / 1000), pfad: `verification/${meine}/aktuell.jpg` });
  } catch (e) {
    fehler(res, e, '/api/verification/challenge');
  }
}

export async function handleVerificationSubmit(req: Request, res: Response): Promise<void> {
  const meine = uid(req);
  try {
    const pfad = requireString(req.body?.pfad, 'pfad', 300);
    const bildBase64 = requireString(req.body?.bildBase64, 'bildBase64', 20000000);
    const mimeType = requireString(req.body?.mimeType, 'mimeType', 50);

    // Ein fremder Pfad wäre der Versuch, eine fremde Einreichung als eigene
    // auszugeben.
    if (!pfad.startsWith(`verification/${meine}/`)) {
      throw new InputError('Der Pfad gehört nicht zu diesem Konto.');
    }
    const d = (await db().collection('users').doc(meine).get()).data() ?? {};
    if (d.isVerified === true) {
      res.status(409).json({ error: 'Das Konto ist bereits verifiziert.' });
      return;
    }
    const p = pruefeChallenge({
      ausgegebenAm: zuDatum(d.verificationChallengeAt),
      benutztAm: zuDatum(d.verificationChallengeUsedAt),
    });
    if (!p.gueltig) {
      res.status(409).json({
        grund: p.grund,
        error: {
          keine_challenge: 'Bitte zuerst die Geste anfordern.',
          abgelaufen: 'Die Geste ist abgelaufen. Bitte eine neue anfordern.',
          bereits_benutzt: 'Diese Geste wurde bereits eingereicht.',
        }[p.grund],
      });
      return;
    }

    // This is a manual review queue. A generic image model cannot prove identity.
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(bildBase64)) {
      throw new InputError('Ungültiges Bildformat.');
    }
    const bytes = Buffer.from(bildBase64, 'base64');
    if (!bytes.length || bytes.length >= 8 * 1024 * 1024) throw new InputError('Bild ist zu groß oder leer.');
    const signatureValid = mimeType === 'image/jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : mimeType === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!signatureValid) throw new InputError('Bildinhalt passt nicht zum Format.');
    await getAppBucket().file(pfad).save(bytes, { metadata: { contentType: mimeType }, resumable: false });

    const antrag = await db().collection('verification_requests').add({
      uid: meine,
      geste: d.verificationGeste ?? null,
      pfad,
      eingereichtAm: FieldValue.serverTimestamp(),
      status: 'in_pruefung',
      entscheidung: null,
      begruendung: null,
    });
    await db().collection('users').doc(meine).set(
      {
        verificationStatus: 'in_pruefung',
        verificationRequestId: antrag.id,
        verificationPfad: pfad,
        verificationChallengeUsedAt: FieldValue.serverTimestamp(),
        verificationBegruendung: null,
      },
      { merge: true },
    );
    res.json({
      ok: true,
      status: 'in_pruefung',
      vorgang: antrag.id.slice(0, 8).toUpperCase(),
      hinweis: 'Wir sehen uns das an. Das dauert in der Regel unter 24 Stunden.',
    });
  } catch (e) {
    fehler(res, e, '/api/verification/submit');
  }
}

/**
 * Sichtprüfung durch Moderation; Didit entscheidet ausschließlich über signierte Webhooks.
 * Die Rolle kommt aus dem Token (Custom Claim), nicht aus Firestore: Ein
 * Feld im Nutzerdokument könnte im Grenzfall vom Konto selbst geschrieben
 * werden, ein Claim nicht.
 */
export async function handleVerificationDecide(req: Request, res: Response): Promise<void> {
  try {
    let claims: Record<string, unknown> = req.user ? req.user as unknown as Record<string, unknown> : {};
    try {
      const konto = await getAuth().getUser(uid(req));
      if (konto?.customClaims) {
        claims = { ...claims, ...konto.customClaims };
      }
    } catch {
      // Fallback to token claims if Identity Toolkit API is unreachable
    }
    const role = typeof claims.role === 'string' ? claims.role : '';
    const roles = Array.isArray(claims.roles) ? (claims.roles as unknown[]).filter((value: unknown): value is string => typeof value === 'string') : [];
    if (claims.moderator !== true && claims.admin !== true && claims.super_admin !== true && role !== 'moderator' && role !== 'trust_safety' && !roles.includes('moderator') && !roles.includes('trust_safety') && !roles.includes('admin') && !roles.includes('super_admin')) {
      res.status(401).json({ error: 'Nicht berechtigt.' });
      return;
    }
    const ziel = requireString(req.body?.uid, 'uid', 128);
    const entscheidung = requireString(req.body?.entscheidung, 'entscheidung', 20);
    if (entscheidung !== 'bestaetigt' && entscheidung !== 'abgelehnt') {
      throw new InputError('entscheidung muss "bestaetigt" oder "abgelehnt" sein.');
    }
    // DSA Art. 17: Eine Ablehnung ist eine Beschränkung und braucht eine
    // Begründung. Deshalb Pflichtfeld, nicht optional.
    const begruendung =
      entscheidung === 'abgelehnt'
        ? requireString(req.body?.begruendung, 'begruendung', 1000)
        : optionalString(req.body?.begruendung, 'begruendung', 1000);

    const bestaetigt = entscheidung === 'bestaetigt';
    const firestore = db() as Firestore;
    // Capture immutable GCS generation before making the moderation decision;
    // the Firestore transaction rechecks this is still the same request/path.
    const decisionUser = (await firestore.collection('users').doc(ziel).get()).data() ?? {};
    const decisionRequestId = typeof decisionUser.verificationRequestId === 'string' ? decisionUser.verificationRequestId : '';
    const decisionPath = typeof decisionUser.verificationPfad === 'string' ? decisionUser.verificationPfad : '';
    if (!decisionRequestId || !decisionPath.startsWith(`verification/${ziel}/`))
      throw new InputError('Verifizierungsobjekt fehlt.');
    const [metadata] = await getAppBucket().file(decisionPath).getMetadata();
    const storageGeneration = String(metadata.generation ?? '');
    if (!/^[1-9][0-9]*$/.test(storageGeneration) || metadata.temporaryHold === true || metadata.eventBasedHold === true)
      throw new InputError('Die Objektversion ist nicht verfügbar.');
    await firestore.runTransaction(async tx => {
      const userRef = firestore.collection('users').doc(ziel);
      const [user, deletion] = await tx.getAll(userRef, firestore.collection('account_deletions').doc(ziel));
      if (!user?.exists || deletion?.exists) throw new InputError('Konto nicht verfügbar.');
      const userData = user.data() ?? {};
      const requestId = typeof userData.verificationRequestId === 'string' ? userData.verificationRequestId : '';
      const storagePath = typeof userData.verificationPfad === 'string' ? userData.verificationPfad : '';
      if (!requestId || !storagePath || requestId !== decisionRequestId || storagePath !== decisionPath)
         throw new InputError('Verifizierungsantrag hat sich während der Prüfung geändert.');
      const requestRef = firestore.collection('verification_requests').doc(requestId);
      const request = await tx.get(requestRef);
      if (!request.exists || request.data()?.uid !== ziel) throw new InputError('Verifizierungsantrag ist nicht verfügbar.');
      if (request.data()?.status !== 'in_pruefung') throw new InputError('Verifizierungsantrag wurde bereits entschieden.');
      const decidedAt = new Date();
      const decision = { isVerified: bestaetigt, verificationStatus: entscheidung,
        verificationBegruendung: begruendung || null, verificationEntschiedenAm: FieldValue.serverTimestamp(),
        verificationRequestId: null, verificationPfad: null };
      tx.update(userRef, decision);
      tx.update(requestRef, { status: entscheidung, entscheidung, begruendung: begruendung || null, entschiedenAm: FieldValue.serverTimestamp() });
      tx.create(firestore.collection('verification_events').doc(), { uid: ziel, moderatorUid: uid(req),
        entscheidung, begruendung: begruendung || null, at: FieldValue.serverTimestamp(), decidedAt,
        storagePath, storageGeneration, photoPurged: false, fotoLoeschenAb: new Date(decidedAt.getTime() + 30 * 86_400_000) });
      const publicProfile = toPublicProfile(ziel, { ...user.data(), ...decision });
      const publicRef = firestore.collection('public_profiles').doc(ziel);
      if (bestaetigt && publicProfile) tx.set(publicRef, publicProfile); else tx.delete(publicRef);
    });
    res.json({ ok: true, isVerified: bestaetigt });
  } catch (e) {
    fehler(res, e, '/api/verification/decide');
  }
}

// ── § 312k Kündigung und § 356a Widerruf ───────────────────────────────────
//
// Zwei verschiedene Rechte mit verschiedenen Folgen: Der Widerruf beseitigt
// den Vertrag rückwirkend, die Kündigung beendet ihn für die Zukunft. Sie
// dürfen NICHT zu einem Weg zusammengefasst werden.
//
// Fehlt die Kündigungsschaltfläche, ist der Vertrag nach § 312k Abs. 6 BGB
// jederzeit fristlos kündbar — der Anbieter verliert die Vertragsbindung.

async function ladeAbo(uidStr: string) {
  const d = (await db().collection('subscriptions').doc(uidStr).get()).data() ?? {};
  return {
    plan: d.plan === 'plus' ? ('plus' as const) : ('frei' as const),
    startedAt: zuDatum(d.startedAt),
    paidUntil: zuDatum(d.paidUntil),
    cancelledAt: zuDatum(d.cancelledAt),
    withdrawnAt: zuDatum(d.withdrawnAt),
    cancellationStatus: d.cancellationStatus === 'pending' || d.cancellationStatus === 'completed' ? d.cancellationStatus : null,
  };
}

export async function handleSubscriptionStatus(req: Request, res: Response): Promise<void> {
  try {
    const s = await ladeAbo(uid(req));
    res.json({
      plan: s.plan,
      paidUntil: s.paidUntil?.toISOString() ?? null,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
      cancellationStatus: s.cancellationStatus,
      widerrufMoeglich: withdrawalPossible(s),
    });
  } catch (e) {
    fehler(res, e, '/api/subscription/status');
  }
}

async function acceptAuthenticatedContract(req: Request, res: Response, kind: 'cancel' | 'withdraw') {
  try {
    const { randomUUID } = await import('node:crypto');
    let email = req.user?.email;
    let name = req.user?.name || uid(req);
    try {
      const account = await getAuth().getUser(uid(req));
      if (account.email) email = account.email;
      if (account.displayName) name = account.displayName;
    } catch {
      // Identity Toolkit API may be offline/disabled; fallback to token claims
    }
    if (!email) { res.status(400).json({ code: 'confirmation_email_required' }); return; }
    const profile = (await db().collection('users').doc(uid(req)).get()).data() ?? {};
    const subscription = await db().collection('subscriptions').doc(uid(req)).get();
    const subscriptionData = subscription.data() ?? {};
    if (kind === 'cancel' && subscriptionData.plan !== 'plus') { res.status(409).json({ code: 'no_active_subscription' }); return; }
    const terminationAt = kind === 'cancel' && subscriptionData.paidUntil instanceof Date ? subscriptionData.paidUntil :
      kind === 'cancel' && typeof subscriptionData.paidUntil?.toDate === 'function' ? subscriptionData.paidUntil.toDate() : null;
    const requestedEnd = terminationAt instanceof Date && !Number.isNaN(terminationAt.getTime()) ? terminationAt.toISOString().slice(0, 10) : '';
    const input = declarationSchema.parse({ requestId: req.body?.requestId ?? randomUUID(), kind,
      language: ['de', 'en', 'es', 'fr'].includes(profile?.language) ? profile.language : 'de',
      name: name, email: email,
      contract: profile?.subscriptionId || 'Klar Plus', reason: req.body?.grund ?? '', cancellationType: 'ordinary', requestedEnd });
    const receipt = await acceptDeclaration(db(), input, uid(req), { terminationAt });
    const { deliverContractReceipt } = await import('./complianceJobs');
    try { await deliverContractReceipt(receipt.id, db()); } catch { /* The declaration remains accepted. */ }
    res.status(202).json({ ok: true, status: 'pending', receipt });
  } catch (error) {
    if (error instanceof ContractError) { res.status(error.status).json({ code: error.code }); return; }
    res.status(503).json({ code: 'declaration_unavailable' });
  }
}
export async function handleCancel(req: Request, res: Response): Promise<void> {
  await acceptAuthenticatedContract(req, res, 'cancel');
}
export async function handleWithdraw(req: Request, res: Response): Promise<void> {
  await acceptAuthenticatedContract(req, res, 'withdraw');
}
