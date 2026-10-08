// @vitest-environment node
import { createHmac, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../src/server/db';
import { canonicalDiditJson, processDiditWebhook, startDiditSession, type DiditConfig } from '../src/server/verification/diditKyc';

const config: DiditConfig = { apiKey: 'test-secret', webhookSecret: 'test-only-webhook-secret-with-32-characters',
  workflowId: randomUUID(), applicationId: randomUUID(), environment: 'sandbox', callback: 'https://app.example/verifizierung', privacyUrl: 'https://app.example/privacy/kyc', privacyVersion: 'test-v1' };
const paths = new Set<string>(); const now = 1_800_000_000_000;
const deps = { db: getDb, config: () => config, now: () => now };
function document(path: string) { paths.add(path); return getDb().doc(path); }
async function setup() {
  const uid = 'kyc-' + randomUUID(); const sessionId = randomUUID();
  await document(`users/${uid}`).set({ isAdult: true, isVerified: false });
  await document(`public_profiles/${uid}`).set({ isVerified: false });
  await document(`kyc_accounts/${uid}`).set({ sessionId, status: 'pending' });
  await document(`kyc_sessions/${sessionId}`).set({ uid, workflowVersion: 1 });
  return { uid, sessionId };
}
function eventFor(uid: string, sessionId: string) {
  const event = { event_id: randomUUID(), webhook_type: 'status.updated', timestamp: now / 1000,
    created_at: now / 1000 - 10, application_id: config.applicationId, environment: 'sandbox',
    workflow_id: config.workflowId, workflow_version: 1, vendor_data: uid, session_id: sessionId, status: 'Approved',
    decision: { session_id: sessionId, status: 'Approved', id_verifications: [{ node_id: 'id', status: 'Approved', full_name: 'Must not be stored' }],
      liveness_checks: [{ node_id: 'liveness', status: 'Approved' }], face_matches: [{ node_id: 'face', status: 'Approved' }] } };
  document(`kyc_events/${event.event_id}`); return event;
}
function send(event: ReturnType<typeof eventFor>) {
  const signature = createHmac('sha256', config.webhookSecret).update(canonicalDiditJson(event)).digest('hex');
  return processDiditWebhook(deps, event, signature, String(event.timestamp));
}
afterEach(async () => { vi.restoreAllMocks(); for (const path of paths) await getDb().doc(path).delete(); paths.clear(); });
describe('Didit sessions and signed decisions in Firestore', { timeout: 20_000 }, () => {
  it('atomically applies duplicate approved deliveries once without retaining identity payloads', async () => {
    const { uid, sessionId } = await setup(); const event = eventFor(uid, sessionId);
    const results = await Promise.all([send(event), send(event)]);
    expect(results.filter(result => result.duplicate)).toHaveLength(1);
    expect((await getDb().doc(`users/${uid}`).get()).data()?.isVerified).toBe(true);
    expect((await getDb().doc(`public_profiles/${uid}`).get()).data()?.isVerified).toBe(true);
    for (const path of paths) expect(JSON.stringify((await getDb().doc(path).get()).data())).not.toContain('Must not be stored');
  });
  it('never verifies incomplete feature results, wrong environment or another account', async () => {
    const { uid, sessionId } = await setup(); const event = eventFor(uid, sessionId);
    event.decision.face_matches = [];
    await expect(send(event)).rejects.toThrow('incomplete_approval');
    expect((await getDb().doc(`users/${uid}`).get()).data()?.isVerified).toBe(false);
    const wrong = eventFor(uid, sessionId); wrong.environment = 'live';
    await expect(send(wrong)).rejects.toThrow('invalid_context');
    const other = eventFor('other-user', sessionId);
    await expect(send(other)).rejects.toThrow('session_mismatch');
  });
  it('prevents stale decisions and late webhooks from restoring deleted identities', async () => {
    const { uid, sessionId } = await setup(); const approval = eventFor(uid, sessionId); await send(approval);
    const decline = eventFor(uid, sessionId); decline.status = 'Declined'; decline.created_at++;
    await expect(send(decline)).rejects.toThrow('invalid_kyc_transition');
    const stale = eventFor(uid, sessionId); await send(stale);
    expect((await getDb().doc(`users/${uid}`).get()).data()?.isVerified).toBe(true);
    await document(`account_deletions/${uid}`).set({ status: 'pending' });
    const late = eventFor(uid, sessionId); late.created_at += 2;
    expect(await send(late)).toMatchObject({ applied: false });
  });
  it('keeps persistence failures retryable and cannot acknowledge unknown sessions', async () => {
    const { uid, sessionId } = await setup(); const event = eventFor(uid, sessionId);
    const failure = vi.spyOn(getDb(), 'runTransaction').mockRejectedValueOnce(new Error('database unavailable'));
    await expect(send(event)).rejects.toThrow('database unavailable'); failure.mockRestore();
    expect(await send(event)).toMatchObject({ applied: true });
    await expect(send(eventFor(uid, randomUUID()))).rejects.toThrow('session_pending');
  });
  it('binds provider session creation to the server UID and enforces a distributed daily cost cap', async () => {
    const { uid, sessionId } = await setup();
    const call = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ session_id: sessionId,
      workflow_id: config.workflowId, workflow_version: 1, vendor_data: uid, url: 'https://verify.didit.me/session/test-token' }), { status: 201 }));
    for (let n = 0; n < 3; n++) await startDiditSession({ ...deps, fetch: call }, uid, 'en');
    await expect(startDiditSession({ ...deps, fetch: call }, uid, 'en')).rejects.toThrow('kyc_daily_limit');
    expect(call).toHaveBeenCalledTimes(3);
    expect(JSON.parse(call.mock.calls[0]![1].body)).toMatchObject({ vendor_data: uid, language: 'en', workflow_id: config.workflowId });
    expect(call.mock.calls[0]![0]).toBe('https://verification.didit.me/v3/session/');
  });
});
