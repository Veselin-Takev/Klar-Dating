import crypto from 'node:crypto';
import type { Firestore, DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue } from './db';
import { consentAuditSecret, signHmacAuditPayload } from './consentAudit';
import {
  PartnerReferralError,
  isAutomatedPartnerClick,
  parsePartnerCampaignInput,
  validatePartnerDestinationUrl,
  derivePartnerReferralToken,
  partnerReferralDocumentId,
  partnerWebhookEventDocumentId,
  partnerBuyerClaimDocumentId,
  pseudonymousPartnerUid,
  type PartnerCampaignInput,
  type PartnerCampaignPatch,
  type PartnerConversionPayload,
} from './partnerReferralCore';

const CAMPAIGNS = 'partner_campaigns';
const SLUGS = 'partner_campaign_slugs';
const REFERRALS = 'partner_referrals';
const LEDGER = 'partner_referral_ledger';
const CONVERSIONS = 'partner_referral_conversions';
const BUYER_CLAIMS = 'partner_referral_buyer_claims';

export type PartnerReferralServiceDeps = {
  getFirestore: () => Firestore;
  tokenSecret: () => string;
  auditSecret?: () => string;
  publicUrl: () => string | undefined;
  now?: () => Date;
};

export type PartnerCampaignRecord = {
  id: string;
  name: string;
  slug: string;
  destinationUrl: string;
  rewardLabel: string;
  termsSummary: string;
  brandVerified: boolean;
  status: 'draft' | 'active' | 'inactive' | 'deleted';
  clickCount: number;
  qualifiedConversions: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  createdByRef: string | null;
  updatedByRef: string | null;
  verifiedByRef: string | null;
  version: number;
};

function nowIso(deps: PartnerReferralServiceDeps): string {
  return (deps.now?.() ?? new Date()).toISOString();
}

function auditSecret(deps: PartnerReferralServiceDeps): string {
  const secret = deps.auditSecret?.() ?? consentAuditSecret();
  if (secret.length < 32) throw new PartnerReferralError(503, 'partner_ledger_unavailable', 'Das Partner-Ledger ist derzeit nicht verfügbar.');
  return secret;
}

function referralSecret(deps: PartnerReferralServiceDeps): string {
  const secret = deps.tokenSecret();
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new PartnerReferralError(503, 'partner_signing_unavailable', 'Personalisierte Partnerlinks sind derzeit nicht verfügbar.');
  }
  return secret;
}

function publicOrigin(deps: PartnerReferralServiceDeps): string {
  const value = deps.publicUrl();
  if (!value) throw new PartnerReferralError(503, 'partner_origin_unconfigured', 'Die öffentliche App-Adresse ist nicht konfiguriert.');
  let url: URL;
  try { url = new URL(value); } catch { throw new PartnerReferralError(503, 'partner_origin_unconfigured', 'Die öffentliche App-Adresse ist nicht konfiguriert.'); }
  const localDev = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localDev && url.protocol === 'http:')) {
    throw new PartnerReferralError(503, 'partner_origin_unconfigured', 'Die öffentliche App-Adresse muss HTTPS verwenden.');
  }
  return url.origin;
}

function makeLedger(
  deps: PartnerReferralServiceDeps,
  eventType: string,
  actorUid: string | null,
  options: { ownerUid?: string | null; buyerUid?: string | null; campaignId?: string | null; referralId?: string | null } = {},
) {
  const db = deps.getFirestore();
  const eventId = crypto.randomUUID();
  const secret = auditSecret(deps);
  const payload = {
    schemaVersion: 1,
    eventId,
    eventType,
    occurredAt: nowIso(deps),
    actorRef: actorUid ? pseudonymousPartnerUid(actorUid, secret) : null,
    ownerRef: options.ownerUid ? pseudonymousPartnerUid(options.ownerUid, secret) : null,
    buyerRef: options.buyerUid ? pseudonymousPartnerUid(options.buyerUid, secret) : null,
    campaignId: options.campaignId ?? null,
    referralId: options.referralId ?? null,
  };
  return { ref: db.collection(LEDGER).doc(eventId), record: signHmacAuditPayload(payload, secret) };
}

function withLedgerDetails(
  deps: PartnerReferralServiceDeps,
  ledger: { record: Record<string, unknown> },
  details: Record<string, unknown>,
) {
  const { signature: _signature, signatureAlgorithm: _algorithm, ...payload } = ledger.record;
  return signHmacAuditPayload({ ...payload, ...details }, auditSecret(deps));
}

function campaignFrom(snapshot: DocumentSnapshot): PartnerCampaignRecord | null {
  if (!snapshot.exists) return null;
  const data = snapshot.data() ?? {};
  return {
    id: snapshot.id,
    name: String(data.name ?? ''),
    slug: String(data.slug ?? ''),
    destinationUrl: String(data.destinationUrl ?? ''),
    rewardLabel: String(data.rewardLabel ?? ''),
    termsSummary: String(data.termsSummary ?? ''),
    brandVerified: data.brandVerified === true,
    status: data.status === 'active' || data.status === 'inactive' || data.status === 'deleted' ? data.status : 'draft',
    clickCount: Number.isSafeInteger(data.clickCount) && data.clickCount >= 0 ? data.clickCount : 0,
    qualifiedConversions: Number.isSafeInteger(data.qualifiedConversions) && data.qualifiedConversions >= 0 ? data.qualifiedConversions : 0,
    createdAt: String(data.createdAt ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    deletedAt: typeof data.deletedAt === 'string' ? data.deletedAt : null,
    createdByRef: typeof data.createdByRef === 'string' ? data.createdByRef : null,
    updatedByRef: typeof data.updatedByRef === 'string' ? data.updatedByRef : null,
    verifiedByRef: typeof data.verifiedByRef === 'string' ? data.verifiedByRef : null,
    version: Number.isSafeInteger(data.version) && data.version > 0 ? data.version : 1,
  };
}

function campaignIsActive(data: Record<string, unknown> | undefined): boolean {
  return !!data && data.status === 'active' && data.brandVerified === true && data.deletedAt == null;
}

function ensureActiveStatus(status: 'draft' | 'active' | 'inactive' | 'deleted', brandVerified: boolean): void {
  if (status === 'active' && !brandVerified) {
    throw new PartnerReferralError(409, 'brand_verification_required', 'Eine Kampagne kann erst nach bestätigter Markenprüfung aktiviert werden.');
  }
}

function createSlugRef(db: Firestore, slug: string): DocumentReference {
  return db.collection(SLUGS).doc(slug);
}

export async function listPartnerCampaignsForAdmin(deps: PartnerReferralServiceDeps): Promise<PartnerCampaignRecord[]> {
  const snapshot = await deps.getFirestore().collection(CAMPAIGNS).limit(250).get();
  return snapshot.docs
    .map(campaignFrom)
    .filter((campaign): campaign is PartnerCampaignRecord => campaign !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createPartnerCampaign(
  deps: PartnerReferralServiceDeps,
  actorUid: string,
  input: unknown,
): Promise<PartnerCampaignRecord> {
  const parsed = parsePartnerCampaignInput(input) as PartnerCampaignInput;
  if (parsed.brandVerified === true) {
    throw new PartnerReferralError(409, 'separation_of_duties_required', 'Die Markenprüfung muss nach dem Anlegen von einer zweiten Admin-Person bestätigt werden.');
  }
  const brandVerified = false;
  const status = parsed.status ?? 'draft';
  ensureActiveStatus(status, brandVerified);
  const db = deps.getFirestore();
  const id = crypto.randomUUID();
  const now = nowIso(deps);
  const campaignRef = db.collection(CAMPAIGNS).doc(id);
  const slugRef = createSlugRef(db, parsed.slug);
  const ledger = makeLedger(deps, 'campaign_created', actorUid, { campaignId: id });
  await db.runTransaction(async tx => {
    const existingSlug = await tx.get(slugRef);
    if (existingSlug.exists) throw new PartnerReferralError(409, 'campaign_slug_exists', 'Dieser Kampagnen-Slug ist bereits reserviert.');
    tx.create(campaignRef, {
      name: parsed.name,
      slug: parsed.slug,
      destinationUrl: validatePartnerDestinationUrl(parsed.destinationUrl),
      rewardLabel: parsed.rewardLabel,
      termsSummary: parsed.termsSummary,
      brandVerified,
      status,
      clickCount: 0,
      qualifiedConversions: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdByRef: pseudonymousPartnerUid(actorUid, auditSecret(deps)),
      updatedByRef: pseudonymousPartnerUid(actorUid, auditSecret(deps)),
      verifiedByRef: brandVerified ? pseudonymousPartnerUid(actorUid, auditSecret(deps)) : null,
      version: 1,
    });
    tx.create(slugRef, { campaignId: id, status, createdAt: now, updatedAt: now });
    tx.create(ledger.ref, withLedgerDetails(deps, ledger, { campaignSlug: parsed.slug }));
  });
  const saved = await campaignRef.get();
  const campaign = campaignFrom(saved);
  if (!campaign) throw new PartnerReferralError(503, 'campaign_write_unconfirmed', 'Die Kampagne konnte nicht bestätigt werden.');
  return campaign;
}

export async function updatePartnerCampaign(
  deps: PartnerReferralServiceDeps,
  actorUid: string,
  id: string,
  input: unknown,
): Promise<PartnerCampaignRecord> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new PartnerReferralError(400, 'invalid_campaign_id', 'Die Kampagnenkennung ist ungültig.');
  const patch = parsePartnerCampaignInput(input, true) as PartnerCampaignPatch;
  if (Object.keys(patch).length === 0) throw new PartnerReferralError(400, 'empty_patch', 'Es wurden keine Änderungen übermittelt.');
  const db = deps.getFirestore();
  const campaignRef = db.collection(CAMPAIGNS).doc(id);
  const ledger = makeLedger(deps, 'campaign_updated', actorUid, { campaignId: id });
  const now = nowIso(deps);
  await db.runTransaction(async tx => {
    const currentSnap = await tx.get(campaignRef);
    if (!currentSnap.exists) throw new PartnerReferralError(404, 'campaign_not_found', 'Die Kampagne wurde nicht gefunden.');
    const current = currentSnap.data() ?? {};
    if (current.status === 'deleted' || typeof current.deletedAt === 'string') {
      throw new PartnerReferralError(410, 'campaign_deleted', 'Eine gelöschte Kampagne kann nicht geändert werden.');
    }
    const nextSlug = patch.slug ?? String(current.slug ?? '');
    const newSlugRef = createSlugRef(db, nextSlug);
    const slugSnap = nextSlug !== current.slug ? await tx.get(newSlugRef) : null;
    if (slugSnap?.exists) throw new PartnerReferralError(409, 'campaign_slug_exists', 'Dieser Kampagnen-Slug ist bereits reserviert.');
    const nextBrandVerified = patch.brandVerified ?? current.brandVerified === true;
    const nextStatus = patch.status ?? (current.status as PartnerCampaignRecord['status'] ?? 'draft');
    if (patch.brandVerified === true && current.brandVerified !== true
      && current.createdByRef === pseudonymousPartnerUid(actorUid, auditSecret(deps))) {
      throw new PartnerReferralError(409, 'separation_of_duties_required', 'Die erstellende Admin-Person darf die eigene Kampagne nicht selbst als geprüft freigeben.');
    }
    ensureActiveStatus(nextStatus, nextBrandVerified);
    const update: Partial<PartnerCampaignRecord> = {
      ...patch,
      updatedAt: now,
      updatedByRef: pseudonymousPartnerUid(actorUid, auditSecret(deps)),
      version: (Number.isSafeInteger(current.version) && Number(current.version) > 0 ? Number(current.version) : 1) + 1,
    };
    if (patch.destinationUrl !== undefined) update.destinationUrl = validatePartnerDestinationUrl(patch.destinationUrl);
    if (patch.brandVerified === true && current.brandVerified !== true) update.verifiedByRef = pseudonymousPartnerUid(actorUid, auditSecret(deps));
    if (patch.brandVerified === false) update.verifiedByRef = null;
    tx.update(campaignRef, update);
    if (nextSlug !== current.slug) {
      tx.update(createSlugRef(db, String(current.slug)), { status: 'superseded', updatedAt: now });
      tx.create(newSlugRef, { campaignId: id, status: nextStatus, createdAt: now, updatedAt: now });
    } else {
      tx.set(createSlugRef(db, nextSlug), { campaignId: id, status: nextStatus, updatedAt: now }, { merge: true });
    }
    tx.create(ledger.ref, withLedgerDetails(deps, ledger, { campaignSlug: nextSlug, newStatus: nextStatus }));
  });
  const saved = await campaignRef.get();
  const campaign = campaignFrom(saved);
  if (!campaign) throw new PartnerReferralError(503, 'campaign_write_unconfirmed', 'Die Kampagne konnte nicht bestätigt werden.');
  return campaign;
}

export async function softDeletePartnerCampaign(
  deps: PartnerReferralServiceDeps,
  actorUid: string,
  id: string,
): Promise<{ id: string; status: 'deleted' }> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new PartnerReferralError(400, 'invalid_campaign_id', 'Die Kampagnenkennung ist ungültig.');
  const db = deps.getFirestore();
  const campaignRef = db.collection(CAMPAIGNS).doc(id);
  const now = nowIso(deps);
  const ledger = makeLedger(deps, 'campaign_soft_deleted', actorUid, { campaignId: id });
  await db.runTransaction(async tx => {
    const snap = await tx.get(campaignRef);
    if (!snap.exists) throw new PartnerReferralError(404, 'campaign_not_found', 'Die Kampagne wurde nicht gefunden.');
    const data = snap.data() ?? {};
    if (data.status === 'deleted') return;
    const slugRef = createSlugRef(db, String(data.slug ?? ''));
    // Finish every read before writes: transactions retry atomically on contention.
    await tx.get(slugRef);
    tx.update(campaignRef, {
      status: 'deleted',
      deletedAt: now,
      updatedAt: now,
      updatedByRef: pseudonymousPartnerUid(actorUid, auditSecret(deps)),
      version: (Number.isSafeInteger(data.version) && Number(data.version) > 0 ? Number(data.version) : 1) + 1,
    });
    tx.set(slugRef, { status: 'deleted', updatedAt: now }, { merge: true });
    tx.create(ledger.ref, withLedgerDetails(deps, ledger, { campaignSlug: String(data.slug ?? '') }));
  });
  return { id, status: 'deleted' };
}

function requirePartnerUserData(data: Record<string, unknown> | undefined): { version: number } {
  if (!data) throw new PartnerReferralError(404, 'account_not_found', 'Das Konto wurde nicht gefunden.');
  if (data.isAdult !== true) throw new PartnerReferralError(403, 'age_gate_required', 'Bitte schließe zuerst die Altersprüfung ab.');
  const version = Number.isSafeInteger(data.partnerReferralVersion) && Number(data.partnerReferralVersion) >= 1 ? Number(data.partnerReferralVersion) : 1;
  return { version };
}

export async function getPartnerConsentState(deps: PartnerReferralServiceDeps, uid: string): Promise<{ allowed: boolean }> {
  const snapshot = await deps.getFirestore().collection('users').doc(uid).get();
  const data = snapshot.data();
  requirePartnerUserData(data);
  return { allowed: data?.partnerReferralConsent === true };
}

export async function setPartnerConsent(
  deps: PartnerReferralServiceDeps,
  uid: string,
  allowed: boolean,
): Promise<{ allowed: boolean; version: number | null }> {
  const db = deps.getFirestore();
  const userRef = db.collection('users').doc(uid);
  const deletionRef = db.collection('account_deletions').doc(uid);
  const now = nowIso(deps);
  const ledger = makeLedger(deps, allowed ? 'partner_consent_granted' : 'partner_consent_withdrawn', uid);
  let result: { allowed: boolean; version: number | null } = { allowed, version: null };
  await db.runTransaction(async tx => {
    const userSnap = await tx.get(userRef);
    const deletionSnap = await tx.get(deletionRef);
    if (deletionSnap.exists) throw new PartnerReferralError(409, 'account_deletion_pending', 'Das Konto wird gelöscht und kann nicht für Partnerlinks genutzt werden.');
    const data = userSnap.data();
    const current = requirePartnerUserData(data);
    const currentlyAllowed = data?.partnerReferralConsent === true;
    const validEpoch = typeof data?.partnerReferralVersion === 'number'
      && Number.isSafeInteger(data.partnerReferralVersion)
      && data.partnerReferralVersion >= 1;
    if (allowed && data?.partnerReferralEpochQuarantined === true) {
      throw new PartnerReferralError(409, 'partner_consent_epoch_quarantined', 'Die frühere Einwilligung muss vor einer erneuten Zustimmung geprüft werden.');
    }
    // Withdrawing consent must remain possible even when existing history is
    // corrupt or has exhausted the safe integer range. Never synthesize an
    // epoch or re-enable privileges: quarantine the epoch for manual review.
    if (!allowed && currentlyAllowed && (!validEpoch || data.partnerReferralVersion === Number.MAX_SAFE_INTEGER)) {
      tx.update(userRef, {
        partnerReferralConsent: false,
        partnerReferralEpochQuarantined: true,
        partnerReferralConsentUpdatedAt: now,
      });
      tx.create(ledger.ref, withLedgerDetails(deps, ledger, {
        partnerConsent: false, tokenVersion: validEpoch ? data.partnerReferralVersion : null,
        epochQuarantined: true,
      }));
      result = { allowed: false, version: null };
      return;
    }
    if (currentlyAllowed && !validEpoch) {
      throw new PartnerReferralError(409, 'partner_consent_epoch_inconsistent', 'Die vorhandene Partner-Einwilligung muss überprüft werden.');
    }
    let version = current.version;
    if (!allowed && currentlyAllowed) version += 1;
    if (currentlyAllowed === allowed && Number(data?.partnerReferralVersion) === version) {
      result = { allowed, version };
      return;
    }
    tx.update(userRef, {
      partnerReferralConsent: allowed,
      partnerReferralVersion: version,
      partnerReferralConsentUpdatedAt: now,
    });
    tx.create(ledger.ref, withLedgerDetails(deps, ledger, { partnerConsent: allowed, tokenVersion: version }));
    result = { allowed, version };
  });
  return result;
}

function buildPartnerUrl(token: string, origin: string): string {
  return new URL('/api/partner/click/' + token, origin).toString();
}

function directDestination(destinationUrl: string): string {
  return validatePartnerDestinationUrl(destinationUrl);
}

function trackedDestination(destinationUrl: string, token: string): string {
  const url = new URL(validatePartnerDestinationUrl(destinationUrl));
  url.searchParams.set('klar_referral', token);
  return url.toString();
}

async function ensureReferralForCampaign(
  deps: PartnerReferralServiceDeps,
  uid: string,
  campaign: PartnerCampaignRecord,
  userVersion: number,
): Promise<{ referralId: string; token: string; url: string } | null> {
  const db = deps.getFirestore();
  const secret = referralSecret(deps);
  const token = derivePartnerReferralToken(uid, campaign.id, userVersion, secret);
  const referralId = partnerReferralDocumentId(token);
  const referralRef = db.collection(REFERRALS).doc(referralId);
  const campaignRef = db.collection(CAMPAIGNS).doc(campaign.id);
  const userRef = db.collection('users').doc(uid);
  const deletionRef = db.collection('account_deletions').doc(uid);
  const ledger = makeLedger(deps, 'referral_link_issued', uid, { ownerUid: uid, campaignId: campaign.id, referralId });
  const now = nowIso(deps);
  const ready = await db.runTransaction(async tx => {
    const [referralSnap, campaignSnap, userSnap, deletionSnap] = await tx.getAll(referralRef, campaignRef, userRef, deletionRef);
    if (!referralSnap || !campaignSnap || !userSnap || !deletionSnap) {
      throw new PartnerReferralError(503, 'partner_read_incomplete', 'Die Partnerdaten konnten nicht vollständig geprüft werden.');
    }
    if (deletionSnap.exists || !userSnap.exists || userSnap.data()?.isAdult !== true
      || userSnap.data()?.partnerReferralConsent !== true
      || (Number.isSafeInteger(userSnap.data()?.partnerReferralVersion) ? Number(userSnap.data()?.partnerReferralVersion) : 1) !== userVersion
      || !campaignIsActive(campaignSnap.data())) return false;
    if (referralSnap.exists) {
      const existing = referralSnap.data() ?? {};
      return existing.ownerUid === uid && existing.campaignId === campaign.id && existing.version === userVersion && existing.status === 'active';
    }
    tx.create(referralRef, {
      ownerUid: uid,
      campaignId: campaign.id,
      campaignSlug: campaign.slug,
      version: userVersion,
      status: 'active',
      clickCount: 0,
      qualifiedConversions: 0,
      createdAt: now,
      updatedAt: now,
    });
    tx.create(ledger.ref, withLedgerDetails(deps, ledger, { campaignSlug: campaign.slug }));
    return true;
  });
  return ready ? { referralId, token, url: buildPartnerUrl(token, publicOrigin(deps)) } : null;
}

export async function listPartnerReferralLinks(
  deps: PartnerReferralServiceDeps,
  uid: string,
): Promise<{ consent: { allowed: true }; referrals: Array<{ campaign: PartnerCampaignRecord; url: string; clickCount: number; qualifiedConversions: number }> }> {
  const db = deps.getFirestore();
  const userSnap = await db.collection('users').doc(uid).get();
  const data = userSnap.data();
  const userState = requirePartnerUserData(data);
  if (data?.partnerReferralConsent !== true) throw new PartnerReferralError(403, 'partner_consent_required', 'Aktiviere zuerst die separate Einwilligung für Partner-Empfehlungen.');
  const snapshot = await db.collection(CAMPAIGNS).where('status', '==', 'active').limit(100).get();
  const activeCampaigns = snapshot.docs
    .map(campaignFrom)
    .filter((campaign): campaign is PartnerCampaignRecord => campaign !== null && campaign.brandVerified && campaign.status === 'active');
  // No campaign is a valid empty state. Do not require a public origin or signing
  // infrastructure until a link is actually needed.
  if (activeCampaigns.length === 0) return { consent: { allowed: true }, referrals: [] };
  const origin = publicOrigin(deps);
  const referrals: Array<{ campaign: PartnerCampaignRecord; url: string; clickCount: number; qualifiedConversions: number }> = [];
  for (const campaign of activeCampaigns) {
    const ensured = await ensureReferralForCampaign(deps, uid, campaign, userState.version);
    if (!ensured) continue;
    const ref = await db.collection(REFERRALS).doc(ensured.referralId).get();
    const values = ref.data() ?? {};
    referrals.push({
      campaign,
      url: buildPartnerUrl(ensured.token, origin),
      clickCount: Number.isSafeInteger(values.clickCount) && values.clickCount >= 0 ? values.clickCount : 0,
      qualifiedConversions: Number.isSafeInteger(values.qualifiedConversions) && values.qualifiedConversions >= 0 ? values.qualifiedConversions : 0,
    });
  }
  return { consent: { allowed: true }, referrals };
}

export async function recordPartnerInteraction(
  deps: PartnerReferralServiceDeps,
  uid: string,
  campaignId: string,
  action: 'copy' | 'share' | 'qr_view' | 'open_link',
): Promise<{ ok: true }> {
  if (!['copy', 'share', 'qr_view', 'open_link'].includes(action)) throw new PartnerReferralError(400, 'invalid_interaction', 'Diese Partneraktion ist nicht zulässig.');
  const db = deps.getFirestore();
  const userRef = db.collection('users').doc(uid);
  const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
  const ledger = makeLedger(deps, 'referral_' + action, uid, { campaignId });
  const userSnap = await userRef.get();
  const data = userSnap.data();
  const state = requirePartnerUserData(data);
  if (data?.partnerReferralConsent !== true) throw new PartnerReferralError(403, 'partner_consent_required', 'Die Partner-Einwilligung ist nicht aktiv.');
  const campaign = campaignFrom(await campaignRef.get());
  if (!campaign || campaign.status !== 'active' || !campaign.brandVerified) throw new PartnerReferralError(410, 'campaign_unavailable', 'Diese Partnerkampagne ist nicht verfügbar.');
  const token = derivePartnerReferralToken(uid, campaign.id, state.version, referralSecret(deps));
  const referralId = partnerReferralDocumentId(token);
  const referralRef = db.collection(REFERRALS).doc(referralId);
  const now = nowIso(deps);
  await db.runTransaction(async tx => {
    const [savedUser, savedCampaign, referral, deletion] = await tx.getAll(userRef, campaignRef, referralRef, db.collection('account_deletions').doc(uid));
    if (!savedUser || !savedCampaign || !referral || !deletion) {
      throw new PartnerReferralError(503, 'partner_read_incomplete', 'Die Partnerdaten konnten nicht vollständig geprüft werden.');
    }
    const savedData = savedUser.data();
    if (deletion.exists || savedData?.partnerReferralConsent !== true
      || (Number.isSafeInteger(savedData?.partnerReferralVersion) ? Number(savedData?.partnerReferralVersion) : 1) !== state.version
      || !campaignIsActive(savedCampaign.data()) || !referral.exists || referral.data()?.ownerUid !== uid) {
      throw new PartnerReferralError(409, 'partner_interaction_stale', 'Der Partnerlink ist nicht mehr aktuell. Bitte lade die Übersicht neu.');
    }
    tx.create(ledger.ref, ledger.record);
    tx.update(referralRef, { updatedAt: now });
  });
  return { ok: true };
}

export async function openPartnerReferral(
  deps: PartnerReferralServiceDeps,
  uid: string,
  campaignId: string,
): Promise<{ url: string }> {
  const campaignRef = deps.getFirestore().collection(CAMPAIGNS).doc(campaignId);
  const campaign = campaignFrom(await campaignRef.get());
  if (!campaign || campaign.status !== 'active' || !campaign.brandVerified) throw new PartnerReferralError(410, 'campaign_unavailable', 'Diese Partnerkampagne ist nicht verfügbar.');
  const links = await listPartnerReferralLinks(deps, uid);
  const item = links.referrals.find(referral => referral.campaign.id === campaignId);
  if (!item) throw new PartnerReferralError(410, 'campaign_unavailable', 'Diese Partnerkampagne ist nicht verfügbar.');
  // Opening a partner from the signed-in profile must not traverse the
  // click-counting redirect. Attach the same referral token directly to the
  // validated partner destination and keep this UI action separately audited.
  const token = new URL(item.url).pathname.split('/').pop();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    throw new PartnerReferralError(503, 'referral_link_invalid', 'Der Partnerlink konnte nicht sicher geöffnet werden.');
  }
  await recordPartnerInteraction(deps, uid, campaignId, 'open_link');
  return { url: trackedDestination(campaign.destinationUrl, token) };
}

export async function recordPartnerClick(
  deps: PartnerReferralServiceDeps,
  token: string,
  request: { userAgent?: string | null; purpose?: string | null; secPurpose?: string | null; method?: string | null },
  visitorUid: string | null = null,
): Promise<{ url: string; tracked: boolean }> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new PartnerReferralError(404, 'partner_link_not_found', 'Dieser Partnerlink ist nicht verfügbar.');
  const db = deps.getFirestore();
  const referralId = partnerReferralDocumentId(token);
  const referralRef = db.collection(REFERRALS).doc(referralId);
  const referralSnap = await referralRef.get();
  if (!referralSnap.exists) throw new PartnerReferralError(404, 'partner_link_not_found', 'Dieser Partnerlink ist nicht verfügbar.');
  const referralData = referralSnap.data() ?? {};
  const ownerUid = typeof referralData.ownerUid === 'string' ? referralData.ownerUid : '';
  const campaignId = typeof referralData.campaignId === 'string' ? referralData.campaignId : '';
  const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
  const ownerRef = db.collection('users').doc(ownerUid);
  const [campaignSnap, ownerSnap] = await Promise.all([campaignRef.get(), ownerRef.get()]);
  const campaign = campaignFrom(campaignSnap);
  if (!campaign || campaign.status !== 'active' || !campaign.brandVerified) throw new PartnerReferralError(410, 'campaign_unavailable', 'Diese Partnerkampagne ist nicht mehr aktiv.');
  const destination = directDestination(campaign.destinationUrl);
  const ownerData = ownerSnap.data();
  const activeConsent = ownerData?.partnerReferralConsent === true
    && (Number.isSafeInteger(ownerData?.partnerReferralVersion) ? Number(ownerData?.partnerReferralVersion) : 1) === referralData.version
    && referralData.status === 'active';
  // Preview crawlers and the link owner's authenticated visit never earn clicks.
  if (!activeConsent || visitorUid === ownerUid || request.method !== 'GET'
    || isAutomatedPartnerClick(request)) return { url: destination, tracked: false };

  const ledger = makeLedger(deps, 'referral_click_counted', null, { ownerUid, campaignId, referralId });
  const now = nowIso(deps);
  const tracked = await db.runTransaction(async tx => {
    const deletionRef = db.collection('account_deletions').doc(ownerUid);
    const [savedReferral, savedCampaign, savedOwner, deletion] = await tx.getAll(referralRef, campaignRef, ownerRef, deletionRef);
    if (!savedReferral || !savedCampaign || !savedOwner || !deletion) {
      throw new PartnerReferralError(503, 'partner_read_incomplete', 'Die Partnerdaten konnten nicht vollständig geprüft werden.');
    }
    const owner = savedOwner.data();
    const referral = savedReferral.data();
    if (deletion.exists || !savedReferral.exists || !campaignIsActive(savedCampaign.data())
      || owner?.partnerReferralConsent !== true
      || (Number.isSafeInteger(owner?.partnerReferralVersion) ? Number(owner?.partnerReferralVersion) : 1) !== referral?.version
      || referral?.status !== 'active') return false;
    tx.update(referralRef, { clickCount: FieldValue.increment(1), lastClickAt: now, updatedAt: now });
    tx.update(campaignRef, { clickCount: FieldValue.increment(1), updatedAt: now });
    tx.create(ledger.ref, { ...ledger.record });
    return true;
  });
  return tracked ? { url: trackedDestination(destination, token), tracked: true } : { url: destination, tracked: false };
}

export async function recordPartnerConversion(
  deps: PartnerReferralServiceDeps,
  slug: string,
  payload: PartnerConversionPayload,
  partnerSecret: string,
): Promise<{ ok: true; duplicate: boolean; rewardStatus: 'pending_verification' | 'already_recorded' }> {
  if (partnerSecret.length < 32) throw new PartnerReferralError(503, 'partner_webhook_unconfigured', 'Der Partner-Rückkanal ist nicht konfiguriert.');
  const db = deps.getFirestore();
  const referralId = partnerReferralDocumentId(payload.referralToken);
  const referralRef = db.collection(REFERRALS).doc(referralId);
  const referralInitial = await referralRef.get();
  if (!referralInitial.exists) throw new PartnerReferralError(404, 'partner_link_not_found', 'Der verknüpfte Partnerlink wurde nicht gefunden.');
  const initial = referralInitial.data() ?? {};
  const ownerUid = typeof initial.ownerUid === 'string' ? initial.ownerUid : '';
  if (!ownerUid || ownerUid === payload.buyerUid) throw new PartnerReferralError(409, 'self_referral_rejected', 'Selbst-Empfehlungen sind nicht prämienberechtigt.');
  const campaignId = typeof initial.campaignId === 'string' ? initial.campaignId : '';
  const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
  const ownerRef = db.collection('users').doc(ownerUid);
  const buyerRef = db.collection('users').doc(payload.buyerUid);
  const ownerDeletionRef = db.collection('account_deletions').doc(ownerUid);
  const buyerDeletionRef = db.collection('account_deletions').doc(payload.buyerUid);
  // Provider signing-key rotation must not reset idempotency. Event and buyer
  // claim identifiers use the stable audit key, not the rotating campaign webhook key.
  const idempotencySecret = auditSecret(deps);
  const eventIdHash = partnerWebhookEventDocumentId(slug, payload.eventId, idempotencySecret);
  // The event ID is an idempotency key, not permission to change its buyer or referral.
  // Bind the original provider assertion with a domain-separated stable HMAC,
  // never storing the plain buyer UID, token, or partner event ID.
  const eventBinding = crypto.createHmac('sha256', idempotencySecret)
    .update(JSON.stringify(['klar-partner-event-binding:v1', slug, payload.eventId, payload.referralToken, payload.buyerUid]), 'utf8')
    .digest('hex');
  const eventRef = db.collection(CONVERSIONS).doc(eventIdHash);
  const buyerClaimRef = db.collection(BUYER_CLAIMS).doc(partnerBuyerClaimDocumentId(slug, payload.buyerUid, idempotencySecret));
  const now = nowIso(deps);
  // A partner signature attests only the provider assertion, never the purchase.
  const audit = makeLedger(deps, 'partner_conversion_asserted', null, {
    ownerUid,
    buyerUid: payload.buyerUid,
    campaignId,
    referralId,
  });

  const result = await db.runTransaction(async tx => {
    const [referralSnap, campaignSnap, ownerSnap, buyerSnap, ownerDeletion, buyerDeletion, eventSnap, buyerClaimSnap] = await tx.getAll(
      referralRef, campaignRef, ownerRef, buyerRef, ownerDeletionRef, buyerDeletionRef, eventRef, buyerClaimRef,
    );
    if (!referralSnap || !campaignSnap || !ownerSnap || !buyerSnap || !ownerDeletion || !buyerDeletion || !eventSnap || !buyerClaimSnap) {
      throw new PartnerReferralError(503, 'partner_read_incomplete', 'Die Partnerdaten konnten nicht vollständig geprüft werden.');
    }
    const referral = referralSnap.data();
    const campaign = campaignSnap.data();
    const owner = ownerSnap.data();
    const buyer = buyerSnap.data();
    if (ownerDeletion.exists || buyerDeletion.exists || !campaignIsActive(campaign)
      || campaign?.slug !== slug || !referralSnap.exists || referral?.status !== 'active'
      || referral?.ownerUid !== ownerUid || referral?.campaignId !== campaignId
      || !ownerSnap.exists || owner?.isAdult !== true || owner?.partnerReferralConsent !== true
      || (Number.isSafeInteger(owner?.partnerReferralVersion) ? Number(owner?.partnerReferralVersion) : 1) !== referral?.version
      || !buyerSnap.exists || buyer?.isAdult !== true || buyer?.partnerReferralConsent !== true) {
      throw new PartnerReferralError(403, 'conversion_not_eligible', 'Die Empfehlung erfüllt die aktuellen Alters-, Einwilligungs- oder Kampagnenbedingungen nicht.');
    }
    // A withdrawn/re-granted consent is a different authorization epoch.
    // Version changes must never resurrect an old partner assertion.
    const buyerConsentVersion = buyer?.partnerReferralVersion;
    // Do not infer a consent epoch for absent, corrupt, negative or fractional
    // values. A legacy user must re-establish a recorded consent epoch.
    if (typeof buyerConsentVersion !== 'number'
      || !Number.isSafeInteger(buyerConsentVersion) || buyerConsentVersion < 1) {
      throw new PartnerReferralError(403, 'buyer_consent_epoch_missing', 'Die Partner-Einwilligung muss erneut bestätigt werden.');
    }
    // A previously recorded event does not bypass fresh consent, legal hold,
    // deletion or campaign-eligibility checks on a provider retry.
    if (eventSnap.exists) {
      // Legacy records lacking a binding must be reviewed, never silently trusted.
      if (eventSnap.data()?.eventBinding !== eventBinding) {
        throw new PartnerReferralError(409, 'partner_event_id_conflict', 'Die Partner-Ereigniskennung ist bereits einer anderen Meldung zugeordnet.');
      }
      // Both conversion and buyer-claim documents were atomically created.
      // Missing/mismatched links indicate tampering or incomplete migration:
      // do not acknowledge a corrupt replay as a successful duplicate.
      // A valid HMAC binding cannot attest that persisted event fields were
      // never changed independently. Quarantine inconsistent event records.
      if (eventSnap.data()?.campaignId !== campaignId
        || eventSnap.data()?.referralId !== referralId
        || eventSnap.data()?.buyerRef !== pseudonymousPartnerUid(payload.buyerUid, idempotencySecret)
        || eventSnap.data()?.ownerRef !== pseudonymousPartnerUid(ownerUid, idempotencySecret)
        || eventSnap.data()?.proofStatus !== 'partner_assertion_only'
        || eventSnap.data()?.rewardStatus !== 'pending_verification'
        || eventSnap.data()?.buyerConsentVersion !== buyerConsentVersion) {
        throw new PartnerReferralError(409, 'partner_event_inconsistent', 'Der Partner-Ereignisdatensatz muss unabhängig überprüft werden.');
      }
      if (!buyerClaimSnap.exists
        || buyerClaimSnap.data()?.conversionId !== eventIdHash
        || buyerClaimSnap.data()?.campaignId !== campaignId
        || buyerClaimSnap.data()?.referralId !== referralId
        || buyerClaimSnap.data()?.buyerRef !== pseudonymousPartnerUid(payload.buyerUid, idempotencySecret)
        || buyerClaimSnap.data()?.buyerConsentVersion !== buyerConsentVersion) {
        throw new PartnerReferralError(409, 'partner_claim_inconsistent', 'Die Partner-Ereignis- und Käuferzuordnung muss überprüft werden.');
      }
      return { duplicate: true as const };
    }
    if (buyerClaimSnap.exists) throw new PartnerReferralError(409, 'duplicate_conversion', 'Für dieses Klar-Konto wurde bereits eine Prämie zu dieser Kampagne berücksichtigt.');
    const buyerRefHash = pseudonymousPartnerUid(payload.buyerUid, auditSecret(deps));
    tx.create(eventRef, {
      campaignId,
      referralId,
      ownerRef: pseudonymousPartnerUid(ownerUid, auditSecret(deps)),
      buyerRef: buyerRefHash,
      rewardStatus: 'pending_verification',
      proofStatus: 'partner_assertion_only',
      buyerConsentVersion,
      eventBinding,
      rewardLabel: String(campaign.rewardLabel ?? ''),
      createdAt: now,
    });
    tx.create(buyerClaimRef, {
      campaignId,
      referralId,
      conversionId: eventIdHash,
      buyerRef: buyerRefHash,
      buyerConsentVersion,
      createdAt: now,
    });
    // Partner HMAC proves message origin, not purchase or buyer attribution. Never credit
    // qualified conversion counters or mark rewards earned from this assertion alone.
    tx.create(audit.ref, withLedgerDetails(deps, audit, { rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only' }));
    return { duplicate: false as const };
  });
  return { ok: true, duplicate: result.duplicate, rewardStatus: result.duplicate ? 'already_recorded' : 'pending_verification' };
}
