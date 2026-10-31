// @vitest-environment node
// HTTP transport regression only: in-memory Firestore double is sequential,
// not a real emulator/transaction race or independent partner purchase proof.
import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Firestore } from 'firebase-admin/firestore';
import { createPartnerReferralPublicRouter } from '../src/server/routes/partnerReferrals';
import {
  derivePartnerReferralToken, partnerReferralDocumentId,
  partnerWebhookSignature, type PartnerConversionPayload,
} from '../src/server/partnerReferralCore';

type Row = Record<string, unknown>;
type Ref = { path: string; id: string };
const tokenKey = 'test-http-referral-token-key-with-32-characters';
const auditKey = 'test-http-referral-audit-key-with-32-characters';
const initialProviderKey = 'test-http-partner-provider-key-with-32-characters';
const rotatedProviderKey = 'test-http-partner-rotated-key-with-32-characters';
const campaignId = 'campaign';
const slug = 'partner';
const owner = 'owner';
const buyer = 'buyer';
const token = derivePartnerReferralToken(owner, campaignId, 1, tokenKey);
const validEvent: PartnerConversionPayload = {
  event: 'qualified_conversion', eventId: 'conversion-event-0001',
  referralToken: token, buyerUid: buyer,
};
const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

function fakeFirestore() {
  const store = new Map<string, Row>([
    ['users/' + owner, { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }],
    ['users/' + buyer, { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }],
    ['users/other-buyer', { isAdult: true, partnerReferralConsent: true, partnerReferralVersion: 1 }],
    ['partner_campaigns/' + campaignId, {
      slug, status: 'active', brandVerified: true, deletedAt: null,
      qualifiedConversions: 0, rewardLabel: 'Test-only nonpayable benefit',
    }],
    ['partner_referrals/' + partnerReferralDocumentId(token), {
      ownerUid: owner, campaignId, version: 1, status: 'active',
    }],
  ]);
  const ref = (collection: string, id: string): Ref => ({ path: collection + '/' + id, id });
  const snap = (r: Ref) => ({
    id: r.id, exists: store.has(r.path),
    data: () => store.has(r.path) ? structuredClone(store.get(r.path)) : undefined,
  });
  const write = (r: Ref, value: Row, merge: boolean) => {
    store.set(r.path, merge ? { ...(store.get(r.path) ?? {}), ...structuredClone(value) } : structuredClone(value));
  };
  const firestore = {
    collection: (name: string) => ({ doc: (id = crypto.randomUUID()) => ({
      ...ref(name, id), get: async () => snap(ref(name, id)),
    }) }),
    runTransaction: async <T>(callback: (transaction: {
      get: (r: Ref) => Promise<ReturnType<typeof snap>>;
      getAll: (...refs: Ref[]) => Promise<Array<ReturnType<typeof snap>>>;
      set: (r: Ref, value: Row) => void;
      create: (r: Ref, value: Row) => void;
      update: (r: Ref, value: Row) => void;
    }) => Promise<T>): Promise<T> => callback({
      get: async r => snap(r),
      getAll: async (...rs) => rs.map(snap),
      set: (r, row) => write(r, row, false),
      create: (r, row) => {
        if (store.has(r.path)) throw new Error('ALREADY_EXISTS');
        write(r, row, false);
      },
      update: (r, row) => {
        if (!store.has(r.path)) throw new Error('NOT_FOUND');
        write(r, row, true);
      },
    }),
  };
  return { firestore: firestore as unknown as Firestore, store };
}

async function serve() {
  const db = fakeFirestore();
  let currentProviderSecret = initialProviderKey;
  const app = express();
  app.use(express.json({ limit: '8kb' }));
  app.use('/api', createPartnerReferralPublicRouter({
    getFirestore: () => db.firestore,
    tokenSecret: () => tokenKey, auditSecret: () => auditKey,
    publicUrl: () => 'https://klar.example',
    webhookSecrets: () => ({ partner: currentProviderSecret, other: currentProviderSecret }),
    currentUserId: () => null,
  }));
  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  const send = async (
    value: PartnerConversionPayload = validEvent, options: {
      routeSlug?: string; timestamp?: string; secret?: string; signature?: string;
    } = {},
  ) => {
    const timestamp = options.timestamp ?? String(Math.floor(Date.now() / 1000));
    const signature = options.signature ?? partnerWebhookSignature(value, timestamp, options.secret ?? currentProviderSecret);
    const response = await fetch(origin + '/api/partner/webhook/' + (options.routeSlug ?? slug), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-klar-partner-timestamp': timestamp,
        'x-klar-partner-signature': signature,
      },
      body: JSON.stringify(value),
    });
    return { status: response.status, headers: response.headers, body: await response.json() as Record<string, unknown> };
  };
  const records = (collection: string) => [...db.store.entries()].filter(([path]) => path.startsWith(collection + '/'));
  return { send, records, store: db.store, rotateSecret: () => { currentProviderSecret = rotatedProviderKey; } };
}

describe('signed B2B partner webhook end-to-end HTTP envelope (#55)', () => {
  it('201 first assertion, 200 exact replay; no automatic reward or qualified conversion', async () => {
    const api = await serve();
    const first = await api.send();
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ ok: true, duplicate: false, rewardStatus: 'pending_verification' });
    expect(first.headers.get('cache-control')).toContain('no-store');
    expect(first.headers.get('referrer-policy')).toBe('no-referrer');
    const duplicate = await api.send();
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toMatchObject({ ok: true, duplicate: true, rewardStatus: 'already_recorded' });
    expect(api.records('partner_referral_conversions')).toHaveLength(1);
    expect(api.records('partner_referral_buyer_claims')).toHaveLength(1);
    const evidence = api.records('partner_referral_conversions')[0]?.[1];
    expect(evidence).toMatchObject({ rewardStatus: 'pending_verification', proofStatus: 'partner_assertion_only' });
    expect(api.store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
    expect(api.records('partner_referral_ledger')).toHaveLength(1);
    expect(JSON.stringify([...api.store.values()])).not.toContain(validEvent.eventId);
  });

  it('rejects a changed buyer on the same signed event ID with HTTP 409, without a new ledger item', async () => {
    const api = await serve();
    expect((await api.send()).status).toBe(201);
    const conflict = await api.send({ ...validEvent, buyerUid: 'other-buyer' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('partner_event_id_conflict');
    expect(api.records('partner_referral_conversions')).toHaveLength(1);
    expect(api.records('partner_referral_buyer_claims')).toHaveLength(1);
    expect(api.records('partner_referral_ledger')).toHaveLength(1);
  });

  it('rejects a mismatched campaign slug despite a valid HMAC', async () => {
    const api = await serve();
    const response = await api.send(validEvent, { routeSlug: 'other' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('conversion_not_eligible');
    expect(api.records('partner_referral_conversions')).toHaveLength(0);
  });

  it.each(['stale', 'future', 'bad-signature'] as const)(
    'returns 401 for %s provider proof and creates no conversion', async mode => {
      const api = await serve();
      const seconds = Math.floor(Date.now() / 1000);
      const response = await api.send(validEvent, {
        ...(mode === 'stale' ? { timestamp: String(seconds - 301) } : {}),
        ...(mode === 'future' ? { timestamp: String(seconds + 301) } : {}),
        ...(mode === 'bad-signature' ? { signature: 'sha256=' + '0'.repeat(64) } : {}),
      });
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('invalid_partner_signature');
      expect(api.records('partner_referral_conversions')).toHaveLength(0);
      expect(api.records('partner_referral_buyer_claims')).toHaveLength(0);
    },
  );

  it('does not reset event idempotency when a provider signing key rotates', async () => {
    const api = await serve();
    expect((await api.send()).status).toBe(201);
    api.rotateSecret();
    const retry = await api.send();
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ duplicate: true, rewardStatus: 'already_recorded' });
    expect(api.records('partner_referral_conversions')).toHaveLength(1);
    expect(api.records('partner_referral_buyer_claims')).toHaveLength(1);
  });

  it('treats ten sequential signed retries as one unpayable partner assertion', async () => {
    const api = await serve();
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await api.send()).status);
    expect(statuses).toEqual([201, ...Array(9).fill(200)]);
    expect(api.records('partner_referral_conversions')).toHaveLength(1);
    expect(api.records('partner_referral_buyer_claims')).toHaveLength(1);
    expect(api.records('partner_referral_ledger')).toHaveLength(1);
    expect(api.store.get('partner_campaigns/' + campaignId)?.qualifiedConversions).toBe(0);
  });
});
