// @vitest-environment node
import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import express from 'express';
import { createKycRouter, hasRecentAuthentication, KycError } from '../src/server/verification/diditKyc';
import { tenantRepositoryHarness } from './helpers/tenantRepositoryHarness';

describe('GET /api/kyc/status fallback behavior', () => {
  it('requires a recent interactive authentication for sensitive KYC start', () => {
    const now = 1_800_000_000_000;
    expect(hasRecentAuthentication(now / 1000 - 300, now)).toBe(true);
    expect(hasRecentAuthentication(now / 1000 - 301, now)).toBe(false);
    expect(hasRecentAuthentication('not-a-timestamp', now)).toBe(false);
  });
  it('rejects KYC start without recent authentication', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = { uid: 'test-user-123', auth_time: 1, firebase: { sign_in_provider: 'password' } };
      next();
    });
    app.use('/api/kyc', createKycRouter({
      repository: () => { throw new Error('DB should not be reached'); },
      config: () => { throw new Error('Config should not be reached'); },
    } as any));
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/kyc/start`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ consent: true, consentVersion: 'v1', language: 'de' }),
      });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'recent_login_required' });
    } finally { server.close(); }
  });

  it('returns status: unavailable with 200 OK when KYC service is disabled/unavailable', async () => {
    const limits = tenantRepositoryHarness({}, path => {
      if (!path.startsWith('tenants/default/api_rate_limits/')) throw new Error('KYC data must not be reached when disabled');
    });
    const deps = {
      repository: () => limits.repo,
      config: () => { throw new KycError(503, 'kyc_unavailable'); },
    };

    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { uid: 'test-user-123' };
      next();
    });
    app.use('/api/kyc', createKycRouter(deps as any));

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/kyc/status`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({
        status: 'unavailable',
        privacyUrl: '',
        consentVersion: '',
      });
    } finally {
      server.close();
    }
  });

  it('fails closed when the shared rate-limit store is unavailable', async () => {
    const app = express();
    app.use((req, _res, next) => { (req as any).user = {uid:'unavailable-store'}; next(); });
    app.use('/api/kyc',createKycRouter({repository:()=>{throw new Error('synthetic-private@example.test')},config:()=>{throw new KycError(503,'kyc_unavailable')}}));
    const server=createServer(app);await new Promise<void>(resolve=>server.listen(0,resolve));
    try{
      const response=await fetch('http://127.0.0.1:'+(server.address() as any).port+'/api/kyc/status');
      expect(response.status).toBe(503);expect(await response.text()).not.toContain('synthetic-private');
    }finally{server.close();}
  });
});
