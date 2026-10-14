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
    const result = await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough');
    expect(result).toEqual({ ok: true, duplicate: false, rewardStatus: 'pending_verification' });
    const conversions = [...db._store.entries()].filter(([key]) => key.startsWith('partner_referral_conversions/'));
    expect(conversions).toHaveLength(1);
    expect(conversions[0]?.[1]).toMatchObject({ rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only' });
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
    expect(db._store.get('partner_referrals/' + referralId)?.qualifiedConversions).toBe(0);
    expect(await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .toEqual({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
  });

});
