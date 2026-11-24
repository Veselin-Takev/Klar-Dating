// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { createPartnerCampaign, listPartnerReferralLinks, openPartnerReferral, recordPartnerClick, recordPartnerConversion, setPartnerConsent, updatePartnerCampaign, type PartnerReferralServiceDeps } from '../src/server/partnerReferralService';
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

  it('rejects the private referral overview during account deletion even with zero campaigns', async () => {
    const db = makeFirestore([
      { collection: 'users', id: 'user-1', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'account_deletions', id: 'user-1', data: { status: 'pending' } },
    ]);
    await expect(listPartnerReferralLinks(deps(db), 'user-1'))
      .rejects.toMatchObject({ status: 409, code: 'partner_account_deleting' });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referrals/'))).toHaveLength(0);
  });

  it('fails closed when the referral overview cannot read the deletion marker', async () => {
    const db = makeFirestore([
      { collection: 'users', id: 'user-1', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
    ]);
    Object.defineProperty(db, 'runTransaction', {
      configurable: true,
      value: async () => { throw new Error('Firestore unavailable'); },
    });
    await expect(listPartnerReferralLinks(deps(db), 'user-1'))
      .rejects.toThrow('Firestore unavailable');
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referrals/'))).toHaveLength(0);
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

  it('rejects missing or malformed owner epochs before issuing referral links', async () => {
    for (const epoch of [undefined, null, 0, -1, '1', 1.5]) {
      const db = makeFirestore([{ collection: 'users', id: 'user-1',
        data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: epoch } }]);
      await expect(listPartnerReferralLinks(deps(db), 'user-1'))
        .rejects.toMatchObject({ code: 'partner_consent_epoch_missing' });
      expect([...db._store.keys()].filter(key => key.startsWith('partner_referrals/'))).toHaveLength(0);
    }
  });

  it('rejects a referral token whose stored owner or campaign binding was modified', async () => {
    const owner = 'bound-owner', visitor = 'bound-visitor', campaignId = 'bound-campaign';
    const token = derivePartnerReferralToken(owner, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    for (const patch of [{ ownerUid: 'different-owner' }, { campaignId: 'different-campaign' }, { version: 2 }, { version: undefined }]) {
      const db = makeFirestore([
        { collection: 'users', id: owner, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
        { collection: 'users', id: visitor, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
        { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, status: 'active', brandVerified: true, clickCount: 0 } },
        { collection: 'partner_referrals', id: referralId, data: { ownerUid: owner, campaignId, status: 'active', version: 1, clickCount: 0, ...patch } },
      ]);
      await expect(recordPartnerClick(deps(db), token, { method: 'GET' }, visitor))
        .rejects.toMatchObject({ code: 'partner_link_not_found' });
      expect(db._store.get('partner_referrals/' + referralId)?.clickCount).toBe(0);
      expect(db._store.get('partner_campaigns/' + campaignId)?.clickCount).toBe(0);
      expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
    }
  });

  it('does not attribute a click after referral metadata changes during transaction', async () => {
    const owner = 'atomic-owner', visitor = 'atomic-visitor', campaignId = 'atomic-campaign';
    const token = derivePartnerReferralToken(owner, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    const db = makeFirestore([
      { collection: 'users', id: owner, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'users', id: visitor, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, status: 'active', brandVerified: true, clickCount: 0 } },
      { collection: 'partner_referrals', id: referralId, data: { ownerUid: owner, campaignId, status: 'active', version: 1, clickCount: 0 } },
    ]);
    const originalTransaction = db.runTransaction.bind(db);
    Object.defineProperty(db, 'runTransaction', {
      configurable: true,
      value: async (callback: Parameters<typeof db.runTransaction>[0]) => {
        const saved = db._store.get('partner_referrals/' + referralId)!;
        db._store.set('partner_referrals/' + referralId, { ...saved, campaignId: 'different-campaign' });
        return originalTransaction(callback);
      },
    });
    expect(await recordPartnerClick(deps(db), token, { method: 'GET' }, visitor))
      .toEqual({ url: 'https://partner.example/offer', tracked: false });
    expect(db._store.get('partner_referrals/' + referralId)?.clickCount).toBe(0);
    expect(db._store.get('partner_campaigns/' + campaignId)?.clickCount).toBe(0);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
  });

  it('does not forward a referral token after the campaign destination changes before transaction', async () => {
    const owner = 'destination-owner', visitor = 'destination-visitor', campaignId = 'destination-campaign';
    const token = derivePartnerReferralToken(owner, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    const db = makeFirestore([
      { collection: 'users', id: owner, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'users', id: visitor, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, status: 'active', brandVerified: true, clickCount: 0 } },
      { collection: 'partner_referrals', id: referralId, data: { ownerUid: owner, campaignId, status: 'active', version: 1, clickCount: 0 } },
    ]);
    const originalTransaction = db.runTransaction.bind(db);
    Object.defineProperty(db, 'runTransaction', {
      configurable: true,
      value: async (callback: Parameters<typeof db.runTransaction>[0]) => {
        const stored = db._store.get('partner_campaigns/' + campaignId)!;
        db._store.set('partner_campaigns/' + campaignId, { ...stored, destinationUrl: 'https://new-partner.example/offer' });
        return originalTransaction(callback);
      },
    });
    const response = await recordPartnerClick(deps(db), token, { method: 'GET' }, visitor);
    expect(response).toEqual({ url: 'https://partner.example/offer', tracked: false });
    expect(db._store.get('partner_referrals/' + referralId)?.clickCount).toBe(0);
    expect(db._store.get('partner_campaigns/' + campaignId)?.clickCount).toBe(0);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
  });

  it('does not count a click if the visitor consent epoch changes before transaction', async () => {
    const owner = 'race-owner', visitor = 'race-visitor', campaignId = 'race-campaign';
    const token = derivePartnerReferralToken(owner, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    const db = makeFirestore([
      { collection: 'users', id: owner, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'users', id: visitor, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, status: 'active', brandVerified: true, clickCount: 0 } },
      { collection: 'partner_referrals', id: referralId, data: { ownerUid: owner, campaignId, status: 'active', version: 1, clickCount: 0 } },
    ]);
    const originalTransaction = db.runTransaction.bind(db);
    Object.defineProperty(db, 'runTransaction', {
      configurable: true,
      value: async (callback: Parameters<typeof db.runTransaction>[0]) => {
        db._store.set('users/' + visitor, { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 2 });
        return originalTransaction(callback);
      },
    });
    const response = await recordPartnerClick(deps(db), token, { method: 'GET' }, visitor);
    expect(response).toEqual({ url: 'https://partner.example/offer', tracked: false });
    expect(db._store.get('partner_referrals/' + referralId)?.clickCount).toBe(0);
    expect(db._store.get('partner_campaigns/' + campaignId)?.clickCount).toBe(0);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
  });

  it('does not attribute clicks to visitors without a valid consent epoch', async () => {
    const owner = 'owner-click', visitor = 'visitor-click', campaignId = 'campaign-click';
    const token = derivePartnerReferralToken(owner, campaignId, 1, tokenSecret);
    const referralId = partnerReferralDocumentId(token);
    const db = makeFirestore([
      { collection: 'users', id: owner, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, status: 'active', brandVerified: true, clickCount: 0 } },
      { collection: 'partner_referrals', id: referralId, data: { ownerUid: owner, campaignId, status: 'active', version: 1, clickCount: 0 } },
      { collection: 'users', id: visitor, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
    ]);
    for (const invalidVersion of [undefined, null, 0, -1, '1', 1.5]) {
      db._store.set('users/' + visitor, { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: invalidVersion });
      const result = await recordPartnerClick(deps(db), token, { method: 'GET' }, visitor);
      expect(result.tracked).toBe(false);
      expect(result.url).toBe('https://partner.example/offer');
    }
    expect(db._store.get('partner_referrals/' + referralId)?.clickCount).toBe(0);
    expect(db._store.get('partner_campaigns/' + campaignId)?.clickCount).toBe(0);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
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

  it('does not invent consent epoch or audit on repeated withdrawal when already denied', async () => {
    for (const epoch of [undefined, null, 0, '1', 2]) {
      const db = makeFirestore([{ collection: 'users', id: 'uid-denied',
        data: { isAdult: true, partnerReferralConsent: false, partnerReferralVersion: epoch } }]);
      const initial = [...db._store.entries()];
      const expectedVersion = epoch === 2 ? 2 : null;
      await expect(setPartnerConsent(deps(db), 'uid-denied', false))
        .resolves.toEqual({ allowed: false, version: expectedVersion });
      await expect(setPartnerConsent(deps(db), 'uid-denied', false))
        .resolves.toEqual({ allowed: false, version: expectedVersion });
      expect([...db._store.entries()]).toEqual(initial);
      expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
    }
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
    expect(destination.searchParams.has('klar_referral')).toBe(false);
    expect(opened.url).not.toContain('/api/partner/click/');

    const referrals = [...db._store.entries()].filter(([key]) => key.startsWith('partner_referrals/'));
    expect(referrals).toHaveLength(0);
    expect(db._store.get('partner_campaigns/' + draft.id)?.clickCount).toBe(0);
    const ledger = [...db._store.entries()]
      .filter(([key]) => key.startsWith('partner_referral_ledger/'))
      .map(([, record]) => record);
    const openAudit = ledger.find(record => record.eventType === 'referral_open_link');
    expect(openAudit).toMatchObject({ tokenForwarded: false, referralId: null });
    expect(verifyHmacAuditPayload(openAudit!, auditSecret)).toBe(true);
  });

  it('opens an untracked destination without token or public-origin infrastructure', async () => {
    const db = makeFirestore([
      { collection: 'users', id: 'owner', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: 'campaign', data: { ...campaignInput, status: 'active', brandVerified: true, destinationUrl: 'https://partner.example/offer?lang=de' } },
    ]);
    await expect(openPartnerReferral({ ...deps(db), tokenSecret: () => { throw new Error('must not issue tokens'); }, publicUrl: () => undefined }, 'owner', 'campaign'))
      .resolves.toEqual({ url: 'https://partner.example/offer?lang=de' });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referrals/'))).toHaveLength(0);
  });

  it.each([
    { isAdult: false }, { partnerReferralConsent: false }, { partnerReferralEpochQuarantined: true },
    { partnerReferralVersion: 0 }, { partnerReferralVersion: '1' }, { partnerReferralVersion: undefined },
  ])('denies an owner open with invalid transactional authorization: %j', async patch => {
    const db = makeFirestore([
      { collection: 'users', id: 'owner', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1, ...patch } },
      { collection: 'partner_campaigns', id: 'campaign', data: { ...campaignInput, status: 'active', brandVerified: true } },
    ]);
    await expect(openPartnerReferral(deps(db), 'owner', 'campaign')).rejects.toBeDefined();
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
  });

  it('checks deletion and destination against the transactional snapshot', async () => {
    for (const mutation of ['deletion', 'destination', 'inactive', 'consent']) {
      const db = makeFirestore([
        { collection: 'users', id: 'owner', data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
        { collection: 'partner_campaigns', id: 'campaign', data: { ...campaignInput, status: 'active', brandVerified: true } },
      ]);
      const originalTransaction = db.runTransaction.bind(db);
      Object.defineProperty(db, 'runTransaction', {
        value: async (callback: Parameters<typeof db.runTransaction>[0]) => {
          if (mutation === 'deletion') db._seed('account_deletions', 'owner', {});
          if (mutation === 'destination') db._seed('partner_campaigns', 'campaign', { ...campaignInput, status: 'active', brandVerified: true, destinationUrl: 'https://partner.example/offer?klar_referral=legacy' });
          if (mutation === 'inactive') db._seed('partner_campaigns', 'campaign', { ...campaignInput, status: 'inactive', brandVerified: true });
          if (mutation === 'consent') db._seed('users', 'owner', { isAdult: true, partnerReferralConsent: false, partnerReferralVersion: 2 });
          return originalTransaction(callback);
        },
      });
      await expect(openPartnerReferral(deps(db), 'owner', 'campaign')).rejects.toBeDefined();
      expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
    }
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
    // Owner identity must never fall back to epoch 1 on a preexisting link.
    const originalOwnerEpoch = db._store.get('users/' + uid)!;
    for (const badEpoch of [undefined, null, 0, -1, '1', 1.5]) {
      db._store.set('users/' + uid, { ...originalOwnerEpoch, partnerReferralVersion: badEpoch });
      await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
        .rejects.toMatchObject({ code: 'conversion_not_eligible' });
    }
    db._store.set('users/' + uid, originalOwnerEpoch);
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
    // A provider signature cannot authorize tampered referral owner/campaign/epoch
    // data even when the document ID is based on a valid original token.
    const originalReferral = db._store.get('partner_referrals/' + referralId)!;
    for (const mutated of [
      { ownerUid: 'other-owner' }, { campaignId: 'other-campaign' },
      { version: 2 }, { version: undefined },
    ]) {
      db._store.set('partner_referrals/' + referralId, { ...originalReferral, ...mutated });
      await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
        .rejects.toMatchObject({ code: 'partner_link_not_found' });
    }
    db._store.set('partner_referrals/' + referralId, originalReferral);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_conversions/'))).toHaveLength(0);
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
    // The event and buyer claim have the same creation timestamp because
    // both were atomically created by the original transaction.
    for (const invalidCreatedAt of ['1999-01-01T00:00:00.000Z', null, 123, 'not-a-date']) {
      db._store.set(claimKey, { ...originalClaim, createdAt: invalidCreatedAt });
      await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
        .rejects.toMatchObject({ code: 'partner_claim_inconsistent' });
    }
    db._store.set(claimKey, originalClaim);
    expect(await recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
      .toEqual({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });
    // Event data is independently checked, not just its HMAC binding.
    const [eventKey, eventOriginal] = conversions[0]!;
    // Even matching event/claim timestamps cannot authenticate an invalid event time.
    for (const invalidEventTime of [null, 123, 'not-a-date', '2026-10-18', '2026-10-18T12:00:00Z', '2026-02-30T00:00:00.000Z']) {
      db._store.set(eventKey, { ...eventOriginal, createdAt: invalidEventTime });
      db._store.set(claimKey, { ...originalClaim, createdAt: invalidEventTime });
      await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough'))
        .rejects.toMatchObject({ code: 'partner_claim_inconsistent' });
    }
    db._store.set(eventKey, eventOriginal);
    db._store.set(claimKey, originalClaim);

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


    // Keep the alternate buyer eligible so this assertion reaches the event binding check.
    db._store.set('users/different-buyer', { ...originalBuyer });
    await expect(recordPartnerConversion(deps(db), slug, { ...payload, buyerUid: 'different-buyer' }, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'partner_event_id_conflict' });
    await expect(recordPartnerConversion(deps(db), slug, { ...payload, buyerUid: 'missing-buyer' }, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'conversion_not_eligible' });
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

  it.each([
    { scenario: 'buyer consent withdrawn', buyer: { isAdult: true, partnerReferralConsent: false, partnerReferralVersion: 1 }, owner: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }, campaignSlug: 'example-partner', expectCode: 'conversion_not_eligible' },
    { scenario: 'buyer is a minor', buyer: { isAdult: false, partnerReferralConsent: true, partnerReferralVersion: 1 }, owner: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }, campaignSlug: 'example-partner', expectCode: 'conversion_not_eligible' },
    { scenario: 'owner consent withdrawn', buyer: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }, owner: { isAdult: true, partnerReferralConsent: false, partnerReferralVersion: 1 }, campaignSlug: 'example-partner', expectCode: 'conversion_not_eligible' },
    { scenario: 'owner version revoked', buyer: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }, owner: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 2 }, campaignSlug: 'example-partner', expectCode: 'conversion_not_eligible' },
    { scenario: 'campaign slug altered', buyer: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }, owner: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }, campaignSlug: 'different-partner', expectCode: 'conversion_not_eligible' },
  ])('rejects an ineligible signed assertion: $scenario', async ({ buyer, owner, campaignSlug, expectCode }) => {
    const ownerUid = 'owner-adversarial';
    const buyerUid = 'buyer-adversarial';
    const campaignId = 'campaign-adversarial';
    const token = derivePartnerReferralToken(ownerUid, campaignId, 1, tokenSecret);
    const db = makeFirestore([
      { collection: 'users', id: ownerUid, data: owner },
      { collection: 'users', id: buyerUid, data: buyer },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, slug: campaignSlug, brandVerified: true, status: 'active', qualifiedConversions: 0 } },
      { collection: 'partner_referrals', id: partnerReferralDocumentId(token), data: { ownerUid, campaignId, campaignSlug: 'example-partner', version: 1, status: 'active', qualifiedConversions: 0 } },
    ]);
    await expect(recordPartnerConversion(deps(db), 'example-partner', {
      event: 'qualified_conversion', eventId: 'provider-claim-adversarial', referralToken: token, buyerUid,
    }, 'partner-provider-signing-secret-is-long-enough')).rejects.toMatchObject({ code: expectCode });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_conversions/'))).toHaveLength(0);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_buyer_claims/'))).toHaveLength(0);
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
  });

  it('rejects self-referral without persisting a conversion or buyer claim', async () => {
    const ownerUid = 'owner-self';
    const campaignId = 'campaign-self';
    const token = derivePartnerReferralToken(ownerUid, campaignId, 1, tokenSecret);
    const db = makeFirestore([
      { collection: 'partner_referrals', id: partnerReferralDocumentId(token), data: { ownerUid, campaignId, status: 'active', version: 1 } },
    ]);
    await expect(recordPartnerConversion(deps(db), 'example-partner', {
      event: 'qualified_conversion', eventId: 'provider-claim-self', referralToken: token, buyerUid: ownerUid,
    }, 'partner-provider-signing-secret-is-long-enough')).rejects.toMatchObject({ code: 'self_referral_rejected' });
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_conversions/'))).toHaveLength(0);
  });

  it('does not award credit for multiple partner-asserted events on the same buyer', async () => {
    const ownerUid = 'owner-repeat';
    const buyerUid = 'buyer-repeat';
    const campaignId = 'campaign-repeat';
    const slug = 'example-partner';
    const token = derivePartnerReferralToken(ownerUid, campaignId, 1, tokenSecret);
    const refId = partnerReferralDocumentId(token);
    const db = makeFirestore([
      { collection: 'users', id: ownerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'users', id: buyerUid, data: { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 } },
      { collection: 'partner_campaigns', id: campaignId, data: { ...campaignInput, slug, brandVerified: true, status: 'active', qualifiedConversions: 0 } },
      { collection: 'partner_referrals', id: refId, data: { ownerUid, campaignId, campaignSlug: 'example-partner', version: 1, status: 'active', qualifiedConversions: 0 } },
    ]);
    const payload = { event: 'qualified_conversion' as const, eventId: 'provider-repeat-0001', referralToken: token, buyerUid };
    await expect(recordPartnerConversion(deps(db), slug, payload, 'partner-provider-signing-secret-is-long-enough')).resolves.toMatchObject({ rewardStatus: 'pending_verification' });
    await expect(recordPartnerConversion(deps(db), slug, { ...payload, eventId: 'provider-repeat-0002' }, 'partner-provider-signing-secret-is-long-enough'))
      .rejects.toMatchObject({ code: 'duplicate_conversion' });
    expect(db._store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
    expect(db._store.get('partner_referrals/' + refId)?.qualifiedConversions).toBe(0);
    expect([...db._store.keys()].filter(key => key.startsWith('partner_referral_conversions/'))).toHaveLength(1);
  });



});
