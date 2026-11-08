// @vitest-environment node
import { createHmac } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createComplianceJobsRouter } from '../src/server/complianceJobs';
import { createKycReconciliationRouter } from '../src/server/verification/diditKyc';
const servers: ReturnType<ReturnType<typeof express>['listen']>[] = [];
afterEach(async () => { vi.unstubAllEnvs(); await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
describe('signed maintenance envelope tenant authority', () => {
  it.each(['compliance', 'kyc'] as const)('rejects a foreign or missing tenant before opening %s storage', async domain => {
    const secret = 'wave2-synthetic-signature-secret-at-least-32';
    vi.stubEnv('COMPLIANCE_JOB_SECRET', secret);
    const repository = vi.fn(() => { throw new Error('must not open storage'); });
    const app = express();
    app.use('/job', domain === 'compliance' ? createComplianceJobsRouter(repository) : createKycReconciliationRouter({ repository, config: () => ({apiKey: 'synthetic', webhookSecret: secret, workflowId: '00000000-0000-4000-8000-000000000001', applicationId: '00000000-0000-4000-8000-000000000002', environment: 'sandbox', callback: 'https://app.example/kyc', privacyUrl: 'https://app.example/privacy', privacyVersion: 'synthetic'}) }, secret));
    const server = app.listen(0, '127.0.0.1'); servers.push(server);
    await new Promise<void>(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/job/${domain === 'compliance' ? 'drain' : 'reconcile'}`;
    for (const tenantId of ['foreign', undefined]) {
      const body = JSON.stringify({ timestamp: Date.now(), tenantId });
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Klar-Job-Signature': createHmac('sha256', secret).update(body).digest('hex') }, body });
      expect(response.status).toBe(403);
    }
    expect(repository).not.toHaveBeenCalled();
    const body = JSON.stringify({ timestamp: Date.now(), tenantId: 'default' });
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'X-Klar-Job-Signature': createHmac('sha256', secret).update(body).digest('hex') }, body });
    expect(response.status).toBe(503);
    expect(repository).toHaveBeenCalledOnce();
  });
});
