import { deletionAccounting, type DeletionCounter } from './deletionAccounting';
import { DeletionPageComplete, DeletionStoragePageComplete, runDeletionSlice, checkDeletionSlice, recordDeletionProgress } from './deletionProgress';
import crypto from 'node:crypto';
import { distributedRateLimit } from './distributedRateLimiter';
import { getAuth } from 'firebase-admin/auth';
import { getAppBucket } from './storage';
import { deleteAccountPhotos } from '../../functions/src/retention';
import type { Request, Response } from 'express';
import type { Query } from 'firebase-admin/firestore';
import { FieldValue } from './db';
import { getDb as getFirestore } from './db';
import { evaluateAccountRisk } from './platform/riskEngine';
import { consentAuditSecret } from './consentAudit';
import { pseudonymousPartnerUid } from './partnerReferralCore';
import { quarantineOwnedPartnerReferral } from './partnerReferralDeletion';
import {
  recordModerationDecision,
  submitDsaAppeal,
  reviewDsaAppeal,
  type DsaRestrictionType,
  type DsaLegalGround,
} from './platform/dsaAppealEngine';

// ═══════════════════════════════════════════════════════════════════════════
// P0-5 und P0-6 — Meldung (DSA Art. 16) und Löschung (Art. 17 DSGVO)
//
// Beide Befunde sind dieselbe Fehlerklasse: Die Oberfläche behauptet etwas,
// das der Code nicht leistet.
//
//   P0-5  ChatView.tsx: `onClick={() => { setReportSubmitted(true); }}`
//         Der Melden-Knopf setzte einen lokalen Zustand. Kein Schreibvorgang,
//         kein Serveraufruf. Danach sah die meldende Person eine Bestätigung
//         für eine Meldung, die nirgends existierte — und meldete deshalb
//         nicht noch einmal auf einem anderen Weg.
//
//   P0-6  Profile.tsx: `deleteDoc(users/{uid})` + `deleteUser()`.
//         Chats, Nachrichten und Verbindungen blieben liegen. Eine
//         clientseitige Kaskade ist technisch gar nicht möglich — der Client
//         hat nach den Firestore-Regeln keinen Schreibzugriff auf fremde
//         Chatdokumente. Sie sieht nur so aus.
// ═══════════════════════════════════════════════════════════════════════════

const DSA_RESTRICTION_TYPES = ['content_removal', 'account_suspension', 'account_warning', 'account_termination', 'feature_restriction'] as const;
const DSA_LEGAL_GROUNDS = ['harassment', 'hate_speech', 'underage', 'fraud_scam', 'unauthorized_commercial', 'impersonation', 'terms_violation'] as const;
function isDsaRestrictionType(value: string): value is DsaRestrictionType { return (DSA_RESTRICTION_TYPES as readonly string[]).includes(value); }
function isDsaLegalGround(value: string): value is DsaLegalGround { return (DSA_LEGAL_GROUNDS as readonly string[]).includes(value); }

function uid(req: Request): string {
  const value = req.user?.uid;
  if (!value) throw new Error('Unauthorized');
  return value;
}

function text(wert: unknown, feld: string, max: number, pflicht = true): string {
  if (wert === undefined || wert === null || wert === '') {
    if (pflicht) throw new Error(`${feld} fehlt.`);
    return '';
  }
  if (typeof wert !== 'string') throw new Error(`${feld} muss ein Text sein.`);
  const t = wert.trim();
  if (pflicht && !t) throw new Error(`${feld} darf nicht leer sein.`);
  if (t.length > max) throw new Error(`${feld} überschreitet ${max} Zeichen.`);
  return t;
}

// ── P0-5: Melden ───────────────────────────────────────────────────────────

// Reports and blocks trigger Firestore writes and account-risk evaluation.
// Keep these sensitive business flows bounded per authenticated UID rather than
// relying only on the broad IP-based /api limiter. This also limits abuse when
// a client rotates source IPs.
export const trustSafetyWriteLimiter = distributedRateLimit({
  collection: 'rate_limit_trust_safety_write',
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => {
    try {
      return 'uid:' + uid(req);
    } catch {
      return '';
    }
  },
  message: { error: 'Zu viele Trust-&-Safety-Aktionen. Bitte versuche es später erneut.' },
});

const GRUENDE = new Set([
  'unangemessenes_verhalten',
  'fakeprofil_spam',
  'belaestigung',
  'minderjaehrig',
  'sonstiges',
]);

export async function handleReport(req: Request, res: Response): Promise<void> {
  const meineUid = uid(req);
  try {
    const zielUid = text(req.body?.targetUid, 'targetUid', 128);
    const grund = text(req.body?.grund, 'grund', 64);
    const beschreibung = text(req.body?.beschreibung, 'beschreibung', 2000, false);
    const chatId = text(req.body?.chatId, 'chatId', 128, false);
    const messageId = text(req.body?.messageId, 'messageId', 128, false);
    const messageText = text(req.body?.messageText, 'messageText', 4000, false);
    const messageHash = text(req.body?.messageHash, 'messageHash', 128, false);

    if (!GRUENDE.has(grund)) throw new Error('Unbekannter Meldegrund.');
    if (zielUid === meineUid) throw new Error('Eine Meldung über das eigene Konto ist nicht vorgesehen.');

    const db = getFirestore();

    let reportedMessageSnapshot: {
      messageId: string;
      text: string;
      contentHash: string | null;
      verified: boolean;
      senderId?: string;
    } | null = null;

    if (messageId && chatId) {
      try {
        const msgDoc = await db.collection('chats').doc(chatId).collection('messages').doc(messageId).get();
        if (msgDoc.exists) {
          const msgData = msgDoc.data();
          reportedMessageSnapshot = {
            messageId,
            text: typeof msgData?.text === 'string' ? msgData.text : messageText,
            contentHash: typeof msgData?.contentHash === 'string' ? msgData.contentHash : (messageHash || null),
            verified: true,
            senderId: msgData?.senderId || zielUid,
          };
        } else if (messageText) {
          reportedMessageSnapshot = {
            messageId,
            text: messageText,
            contentHash: messageHash || null,
            verified: false,
            senderId: zielUid,
          };
        }
      } catch (msgErr) {
        console.warn('Failed to retrieve message for report snapshot:', msgErr);
        if (messageText) {
          reportedMessageSnapshot = {
            messageId,
            text: messageText,
            contentHash: messageHash || null,
            verified: false,
            senderId: zielUid,
          };
        }
      }
    }

    // Erst speichern, DANN bestätigen. Die Reihenfolge ist der ganze Punkt.
    const ref = await db.collection('reports').add({
      reporterId: meineUid,
      reportedProfileId: zielUid,
      reason: grund,
      beschreibung: beschreibung || null,
      chatId: chatId || null,
      reportedMessage: reportedMessageSnapshot,
      isMessageReport: Boolean(reportedMessageSnapshot),
      timestamp: FieldValue.serverTimestamp(),
      status: 'open',
      // DSA Art. 16 Abs. 6: Die Entscheidung ist zu begründen. Das Feld ist
      // der Ort, an dem die Begründung entsteht — nicht ein Freitext in
      // einer Mail, den niemand wiederfindet.
      entscheidung: null,
      begruendung: null,
    });

    // Aktenzeichen: kurz genug zum Vorlesen, lang genug zum Wiederfinden.
    // Eine Eingangsbestätigung ohne Bezug ist für die meldende Person
    // wertlos (DSA Art. 16 Abs. 4).
    const aktenzeichen = ref.id.slice(0, 8).toUpperCase();
    await ref.set({ aktenzeichen }, { merge: true });

    // Risikoprofil des gemeldeten Nutzers automatisch aktualisieren
    try {
      const risk = await evaluateAccountRisk(db, zielUid);
      const isMinorAlert = grund === 'minderjaehrig';
      if (isMinorAlert || risk.level === 'high') {
        await ref.set({
          priority: 'urgent',
          riskScore: risk.score,
          isMinorAlert,
        }, { merge: true });
        if (isMinorAlert) {
          await db.collection('users').doc(zielUid).set({
            requiresSafetyReview: true,
            urgentMinorReview: true,
            riskLevel: 'high',
          }, { merge: true });
        }
      }
    } catch (riskErr) {
      console.warn('Risk evaluation after report failed:', riskErr);
    }

    res.json({
      ok: true,
      aktenzeichen,
      isMessageReport: Boolean(reportedMessageSnapshot),
      hinweis: 'Die Meldung ist eingegangen und wird geprüft. Du erhältst eine begründete Entscheidung.',
    });
  } catch (e) {
    const nachricht = e instanceof Error ? e.message : 'Unbekannter Fehler';
    console.error('/api/report', nachricht);
    res.status(400).json({ error: nachricht });
  }
}

async function checkModeratorRole(req: Request): Promise<boolean> {
  const userUid = uid(req);
  if (!userUid) return false;
  try {
    const tokenClaims: Record<string, unknown> = req.user ? req.user as unknown as Record<string, unknown> : {};
    if (
      tokenClaims.moderator === true ||
      tokenClaims.admin === true ||
      tokenClaims.super_admin === true ||
      tokenClaims.role === 'moderator' ||
      tokenClaims.role === 'trust_safety' ||
      (Array.isArray(tokenClaims.roles) && (tokenClaims.roles.includes('moderator') || tokenClaims.roles.includes('trust_safety') || tokenClaims.roles.includes('admin') || tokenClaims.roles.includes('super_admin')))
    ) {
      return true;
    }
    const konto = await getAuth().getUser(userUid);
    const claims: Record<string, unknown> = konto.customClaims && typeof konto.customClaims === 'object'
      ? konto.customClaims as Record<string, unknown>
      : {};
    const role = typeof claims.role === 'string' ? claims.role : '';
    const roles = Array.isArray(claims.roles) ? (claims.roles as unknown[]).filter((val: unknown): val is string => typeof val === 'string') : [];
    return (
      claims.moderator === true ||
      claims.admin === true ||
      claims.super_admin === true ||
      role === 'moderator' ||
      role === 'trust_safety' ||
      roles.includes('moderator') ||
      roles.includes('trust_safety') ||
      roles.includes('admin') ||
      roles.includes('super_admin')
    );
  } catch {
    return false;
  }
}

/** DSA Art. 16 Abs. 6 & Art. 17: Begründete Moderationsentscheidung mit Rechtsbehelfsbelehrung */
export async function handleReportDecision(req: Request, res: Response): Promise<void> {
  const moderatorUid = uid(req);
  const isAuthorized = await checkModeratorRole(req);
  if (!isAuthorized) {
    res.status(401).json({ error: 'Nicht berechtigt.' });
    return;
  }

  try {
    const reportId = text(req.body?.reportId, 'reportId', 128);
    const restrictionTypeRaw = text(req.body?.restrictionType, 'restrictionType', 64);
    const legalGroundRaw = text(req.body?.legalGround, 'legalGround', 64);
    if (!isDsaRestrictionType(restrictionTypeRaw)) throw new Error('Ungültiger Einschränkungstyp.');
    if (!isDsaLegalGround(legalGroundRaw)) throw new Error('Ungültiger Rechtsgrund.');
    const restrictionType = restrictionTypeRaw;
    const legalGround = legalGroundRaw;
    const factsAndCircumstances = text(req.body?.factsAndCircumstances, 'factsAndCircumstances', 2000);

    const statement = await recordModerationDecision(
      getFirestore(),
      reportId,
      moderatorUid,
      { restrictionType, legalGround, factsAndCircumstances }
    );

    res.json({ ok: true, statement });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Fehler bei der Moderationsentscheidung.' });
  }
}

/** DSA Art. 20: Internes Beschwerdeverfahren */
export async function handleReportAppeal(req: Request, res: Response): Promise<void> {
  const appellantUid = uid(req);
  try {
    const reportId = text(req.body?.reportId, 'reportId', 128);
    const appealReason = text(req.body?.appealReason, 'appealReason', 2000);
    const additionalEvidence = req.body?.additionalEvidence ? text(req.body?.additionalEvidence, 'additionalEvidence', 2000, false) : undefined;

    const appeal = await submitDsaAppeal(
      getFirestore(),
      reportId,
      appellantUid,
      appealReason,
      additionalEvidence
    );

    res.json({ ok: true, appeal });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Fehler beim Einreichen der Beschwerde.' });
  }
}

/** DSA Art. 20: Überprüfung einer internen Beschwerde durch qualifiziertes Personal */
export async function handleAppealReview(req: Request, res: Response): Promise<void> {
  const reviewerUid = uid(req);
  const isAuthorized = await checkModeratorRole(req);
  if (!isAuthorized) {
    res.status(401).json({ error: 'Nicht berechtigt.' });
    return;
  }

  try {
    const reportId = text(req.body?.reportId, 'reportId', 128);
    const outcomeRaw = text(req.body?.outcome, 'outcome', 32);
    if (outcomeRaw !== 'upheld' && outcomeRaw !== 'overturned') throw new Error('Ungültiges Beschwerdeergebnis.');
    const outcome = outcomeRaw;
    const rationale = text(req.body?.rationale, 'rationale', 2000);

    const updatedAppeal = await reviewDsaAppeal(
      getFirestore(),
      reportId,
      reviewerUid,
      outcome,
      rationale
    );

    res.json({ ok: true, appeal: updatedAppeal });
  } catch (e: unknown) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Fehler bei der Beschwerdeprüfung.' });
  }
}

/** Blockieren. Gerichteter Eintrag, beidseitige Wirkung über die Regel
 *  `blocked()`. Ohne Ankündigung an die blockierte Person — eine Anzeige
 *  wäre ein Informationsleck. */
export async function handleBlock(req: Request, res: Response): Promise<void> {
  const meineUid = uid(req);
  try {
    const zielUid = text(req.body?.targetUid, 'targetUid', 128);
    if (zielUid === meineUid) throw new Error('Das eigene Konto lässt sich nicht blockieren.');
    const db = getFirestore();
    await db.collection('blocks').doc(`${meineUid}_${zielUid}`).set(
      { blockerUid: meineUid, blockedUid: zielUid, at: FieldValue.serverTimestamp() },
      { merge: true },
    );

    // Risikoprofil des blockierten Nutzers asynchron evaluieren
    try {
      await evaluateAccountRisk(db, zielUid);
    } catch (riskErr) {
      console.warn('Risk evaluation after block failed:', riskErr);
    }

    res.json({ ok: true });
  } catch (e) {
    const nachricht = e instanceof Error ? e.message : 'Unbekannter Fehler';
    console.error('/api/block', nachricht);
    res.status(400).json({ error: nachricht });
  }
}

// ── P0-6: Löschung ─────────────────────────────────────────────────────────

const BATCH = 400;

async function loescheAbfrage(query: Query): Promise<number> {
  const db = getFirestore();
  let gesamt = 0;
  for (;;) {
    checkDeletionSlice();
    const snap = await query.limit(BATCH).get();
    if (snap.empty) return gesamt;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    recordDeletionProgress();
    gesamt += snap.size;
    if (snap.size < BATCH) return gesamt;
  }
}

/** Repeatable purge: orchestration, provider cleanup and authentication live in accountDeletion.ts. */
export async function purgeAccountData(
  meineUid: string,
  deletionRequestId: string,
  lease?: string,
  /** Optional internal-only clock/progress instrumentation for deterministic emulator tests. */
  sliceTestClock?: { now: () => number; onProgress?: () => void },
) {
  return runDeletionSlice(async () => {
    const db = getFirestore();
    const accounting = deletionAccounting(db, meineUid, deletionRequestId, lease);
    await accounting.verify();
    const loescheGezaehlt = async (query: Query, counter: DeletionCounter) => {
      let total = 0;
      for (;;) {
        checkDeletionSlice();
        const count = await accounting.deleteQuery(query, counter);
        if (count > 0) recordDeletionProgress();
        total += count;
        if (count < BATCH) return total;
      }
    };
    const bericht = {
      chats: 0, nachrichten: 0, gateAntworten: 0, verbindungen: 0, kontakte: 0,
      eigeneMeldungen: 0, pseudonymisiert: 0,
    };

    // 1. Chats samt Nachrichten. Ein Chat gehört beiden; ein halber Chat ist
    //    für niemanden nützlich.
    //
    //    GEGENPRÜFUNG 14.08.2026: `gate_answers` fehlte. Firestore löscht mit
    //    einem Dokument KEINE Unterkollektionen — `chats/{id}/gate_answers`
    //    wäre nach dem Löschen des Chats verwaist liegengeblieben. Darin
    //    steht bis zu 1000 Zeichen selbst verfasster Freitext je Antwort,
    //    und die Auskunft nach Art. 15 gibt ihn aus. Was auskunftspflichtig
    //    ist, muss auch löschbar sein.
    const chats = await db.collection('chats').where('participants', 'array-contains', meineUid).limit(25).get();
    for (const chat of chats.docs) {
      checkDeletionSlice();
      const chatRef = db.doc(chat.ref.path);
      bericht.nachrichten += await loescheGezaehlt(chatRef.collection('messages'), 'nachrichten');
      bericht.nachrichten += await loescheGezaehlt(chatRef.collection('archived_messages'), 'nachrichten');
      bericht.gateAntworten += await loescheGezaehlt(chatRef.collection('gate_answers'), 'gateAntworten');
      const count = await accounting.deleteChat(chatRef);
      if (count > 0) recordDeletionProgress();
      bericht.chats += count;
    }

    if (chats.size === 25) throw new DeletionPageComplete();

    // 2. Verbindungen in beide Richtungen.
    for (const feld of ['fromUid', 'toUid', 'userId', 'otherUserId']) {
      bericht.verbindungen += await loescheGezaehlt(
        db.collection('connections').where(feld, '==', meineUid), 'verbindungen',
      );
    }

    // 2a. Kontaktanfragen in beide Richtungen.
    //     GEGENPRÜFUNG 14.08.2026: `contacts` fehlte ebenfalls. Die
    //     Dokumentkennung ist `${von}_${nach}`, die Felder heissen `fromUid`
    //     und `toUid` — die Auskunft liest genau diese beiden.
    for (const feld of ['fromUid', 'toUid']) {
      bericht.kontakte += await loescheGezaehlt(
        db.collection('contacts').where(feld, '==', meineUid), 'kontakte',
      );
    }

    // 3. Kontingent-Ledger.
    await loescheAbfrage(db.collection('users').doc(meineUid).collection('quota_ledger'));

    // 3a. GEGENPRÜFUNG 09.08.2026: Die mit DSG-02 hinzugekommenen Ablagen
    //     fehlten in der Kaskade. `doc.delete()` löscht in Firestore KEINE
    //     Unterkollektionen — `users/{uid}/einwilligungen/*` wäre nach der
    //     Kontolöschung verwaist liegengeblieben, mit Zeitstempeln und
    //     Zwecken. `age_attempts` enthält die uid im Klartext.
    //     Eine neue Sammlung, die nicht in dieser Liste steht, überlebt die
    //     Löschung — deshalb gehört jede hier eingetragen.
    await loescheAbfrage(db.collection('users').doc(meineUid).collection('einwilligungen'));
    await loescheAbfrage(db.collection('users').doc(meineUid).collection('legal_acknowledgements'));
    // 11.08.2026: Zwischenspeicher fuer KI-Auswertungen. Er haelt Aussagen
    // ueber diese Person hoechstens 36 Stunden — ohne diesen Eintrag aber
    // ueber die Kontoloeschung hinaus.
    await loescheAbfrage(db.collection('users').doc(meineUid).collection('ki_zwischenspeicher'));
    await loescheAbfrage(db.collection('age_attempts').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('age_verification_attempts').where('userId', '==', meineUid));

    // 4. Blockierungen in beide Richtungen.
    await loescheAbfrage(db.collection('blocks').where('blockerUid', '==', meineUid));
    await loescheAbfrage(db.collection('blocks').where('blockedUid', '==', meineUid));

    // 5. Eigene Meldungen: weg.
    bericht.eigeneMeldungen += await loescheGezaehlt(
      db.collection('reports').where('reporterId', '==', meineUid), 'eigeneMeldungen',
    );

    // 6. Meldungen ÜBER diese Person bleiben — sie sind die Daten der
    //    meldenden Personen und der Nachweis für Moderationsentscheidungen
    //    (DSA Art. 17). Der Personenbezug wird entfernt.
    for (;;) {
      checkDeletionSlice();
      const count = await accounting.pseudonymizeReports(db.collection('reports').where('reportedProfileId', '==', meineUid));
      if (count === 0) break;
      recordDeletionProgress();
      bericht.pseudonymisiert += count;
    }

    // Abuse-prevention state is UID-derived and must not survive Art. 17 deletion.
    const deletionRateLimitId = crypto.createHash('sha256').update(`klar-account-delete:${meineUid}`).digest('hex');
    await db.collection('account_deletion_rate_limits').doc(deletionRateLimitId).delete();

    // 6a. Weitere Sammlungen (DSGVO)
    await db.collection('public_profiles').doc(meineUid).delete();
    await loescheAbfrage(db.collection('analytics_events').where('userId', '==', meineUid));
    await loescheAbfrage(db.collection('funnel_events').where('userId', '==', meineUid));
    await loescheAbfrage(db.collection('activation_events').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('app_feedback').where('uid', '==', meineUid));
    // P0 #48: a future member-code reservation stores ownerUid and must not
    // outlive the Art. 17 cascade. The deletion tombstone forbids re-issuance.
    // The collection is not active until migration and policy approval.
    await loescheAbfrage(db.collection('member_referral_code_registry').where('ownerUid', '==', meineUid));
    for (const field of ['inviterUid', 'inviteeUid']) await loescheAbfrage(db.collection('referral_events').where(field, '==', meineUid));
    for (const field of ['userA', 'userB']) await loescheAbfrage(db.collection('matches').where(field, '==', meineUid));
    checkDeletionSlice();
    if (!await deleteAccountPhotos(getAppBucket(), meineUid)) throw new DeletionStoragePageComplete();
    await loescheAbfrage(db.collection('mail_queue').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('verification_requests').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('verification_events').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('audit_logs').where('userId', '==', meineUid));
    await loescheAbfrage(db.collection('activation_events').where('actorUid', '==', meineUid));
    await loescheAbfrage(db.collection('referral_events').where('inviterUid', '==', meineUid));
    await loescheAbfrage(db.collection('referral_events').where('inviteeUid', '==', meineUid));
    await loescheAbfrage(db.collection('app_feedback').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('admob_rewards').where('userId', '==', meineUid));
    // Klar & Partner Art. 17: remove account-bound referrals, verified claims and
    // signed ledger entries using keyed pseudonyms. Contract metadata/aggregates remain.
    const partnerUidRef = pseudonymousPartnerUid(meineUid, consentAuditSecret());
    // Owner deletion must also remove claims made by *other* buyers against
    // the owner's referrals. These claim documents lack ownerRef and therefore
    // cannot be found using the owner's pseudonym alone. Delete children first:
    // interrupted deletion slices then safely resume from surviving referral docs.
    for (;;) {
      checkDeletionSlice();
      const ownedReferrals = await db.collection('partner_referrals')
        .where('ownerUid', '==', meineUid).limit(BATCH).get();
      if (ownedReferrals.empty) break;
      for (const referral of ownedReferrals.docs) {
        checkDeletionSlice();
        // Quarantine first: conversion transactions must not create new claims
        // after our deletion sweep has begun. Resumed slices keep this tombstone.
        const quarantine = await quarantineOwnedPartnerReferral(db, referral.ref, meineUid);
        if (quarantine === 'missing') continue;
        if (quarantine === 'updated') recordDeletionProgress();
        checkDeletionSlice();
        await loescheAbfrage(db.collection('partner_referral_buyer_claims')
          .where('referralId', '==', referral.id));
        // The claim purge may span many batches. Stop before parent removal if the lease expired.
        checkDeletionSlice();
        // Do not remove the parent pointer until dependent buyer claims are gone.
        await referral.ref.delete();
        recordDeletionProgress();
      }
      if (ownedReferrals.size < BATCH) break;
    }
    for (const field of ['ownerRef', 'buyerRef']) {
      await loescheAbfrage(db.collection('partner_referral_conversions').where(field, '==', partnerUidRef));
    }
    await loescheAbfrage(db.collection('partner_referral_buyer_claims').where('buyerRef', '==', partnerUidRef));
    for (const field of ['actorRef', 'ownerRef', 'buyerRef']) {
      await loescheAbfrage(db.collection('partner_referral_ledger').where(field, '==', partnerUidRef));
    }
    for (const collectionName of ['partner_referral_user_rate_limits', 'partner_referral_admin_rate_limits']) {
      const key = crypto.createHash('sha256')
        .update('klar-rate-limit:' + collectionName + ':uid:' + meineUid, 'utf8')
        .digest('hex');
      await db.collection(collectionName).doc(key).delete();
    }
    // Keep campaign text and aggregate counts, but scrub all HMAC admin references.
    for (const field of ['createdByRef', 'updatedByRef', 'verifiedByRef']) {
      for (;;) {
        checkDeletionSlice();
        const refs = await db.collection('partner_campaigns').where(field, '==', partnerUidRef).limit(BATCH).get();
        if (refs.empty) break;
        const batch = db.batch();
        refs.docs.forEach(item => batch.update(item.ref, { [field]: FieldValue.delete() }));
        await batch.commit();
        recordDeletionProgress();
        if (refs.size < BATCH) break;
      }
    }
    // Consent audit entries are append-only and pseudonymous at creation time.
    // No in-place mutation is permitted here; legacy pre-hardening entries that
    // still contain userId are handled by the documented Art. 17 migration job.
    await loescheAbfrage(db.collection('notifications').where('userId', '==', meineUid));

    // 7. Profil.

    await db.collection('users').doc(meineUid).delete();
    // Reservations read the parent in their transaction. Delete the parent first
    // so concurrent AI calls cannot recreate this subcollection after cleanup.
    await loescheAbfrage(db.collection('users').doc(meineUid).collection('ai_budget'));

    await loescheAbfrage(db.collection('kyc_events').where('uid', '==', meineUid));
    await loescheAbfrage(db.collection('kyc_sessions').where('uid', '==', meineUid));
    // Reconciliation audit records contain the account UID and must not survive
    // account deletion. The v79 scheduler introduced this collection after the
    // original KYC deletion paths were established.
    await loescheAbfrage(db.collection('kyc_reconciliation_events').where('uid', '==', meineUid));
    await db.collection('kyc_accounts').doc(meineUid).delete();
    // All nested profile data, including future subcollections, is owned by this account.
    await db.recursiveDelete(db.collection('users').doc(meineUid));

    // Cumulative counters stay in the durable job. Only the worker's final
    // sweep transaction may publish the final receipt and complete the job.
    return bericht;
  }, sliceTestClock?.now, sliceTestClock?.onProgress);
}

export async function handleDeleteAccount(req: Request, res: Response): Promise<void> {
  const actor = (req as Request & { user?: { uid: string; auth_time?: number } }).user;
  if (!actor || !actor.auth_time || Date.now() / 1000 - actor.auth_time > 300) {
    res.status(401).json({ code: 'recent_login_required', error: 'Bitte vor der Kontolöschung erneut anmelden.' }); return;
  }
  try {
    const { requestAccountDeletion } = await import('./accountDeletion');
    const result = await requestAccountDeletion(actor.uid);
    res.status(202).json({ ok: true, status: 'pending', requestId: result.requestId });
  } catch {
    res.status(503).json({ error: 'Löschauftrag derzeit nicht bestätigbar. Bitte erneut versuchen.' });
  }
}

