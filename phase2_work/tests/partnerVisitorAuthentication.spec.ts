// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Request } from 'express';
import type { AddressInfo } from 'node:net';
import type { Firestore } from 'firebase-admin/firestore';
import { createPartnerReferralPublicRouter } from '../src/server/routes/partnerReferrals';
import { derivePartnerReferralToken, partnerReferralDocumentId } from '../src/server/partnerReferralCore';

const auth = vi.hoisted(() => ({ verify: vi.fn(), getAuth: vi.fn() }));
vi.mock('firebase-admin/auth', () => ({ getAuth: auth.getAuth }));
vi.mock('../src/server/db', () => ({
  getServerFirebaseApp: () => ({}),
  getDb: () => { throw new Error('Test must supply its own Firestore'); },
  FieldValue: { increment: (amount: number) => ({ incrementBy: amount }) },
}));

type Row = Record<string, unknown>;
type Ref = { id: string; path: string };
const secret = 'partner-token-secret-at-least-thirty-two-characters';
const token = derivePartnerReferralToken('owner', 'campaign', 1, secret);
const destination = 'https://partner.example/offer';
const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];

function database(consent = true) {
  const store = new Map<string, Row>([
    ['users/owner', { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }],
    ['users/visitor', { isAdult: true, partnerReferralConsent: consent, partnerReferralVersion: 1 }],
    ['partner_campaigns/campaign', { name: 'Partner', slug: 'partner', destinationUrl: destination, rewardLabel: 'Benefit', termsSummary: 'Partner terms apply.', status: 'active', brandVerified: true, clickCount: 0 }],
    ['partner_referrals/' + partnerReferralDocumentId(token), { ownerUid: 'owner', campaignId: 'campaign', version: 1, status: 'active', clickCount: 0 }],
  ]);
  const snapshot = (ref: Ref) => ({ id: ref.id, exists: store.has(ref.path), data: () => store.get(ref.path) });
  const write = (ref: Ref, data: Row, merge = false) => {
    const previous = store.get(ref.path) ?? {};
    const values = Object.fromEntries(Object.entries(data).map(([key, value]) => [key,
      value && typeof value === 'object' && 'incrementBy' in value
        ? Number(previous[key] ?? 0) + Number(value.incrementBy) : value]));
    store.set(ref.path, merge ? { ...previous, ...values } : values);
  };
  const db = {
    collection: (name: string) => ({ doc: (id: string) => {
      const ref = { id, path: name + '/' + id };
      return { ...ref, get: async () => snapshot(ref) };
    } }),
    runTransaction: async (fn: (tx: {
      get: (ref: Ref) => Promise<ReturnType<typeof snapshot>>;
      getAll: (...refs: Ref[]) => Promise<Array<ReturnType<typeof snapshot>>>;
      set: (ref: Ref, data: Row) => void;
      update: (ref: Ref, data: Row) => void;
      create: (ref: Ref, data: Row) => void;
    }) => unknown) => fn({
      get: async ref => snapshot(ref),
      getAll: async (...refs) => refs.map(snapshot),
      set: (ref, data) => write(ref, data),
      update: (ref, data) => write(ref, data, true),
      create: (ref, data) => { if (store.has(ref.path)) throw new Error('Already exists'); write(ref, data); },
    }),
  };
  return { firestore: db as unknown as Firestore, store };
}

async function request(options: { header?: string; user?: Row; consent?: boolean; pathToken?: string } = {}) {
  const db = database(options.consent);
  const app = express();
  if (options.user) app.use((req, _res, next) => {
    req.user = options.user as Request['user']; next();
  });
  app.use('/api', createPartnerReferralPublicRouter({
    currentUserId: () => null, getFirestore: () => db.firestore,
    tokenSecret: () => secret, auditSecret: () => 'partner-audit-secret-at-least-thirty-two-characters',
    publicUrl: () => 'https://klar.example', webhookSecrets: () => ({}),
  }));
  const server = app.listen(0, '127.0.0.1'); servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const response = await fetch('http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/partner/click/' + (options.pathToken ?? token), {
    redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0', ...(options.header ? { authorization: options.header } : {}) },
  });
  return { response, store: db.store };
}

function untracked(result: Awaited<ReturnType<typeof request>>) {
  expect(result.response.status).toBe(302);
  expect(result.response.headers.get('location')).toBe(destination);
  expect(result.response.headers.get('cache-control')).toContain('no-store');
  expect(result.response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(result.store.get('partner_campaigns/campaign')?.clickCount).toBe(0);
  expect([...result.store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(0);
}

beforeEach(() => {
  auth.verify.mockReset(); auth.getAuth.mockReset();
  auth.getAuth.mockReturnValue({ verifyIdToken: auth.verify });
  auth.verify.mockResolvedValue({ uid: 'visitor', firebase: { sign_in_provider: 'password' } });
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe('public partner visitor authentication over HTTP', () => {
  it.each([undefined, 'Basic token', 'Bearer', 'Bearer two tokens'])('never attributes missing or malformed authorization %s, even with req.user', async header => {
    untracked(await request({ header, user: { uid: 'visitor' } }));
    expect(auth.getAuth).not.toHaveBeenCalled();
  });
  it.each(['auth/id-token-revoked', 'auth/user-disabled', 'auth/argument-error', 'auth/internal-error'])('does not forward referral tokens when Firebase rejects with %s', async code => {
    auth.verify.mockRejectedValueOnce(Object.assign(new Error(code), { code }));
    untracked(await request({ header: 'Bearer rejected-token', user: { uid: 'visitor' } }));
    expect(auth.verify).toHaveBeenCalledWith('rejected-token', true);
  });
  it('fails closed on synchronous Firebase initialization failure', async () => {
    auth.getAuth.mockImplementationOnce(() => { throw new Error('Firebase unavailable'); });
    untracked(await request({ header: 'Bearer token' }));
  });
  it.each([
    { uid: 'visitor', firebase: { sign_in_provider: 'anonymous' } },
    { uid: 'visitor' },
    { uid: '', firebase: { sign_in_provider: 'password' } },
  ])('does not attribute an ineligible verified identity %j', async decoded => {
    auth.verify.mockResolvedValueOnce(decoded);
    untracked(await request({ header: 'Bearer verified-token' }));
  });
  it('denies prepopulated anonymous claims even with a separate bearer', async () => {
    untracked(await request({ header: 'Bearer token', user: { uid: 'visitor', firebase: { sign_in_provider: 'anonymous' } } }));
    expect(auth.getAuth).not.toHaveBeenCalled();
  });
  it('uses only the revocation-checked bearer identity, ignoring a conflicting req.user', async () => {
    const result = await request({ header: 'Bearer valid-token', user: { uid: 'owner' } });
    expect(auth.verify).toHaveBeenCalledWith('valid-token', true);
    expect(result.response.status).toBe(302);
    expect(new URL(result.response.headers.get('location')!).searchParams.get('klar_referral')).toBe(token);
    expect(result.store.get('partner_campaigns/campaign')?.clickCount).toBe(1);
    expect([...result.store.keys()].filter(key => key.startsWith('partner_referral_ledger/'))).toHaveLength(1);
  });
  it('still requires independent visitor consent after token verification', async () => {
    untracked(await request({ header: 'Bearer valid-token', consent: false }));
    expect(auth.verify).toHaveBeenCalledWith('valid-token', true);
  });
  it('retains malformed-link rejection before authentication or tracking', async () => {
    const result = await request({ header: 'Bearer valid-token', pathToken: 'malformed' });
    expect(result.response.status).toBe(404);
    expect(auth.getAuth).not.toHaveBeenCalled();
  });
});
