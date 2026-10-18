// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { createPartnerCampaign, listPartnerReferralLinks, openPartnerReferral, recordPartnerConversion, setPartnerConsent, updatePartnerCampaign, type PartnerReferralServiceDeps } from '../src/server/partnerReferralService';
import { derivePartnerReferralToken, partnerReferralDocumentId, pseudonymousPartnerUid } from '../src/server/partnerReferralCore';
import { verifyHmacAuditPayload } from '../src/server/consentAudit';

type Stored = Record<string, unknown>;
function makeFirestore(seed: Array<{ collection: string; id: string; data: Stored }> = []) {
  const store = new Map<string, Stored>();
  const path = (collection: string, id: string) => collection + '/' + id;
  for (const item of seed) store.set(path(item.collection, item.id), structuredClone(item.data));
  const snapshot = (id: string, value: Stored | undefined) => ({
    id,
    exists: value !== undefined,
    data: () => value === undefined ? undefined : structuredClone(value),
  });
  const makeRef = (collection: string, id: string) => ({
    id,
    path: path(collection, id),
    get: async () => snapshot(id, store.get(path(collection, id))),
  });
  const db = {
    collection: (collection: string) => ({
      doc: (id = crypto.randomUUID()) => makeRef(collection, id),
      where: (_field: string, _op: string, _value: unknown) => ({
        limit: (_count: number) => ({
          get: async () => ({
            docs: [...store.entries()]
              .filter(([key]) => key.startsWith(collection + '/'))
              .map(([key, value]) => ({ id: key.slice(collection.length + 1), exists: true, data: () => structuredClone(value) })),
          }),
        }),
      }),
      limit: (_count: number) => ({
        get: async () => ({
          docs: [...store.entries()]
            .filter(([key]) => key.startsWith(collection + '/'))
            .map(([key, value]) => ({ id: key.slice(collection.length + 1), exists: true, data: () => structuredClone(value) })),
        }),
      }),
    }),
    runTransaction: async (callback: (tx: {
      get: (ref: { id: string; path: string }) => Promise<ReturnType<typeof snapshot>>;
      getAll: (...refs: Array<{ id: string; path: string }>) => Promise<Array<ReturnType<typeof snapshot>>>;
      create: (ref: { id: string; path: string }, value: Stored) => void;
      set: (ref: { id: string; path: string }, value: Stored, options?: { merge?: boolean }) => void;
      update: (ref: { id: string; path: string }, value: Stored) => void;
    }) => unknown) => callback({
      get: async ref => snapshot(ref.id, store.get(ref.path)),
      getAll: async (...refs) => refs.map(ref => snapshot(ref.id, store.get(ref.path))),
      create: (ref, value) => {
        if (store.has(ref.path)) throw new Error('ALREADY_EXISTS');
        store.set(ref.path, structuredClone(value));
      },
      set: (ref, value, options) => store.set(ref.path, options?.merge ? { ...(store.get(ref.path) ?? {}), ...structuredClone(value) } : structuredClone(value)),
      update: (ref, value) => {
        const existing = store.get(ref.path);
        if (!existing) throw new Error('NOT_FOUND');
        store.set(ref.path, { ...existing, ...structuredClone(value) });
      },
    }),
    _store: store,
    _seed: (collection: string, id: string, data: Stored) => store.set(path(collection, id), structuredClone(data)),
  };
  return db as unknown as Firestore & {
    _store: Map<string, Stored>;
    _seed: (collection: string, id: string, data: Stored) => void;
  };
}
const auditSecret = 'test-audit-secret-at-least-thirty-two-characters';
const tokenSecret = 'test-partner-referral-secret-at-least-thirty-two-characters';
function deps(db: ReturnType<typeof makeFirestore>): PartnerReferralServiceDeps {
  return {
    getFirestore: () => db,
    tokenSecret: () => tokenSecret,
    auditSecret: () => auditSecret,
    publicUrl: () => 'https://klar.example',
    now: () => new Date('2026-10-09T10:00:00.000Z'),
  };
}
const campaignInput = {
  name: 'Example Partner',
  slug: 'example-partner',
  destinationUrl: 'https://partner.example/offer',
  rewardLabel: '10 % Rabatt',
  termsSummary: 'Gilt für Neukunden nach bestätigter Conversion.',
  brandVerified: false,
  status: 'draft' as const,
};

describe('Klar & Partner transactional service boundary', () => {
  it('returns an empty authorized list when no campaigns exist, even without public URL', async () => {
    const db = makeFirestore([{ collection: 'users', id: 'user-1', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } }]);
    const configured = { ...deps(db), publicUrl: () => undefined };
    await expect(listPartnerReferralLinks(configured, 'user-1')).resolves.toEqual({
      consent: { allowed: true }, referrals: [],
    });
  });

  it('never exposes referral links when consent is missing', async () => {
    const db = makeFirestore([{ collection: 'users', id: 'user-1', data: { isAdult: true, partnerReferralConsent: false } }]);
    await expect(listPartnerReferralLinks(deps(db), 'user-1')).rejects.toMatchObject({
      status: 403, code: 'partner_consent_required',
    });
  });

  it('excludes quarantined consent from private referral authorization', async () => {
    const db = makeFirestore([{ collection: 'users', id: 'user-1',
      data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1, partnerReferralEpochQuarantined: true } }]);
    await expect(listPartnerReferralLinks(deps(db), 'user-1'))
      .rejects.toMatchObject({ code: 'partner_consent_required' });
  });

  it('creates a draft, reserves its slug and signs the audit event', async () => {
    const db = makeFirestore();
    const campaign = await createPartnerCampaign(deps(db), 'admin-1', campaignInput);
    expect(campaign).toMatchObject({ slug: 'example-partner', status: 'draft', brandVerified: false, version: 1 });
    expect(db._store.has('partner_campaign_slugs/example-partner')).toBe(true);
    const ledger = [...db._store.entries()].find(([key]) => key.startsWith('partner_referral_ledger/'))?.[1];
    expect(ledger).toBeDefined();
    expect(verifyHmacAuditPayload(ledger as Record<string, unknown> & { signatureAlgorithm: string; signature: string }, auditSecret)).toBe(true);
  });

  it('does not let a creator mark a new campaign as verified during creation', async () => {
    const db = makeFirestore();
    await expect(createPartnerCampaign(deps(db), 'admin-1', { ...campaignInput, brandVerified: true }))
      .rejects.toMatchObject({ status: 409, code: 'separation_of_duties_required' });
    expect(db._store.size).toBe(0);
  });

  it('enforces unique, permanent slugs after a campaign already exists', async () => {
    const db = makeFirestore();
    await createPartnerCampaign(deps(db), 'admin-1', campaignInput);
    await expect(createPartnerCampaign(deps(db), 'admin-2', { ...campaignInput, name: 'Other partner' }))
      .rejects.toMatchObject({ status: 409, code: 'campaign_slug_exists' });
  });

  it('requires a second admin identity to approve the creator’s own campaign', async () => {
    const createdByRef = pseudonymousPartnerUid('admin-1', auditSecret);
    const db = makeFirestore([{
      collection: 'partner_campaigns',
      id: 'campaign-1',
      data: {
        ...campaignInput,
        brandVerified: false,
        status: 'draft',
        createdByRef,
        version: 1,
        updatedAt: '2026-10-09T09:00:00.000Z',
      },
    }]);
    await expect(updatePartnerCampaign(deps(db), 'admin-1', 'campaign-1', { brandVerified: true }))
      .rejects.toMatchObject({ status: 409, code: 'separation_of_duties_required' });
    expect(db._store.get('partner_campaigns/campaign-1')?.brandVerified).toBe(false);
  });

  it('increments token version when partner consent is withdrawn and signs both decisions', async () => {
    const db = makeFirestore([{
      collection: 'users',
      id: 'uid-1',
      data: { isAdult: true, partnerReferralConsent: false },
    }]);
    const serviceDeps = deps(db);
    expect(await setPartnerConsent(serviceDeps, 'uid-1', true)).toEqual({ allowed: true, version: 1 });
    expect(await setPartnerConsent(serviceDeps, 'uid-1', false)).toEqual({ allowed: false, version: 2 });
    expect(db._store.get('users/uid-1')?.partnerReferralConsent).toBe(false);
    expect(db._store.get('users/uid-1')?.partnerReferralVersion).toBe(2);
    const records = [...db._store.entries()]
      .filter(([key]) => key.startsWith('partner_referral_ledger/'))
      .map(([, record]) => record);
    expect(records).toHaveLength(2);
    expect(records.every(record => verifyHmacAuditPayload(
      record as Record<string, unknown> & { signatureAlgorithm: string; signature: string },
      auditSecret,
    ))).toBe(true);
  });

  it('returns a read-only withdrawn state after deletion purges the profile', async () => {
    const db = makeFirestore([
      { collection: 'account_deletions', id: 'uid-purged', data: { status: 'processing' } },
    ]);
    const initial = [...db._store.entries()];
    await expect(setPartnerConsent(deps(db), 'uid-purged', false))
      .resolves.toEqual({ allowed: false, version: null });
    await expect(setPartnerConsent(deps(db), 'uid-purged', false))
      .resolves.toEqual({ allowed: false, version: null });
    expect([...db._store.entries()]).toEqual(initial);
    await expect(setPartnerConsent(deps(db), 'uid-purged', true))
      .rejects.toMatchObject({ code: 'account_deletion_pending' });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
    const untracked = makeFirestore();
    await expect(setPartnerConsent(deps(untracked), 'uid-purged', false))
      .rejects.toMatchObject({ code: 'account_not_found' });
  });

  it('allows consent withdrawal during pending deletion but denies a new grant', async () => {
    const db = makeFirestore([
      { collection: 'users', id: 'uid-deleting', data: {
        isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 3,
      } },
      { collection: 'account_deletions', id: 'uid-deleting', data: { status: 'pending' } },
    ]);
    await expect(setPartnerConsent(deps(db), 'uid-deleting', true))
      .rejects.toMatchObject({ code: 'account_deletion_pending' });
    await expect(setPartnerConsent(deps(db), 'uid-deleting', false))
      .resolves.toEqual({ allowed: false, version: 4 });
    expect(db._store.get('users/uid-deleting')).toMatchObject({
      partnerReferralConsent: false, partnerReferralVersion: 4,
    });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(1);
    await expect(setPartnerConsent(deps(db), 'uid-deleting', false))
      .resolves.toEqual({ allowed: false, version: 4 });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(1);
    await expect(setPartnerConsent(deps(db), 'uid-deleting', true))
      .rejects.toMatchObject({ code: 'account_deletion_pending' });
  });

  it('never silently backfills a missing or invalid epoch on an existing consent grant', async () => {
    for (const invalid of [undefined, null, 0, -1, 1.5, '1']) {
      const db = makeFirestore([{ collection: 'users', id: 'uid-1',
        data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: invalid } }]);
      await expect(setPartnerConsent(deps(db), 'uid-1', true))
        .rejects.toMatchObject({ code: 'partner_consent_epoch_inconsistent' });
      expect(await setPartnerConsent(deps(db), 'uid-1', false))
        .toEqual({ allowed: false, version: null });
      expect(db._store.get('users/uid-1')?.partnerReferralConsent).toBe(false);
      expect(db._store.get('users/uid-1')?.partnerReferralEpochQuarantined).toBe(true);
      expect(db._store.get('users/uid-1')?.partnerReferralVersion).toBe(invalid);
      await expect(setPartnerConsent(deps(db), 'uid-1', true))
        .rejects.toMatchObject({ code: 'partner_consent_epoch_quarantined' });
      expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(1);
      const quarantinedSnapshot = { ...db._store.get('users/uid-1') };
      expect(await setPartnerConsent(deps(db), 'uid-1', false))
        .toEqual({ allowed: false, version: null });
      expect(db._store.get('users/uid-1')).toEqual(quarantinedSnapshot);
      expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(1);

    }
    const full = makeFirestore([{ collection: 'users', id: 'uid-1',
      data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: Number.MAX_SAFE_INTEGER } }]);
    expect(await setPartnerConsent(deps(full), 'uid-1', false))
      .toEqual({ allowed: false, version: null });
    expect(full._store.get('users/uid-1')?.partnerReferralConsent).toBe(false);
    expect(full._store.get('users/uid-1')?.partnerReferralEpochQuarantined).toBe(true);
    expect(full._store.get('users/uid-1')?.partnerReferralVersion).toBe(Number.MAX_SAFE_INTEGER);
    await expect(setPartnerConsent(deps(full), 'uid-1', true))
      .rejects.toMatchObject({ code: 'partner_consent_epoch_quarantined' });
    expect([...full._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(1);
  });

  it('opens a partner directly without counting the referrer’s own open as a tracked click', async () => {
    const db = makeFirestore([{
      collection: 'users',
      id: 'uid-1',
      data: { isAdult: true, partnerReferralConsent: false, partnerReferralVersion: 1 },
    }]);
    const serviceDeps = deps(db);
    const draft = await createPartnerCampaign(serviceDeps, 'admin-creator', campaignInput);
    await updatePartnerCampaign(serviceDeps, 'admin-reviewer', draft.id, { brandVerified: true, status: 'active' });
    await setPartnerConsent(serviceDeps, 'uid-1', true);

    const opened = await openPartnerReferral(serviceDeps, 'uid-1', draft.id);
    const destination = new URL(opened.url);
    expect(destination.origin).toBe('https://partner.example');
    expect(destination.pathname).toBe('/offer');
    expect(destination.searchParams.get('klar_referral')).toMatch(/^[a-f0-9]{64}$/);
    expect(opened.url).not.toContain('/api/partner/click/');

    const referrals = [...db._store.entries()].filter(([key]) => key.startsWith('partner_referrals/'));
    expect(referrals).toHaveLength(1);
    expect(referrals[0]?.[1].clickCount).toBe(0);
    const ledger = [...db._store.entries()]
      .filter(([key]) => key.startsWith('partner_referral_ledger/'))
      .map(([, record]) => record);
    expect(ledger.some(record => record.eventType === 'referral_open_link')).toBe(true);
  });
  it('quarantines signed but independently unverified partner claims without crediting conversions', async () => {
    const uid = 'owner-1';
    const buyer = 'buyer-1';
    const campaignId = 'campaign-1';
    const slug = 'example-partner';
    const token = derivePartnerReferralToken(uid, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    const db = makeFirestore([
      { collection: 'users', id: uid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'users', id: buyer, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, slug, brandVerified: true, status: 'active', qualifiedConversions: 0 } },
      { collection: 'partner_referrals', id: referralId, data: { ownerUid: uid, campaignId, campaignSlug: slug, version: 1, status: 'active', qualifiedConversions: 0 } },
    ]);
    const payload = { event: 'qualified_conversion' as const, eventId: 'provider-order-00001', referralToken: token, buyerUid: buyer };
    // Invalid or absent epochs must never be silently treated as version 1.
    const originalBuyer = db._store.get('users/' + buyer)!;
    for (const invalidEpoch of [undefined, null, 0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
      db._store.set('users/' + buyer, { ...originalBuyer, partnerReferralVersion: invalidEpoch });
      await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
        .rejects.toMatchObject({ code: 'buyer_consent_epoch_missing' });
    }
    db._store.set('users/' + buyer, originalBuyer);
    // Even if a malformed external writer restores the boolean, a quarantined
    // consent epoch cannot authorize new partner conversions.
    db._store.set('users/' + buyer, { ...originalBuyer, partnerReferralEpochQuarantined: true });
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'conversion_not_eligible' });
    db._store.set('users/' + buyer, originalBuyer);
    const originalOwner = db._store.get('users/' + uid)!;
    db._store.set('users/' + uid, { ...originalOwner, partnerReferralEpochQuarantined: true });
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'conversion_not_eligible' });
    db._store.set('users/' + uid, originalOwner);
    const result = await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough');
    expect(result).toEqual({ ok: true, duplicate: false, rewardStatus: 'pending_verification' });
    const conversions = [...db._store.entries()].filter(([key]) => key.startsWith('partner_referral_conversions/'));
    expect(conversions).toHaveLength(1);
    expect(conversions[0]?.[1]).toMatchObject({ rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only' });
    const conversionLedger = [...db._store.entries()]
      .filter(([key]) => key.startsWith('partner_referral_ledger/'))
      .map(([, record]) => record)
      .filter(record => record.eventType === 'partner_conversion_asserted');
    expect(conversionLedger).toHaveLength(1);
    expect(conversionLedger[0]).toMatchObject({ eventType: 'partner_conversion_asserted' });
    expect([...db._store.values()].some(record => record.eventType === 'partner_conversion_verified')).toBe(false);

    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
    expect(db._store.get('partner_referrals/' + referralId)?.qualifiedConversions).toBe(0);
    expect(await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .toEqual({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
    expect(conversions[0]?.[1]?.eventBinding).toMatch(/^[a-f0-9]{64}$/);
    // The duplicate must be linked to the same immutable buyer claim.
    const claimEntry = [...db._store.entries()].find(([key]) => key.startsWith('partner_referral_buyer_claims/'));
    expect(claimEntry).toBeDefined();
    const [claimKey, originalClaim] = claimEntry!;
    db._store.delete(claimKey);
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_claim_inconsistent' });
    db._store.set(claimKey, { ...originalClaim, conversionId: 'wrong-conversion' });
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_claim_inconsistent' });
    db._store.set(claimKey, originalClaim);
    expect(await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .toEqual({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });
    // Event data is independently checked, not just its HMAC binding.
    const [eventKey, eventOriginal] = conversions[0]!;
    for (const alteration of [
      { campaignId: 'different-campaign' },
      { referralId: 'another-referral' },
      { buyerRef: 'different-buyer-ref' },
      { ownerRef: 'different-owner-ref' },
      { proofStatus: 'verified_without_independent_proof' },
      { rewardStatus: 'earned' },
    ]) {
      db._store.set(eventKey, { ...eventOriginal, ...alteration });
      await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
        .rejects.toMatchObject({ code: 'partner_event_inconsistent' });
    }
    db._store.set(eventKey, eventOriginal);
    expect(await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .toEqual({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });


    await expect(recordPartnerConversion(deps(db), slug, { ...payload, buyerUid: 'different-buyer' }, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_event_id_conflict' });
    await expect(recordPartnerConversion(deps(db), slug, { ...payload, referralToken: derivePartnerReferralToken('other-owner', campaignId, 1, tokenSecret) }, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_link_not_found' });
    expect([...db._store.entries()].filter(([key]) => key.startsWith('partner_referral_conversions/'))).toHaveLength(1);
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);

    // An exact provider retry must not override a newer consent revocation.
    db._store.set('users/' + buyer, { isAdult: true, partnerReferralConsent: false });
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'conversion_not_eligible' });
    expect([...db._store.entries()].filter(([key]) => key.startsWith('partner_referral_conversions/'))).toHaveLength(1);
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
    // A re-grant increments the buyer consent epoch and must not revive an old assertion.
    db._store.set('users/' + buyer, { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 2 });
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_event_inconsistent' });
    // Legacy conversion records with no consent epoch are quarantined, not trusted.
    db._store.set('users/' + buyer, { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 });
    db._store.set(eventKey, { ...eventOriginal, buyerConsentVersion: undefined });
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_event_inconsistent' });
    db._store.set(eventKey, eventOriginal);
    expect(await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .toEqual({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });

  });

});
