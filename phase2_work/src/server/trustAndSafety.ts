import { logSafeFailure } from './safeErrorLog';
import { deletionAccounting, type DeletionCounter, type TenantSelection } from './deletionAccounting';
import { DeletionPageComplete, DeletionStoragePageComplete, runDeletionSlice, checkDeletionSlice, recordDeletionProgress } from './deletionProgress';
import crypto from 'node:crypto';
import { distributedRateLimit } from './distributedRateLimiter';
import { getAuth } from 'firebase-admin/auth';
import { getAppBucket } from './storage';
import { verificationPurgeAuthorization } from './verificationPurgeAuthorization';
import { accountRateLimitPaths } from './sharedRateLimit';
import { deleteAccountPhotos } from '../../functions/src/retention';
import type { Request, Response } from 'express';
import { z } from 'zod';
const record = z.record(z.string(), z.unknown());
const select = (path: string, field?: string, value?: unknown): TenantSelection => ({path, ...(field ? {where:[field,'==',value] as const} : {})});
import { FieldValue } from './db';
import { getServiceRepository } from './firestoreRepository/nativeDatabase';
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

    const db = getServiceRepository('auth');

    let reportedMessageSnapshot: {
      messageId: string;
      text: string;
      contentHash: string | null;
      verified: boolean;
      senderId?: string;
    } | null = null;

    if (messageId && chatId) {
      try {
        const chat = await db.read(`chats/${chatId}`, record);
        if (!Array.isArray(chat?.participants) || !chat.participants.includes(meineUid)) throw new Error('report_chat_forbidden');
        const msgDoc = await db.read(`chats/${chatId}/messages/${messageId}`, record);
        if (msgDoc) {
          const msgData = msgDoc;
          reportedMessageSnapshot = {
            messageId,
            text: typeof msgData?.text === 'string' ? msgData.text : messageText,
            contentHash: typeof msgData?.contentHash === 'string' ? msgData.contentHash : (messageHash || null),
            verified: true,
            senderId: typeof msgData?.senderId === 'string' ? msgData.senderId : zielUid,
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
        logSafeFailure('unclassified_failure');
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
    const reportId = crypto.randomUUID(), ref = `reports/${reportId}`;
    await db.create(ref, record, {
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
    const aktenzeichen = reportId.slice(0, 8).toUpperCase();
    await db.write(ref, record, { aktenzeichen }, { merge: true });

    // Risikoprofil des gemeldeten Nutzers automatisch aktualisieren
    try {
      const risk = await evaluateAccountRisk(db, zielUid);
      const isMinorAlert = grund === 'minderjaehrig';
      if (isMinorAlert || risk.level === 'high') {
        await db.write(ref, record, {
          priority: 'urgent',
          riskScore: risk.score,
          isMinorAlert,
        }, { merge: true });
        if (isMinorAlert) {
          await db.write(`users/${zielUid}`, record, {
            requiresSafetyReview: true,
            urgentMinorReview: true,
            riskLevel: 'high',
          }, { merge: true });
        }
      }
    } catch (riskErr) {
      logSafeFailure('unclassified_failure');
    }

    res.json({
      ok: true,
      aktenzeichen,
      isMessageReport: Boolean(reportedMessageSnapshot),
      hinweis: 'Die Meldung ist eingegangen und wird geprüft. Du erhältst eine begründete Entscheidung.',
    });
  } catch (e) {
    const nachricht = e instanceof Error ? e.message : 'Unbekannter Fehler';
    logSafeFailure('unclassified_failure');
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
      getServiceRepository('auth'),
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
      getServiceRepository('auth'),
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
      getServiceRepository('auth'),
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
    const db = getServiceRepository('auth');
    await db.write(`blocks/${meineUid}_${zielUid}`, record,
      { blockerUid: meineUid, blockedUid: zielUid, at: FieldValue.serverTimestamp() },
      { merge: true },
    );

    // Risikoprofil des blockierten Nutzers asynchron evaluieren
    try {
      await evaluateAccountRisk(db, zielUid);
    } catch (riskErr) {
      logSafeFailure('unclassified_failure');
    }

    res.json({ ok: true });
  } catch (e) {
    const nachricht = e instanceof Error ? e.message : 'Unbekannter Fehler';
    logSafeFailure('unclassified_failure');
    res.status(400).json({ error: nachricht });
  }
}

// ── P0-6: Löschung ─────────────────────────────────────────────────────────

const BATCH = 200;

/** Repeatable purge: orchestration, provider cleanup and authentication live in accountDeletion.ts. */
export async function purgeAccountData(meineUid: string, deletionRequestId: string, lease?: string) {
  return runDeletionSlice(async () => {
    const db = getServiceRepository('auth');
    const accounting = deletionAccounting(db, meineUid, deletionRequestId, lease);
    await accounting.verify();
    const loescheGezaehlt = async (query: TenantSelection, counter?: DeletionCounter) => {
      let total = 0;
      for (;;) {
        checkDeletionSlice();
        const count = await accounting.deleteQuery(query, counter);
        if (count > 0) recordDeletionProgress();
        total += count;
        if (count < BATCH) return total;
      }
    };
    const loescheAbfrage = (query: TenantSelection) => loescheGezaehlt(query);
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
    const chats = await db.list('chats', record, {where:['participants','array-contains',meineUid], limit:25});
    for (const chat of chats) {
      checkDeletionSlice();
      const chatRef = `chats/${chat.id}`;
      bericht.nachrichten += await loescheGezaehlt(select(`${chatRef}/messages`), 'nachrichten');
      bericht.nachrichten += await loescheGezaehlt(select(`${chatRef}/archived_messages`), 'nachrichten');
      bericht.gateAntworten += await loescheGezaehlt(select(`${chatRef}/gate_answers`), 'gateAntworten');
      const count = await accounting.deleteChat(chatRef);
      if (count > 0) recordDeletionProgress();
      bericht.chats += count;
    }

    if (chats.length === 25) throw new DeletionPageComplete();

    // 2. Verbindungen in beide Richtungen.
    for (const feld of ['fromUid', 'toUid', 'userId', 'otherUserId']) {
      bericht.verbindungen += await loescheGezaehlt(
        select('connections', feld, meineUid), 'verbindungen',
      );
    }

    // 2a. Kontaktanfragen in beide Richtungen.
    //     GEGENPRÜFUNG 14.08.2026: `contacts` fehlte ebenfalls. Die
    //     Dokumentkennung ist `${von}_${nach}`, die Felder heissen `fromUid`
    //     und `toUid` — die Auskunft liest genau diese beiden.
    for (const feld of ['fromUid', 'toUid']) {
      bericht.kontakte += await loescheGezaehlt(
        select('contacts', feld, meineUid), 'kontakte',
      );
    }

    // 3. Kontingent-Ledger.
    await loescheAbfrage(select(`users/${meineUid}/quota_ledger`));

    // 3a. GEGENPRÜFUNG 09.08.2026: Die mit DSG-02 hinzugekommenen Ablagen
    //     fehlten in der Kaskade. `doc.delete()` löscht in Firestore KEINE
    //     Unterkollektionen — `users/{uid}/einwilligungen/*` wäre nach der
    //     Kontolöschung verwaist liegengeblieben, mit Zeitstempeln und
    //     Zwecken. `age_attempts` enthält die uid im Klartext.
    //     Eine neue Sammlung, die nicht in dieser Liste steht, überlebt die
    //     Löschung — deshalb gehört jede hier eingetragen.
    await loescheAbfrage(select(`users/${meineUid}/einwilligungen`));
    await loescheAbfrage(select(`users/${meineUid}/legal_acknowledgements`));
    // 11.08.2026: Zwischenspeicher fuer KI-Auswertungen. Er haelt Aussagen
    // ueber diese Person hoechstens 36 Stunden — ohne diesen Eintrag aber
    // ueber die Kontoloeschung hinaus.
    await loescheAbfrage(select(`users/${meineUid}/ki_zwischenspeicher`));
    await loescheAbfrage(select('age_attempts', 'uid', meineUid));
    await loescheAbfrage(select('age_verification_attempts', 'userId', meineUid));

    // 4. Blockierungen in beide Richtungen.
    await loescheAbfrage(select('blocks', 'blockerUid', meineUid));
    await loescheAbfrage(select('blocks', 'blockedUid', meineUid));

    // 5. Eigene Meldungen: weg.
    bericht.eigeneMeldungen += await loescheGezaehlt(
      select('reports', 'reporterId', meineUid), 'eigeneMeldungen',
    );

    // 6. Meldungen ÜBER diese Person bleiben — sie sind die Daten der
    //    meldenden Personen und der Nachweis für Moderationsentscheidungen
    //    (DSA Art. 17). Der Personenbezug wird entfernt.
    for (;;) {
      checkDeletionSlice();
      const count = await accounting.pseudonymizeReports(select('reports', 'reportedProfileId', meineUid));
      if (count === 0) break;
      recordDeletionProgress();
      bericht.pseudonymisiert += count;
    }

    // Abuse-prevention state is UID-derived and must not survive Art. 17 deletion.
    const deletionRateLimitId = crypto.createHash('sha256').update(`klar-account-delete:${meineUid}`).digest('hex');
    await accounting.deleteDocument(`account_deletion_rate_limits/${deletionRateLimitId}`);

    // 6a. Weitere Sammlungen (DSGVO)
    await accounting.deleteDocument(`public_profiles/${meineUid}`);
    await loescheAbfrage(select('analytics_events', 'userId', meineUid));
    await loescheAbfrage(select('funnel_events', 'userId', meineUid));
    await loescheAbfrage(select('activation_events', 'uid', meineUid));
    await loescheAbfrage(select('app_feedback', 'uid', meineUid));
    for (const field of ['inviterUid', 'inviteeUid']) await loescheAbfrage(select('referral_events', field, meineUid));
    for (const field of ['userA', 'userB']) await loescheAbfrage(select('matches', field, meineUid));
    checkDeletionSlice();
    const photoBucket = getAppBucket();
    if (!await deleteAccountPhotos(photoBucket, meineUid, verificationPurgeAuthorization(db, meineUid, deletionRequestId, lease, photoBucket.name))) throw new DeletionStoragePageComplete();
    await loescheAbfrage(select('mail_queue', 'uid', meineUid));
    await loescheAbfrage(select('verification_requests', 'uid', meineUid));
    await loescheAbfrage(select('verification_events', 'uid', meineUid));
    await accounting.deleteDocument(`account_photo_purge_plans/${meineUid}`);
    await accounting.deleteDocument(`account_security_jobs/${meineUid}`);
    await accounting.deleteDocument(`account_locks/${meineUid}`);
    await accounting.deleteDocuments(accountRateLimitPaths(meineUid));
    await loescheAbfrage(select('audit_logs', 'userId', meineUid));
    await loescheAbfrage(select('activation_events', 'actorUid', meineUid));
    await loescheAbfrage(select('referral_events', 'inviterUid', meineUid));
    await loescheAbfrage(select('referral_events', 'inviteeUid', meineUid));
    await loescheAbfrage(select('app_feedback', 'uid', meineUid));
    await loescheAbfrage(select('admob_rewards', 'userId', meineUid));
    // Klar & Partner Art. 17: remove account-bound referrals, verified claims and
    // signed ledger entries using keyed pseudonyms. Contract metadata/aggregates remain.
    const partnerUidRef = pseudonymousPartnerUid(meineUid, consentAuditSecret());
    // Owner deletion must also remove claims made by *other* buyers against
    // the owner's referrals. These claim documents lack ownerRef and therefore
    // cannot be found using the owner's pseudonym alone. Delete children first:
    // interrupted deletion slices then safely resume from surviving referral docs.
    for (;;) {
      checkDeletionSlice();
      const ownedReferrals = await db.list('partner_referrals', record, {where:['ownerUid','==',meineUid], limit:BATCH});
      if (!ownedReferrals.length) break;
      for (const referral of ownedReferrals) {
        checkDeletionSlice();
        // Quarantine first: conversion transactions must not create new claims
        // after our deletion sweep has begun. Resumed slices keep this tombstone.
        const quarantine = await quarantineOwnedPartnerReferral(db, `partner_referrals/${referral.id}`, meineUid);
        if (quarantine === 'missing') continue;
        if (quarantine === 'updated') recordDeletionProgress();
        checkDeletionSlice();
        await loescheAbfrage(select('partner_referral_buyer_claims', 'referralId', referral.id));
        // The claim purge may span many batches. Stop before parent removal if the lease expired.
        checkDeletionSlice();
        // Do not remove the parent pointer until dependent buyer claims are gone.
        await accounting.deleteDocument(`partner_referrals/${referral.id}`);
        recordDeletionProgress();
      }
      if (ownedReferrals.length < BATCH) break;
    }
    for (const field of ['ownerRef', 'buyerRef']) {
      await loescheAbfrage(select('partner_referral_conversions', field, partnerUidRef));
    }
    await loescheAbfrage(select('partner_referral_buyer_claims', 'buyerRef', partnerUidRef));
    for (const field of ['actorRef', 'ownerRef', 'buyerRef']) {
      await loescheAbfrage(select('partner_referral_ledger', field, partnerUidRef));
    }
    for (const collectionName of ['partner_referral_user_rate_limits', 'partner_referral_admin_rate_limits']) {
      const key = crypto.createHash('sha256')
        .update('klar-rate-limit:' + collectionName + ':uid:' + meineUid, 'utf8')
        .digest('hex');
      await accounting.deleteDocument(`${collectionName}/${key}`);
    }
    // Keep campaign text and aggregate counts, but scrub all HMAC admin references.
    for (const field of ['createdByRef', 'updatedByRef', 'verifiedByRef']) {
      for (;;) {
        checkDeletionSlice();
        const count = await accounting.scrubQuery(select('partner_campaigns', field, partnerUidRef), field);
        if (!count) break;
        recordDeletionProgress();
        if (count < BATCH) break;
      }
    }
    // Consent audit entries are append-only and pseudonymous at creation time.
    // No in-place mutation is permitted here; legacy pre-hardening entries that
    // still contain userId are handled by the documented Art. 17 migration job.
    await loescheAbfrage(select('notifications', 'userId', meineUid));

    // 7. Profil.

    await accounting.deleteDocument(`users/${meineUid}`);
    // Reservations read the parent in their transaction. Delete the parent first
    // so concurrent AI calls cannot recreate this subcollection after cleanup.
    await loescheAbfrage(select(`users/${meineUid}/ai_budget`));

    await loescheAbfrage(select('kyc_events', 'uid', meineUid));
    await loescheAbfrage(select('kyc_sessions', 'uid', meineUid));
    // Reconciliation audit records contain the account UID and must not survive
    // account deletion. The v79 scheduler introduced this collection after the
    // original KYC deletion paths were established.
    await loescheAbfrage(select('kyc_reconciliation_events', 'uid', meineUid));
    await accounting.deleteDocument(`kyc_accounts/${meineUid}`);
    // All nested profile data, including future subcollections, is owned by this account.
    await accounting.verify();
    await db.deleteTree(`users/${meineUid}`);

    // Cumulative counters stay in the durable job. Only the worker's final
    // sweep transaction may publish the final receipt and complete the job.
    return bericht;
  });
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

