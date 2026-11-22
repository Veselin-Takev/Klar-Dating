import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTenantRouteGuardAdapter,
  type TenantRouteGuardDependencies,
  type TenantRouteGuardRequest,
} from '../src/server/multitenant/tenantRouteGuardAdapter';
import type { TenantContextDependencies } from '../src/server/multitenant/tenantContext';
import type { TenantResourceAuthorizationPolicy, TenantScopedStore } from '../src/server/multitenant/tenantRepository';

const authHeader = 'Bearer synthetic-valid-token';

function makeHarness(options: {
  enabled?: unknown;
  identity?: Record<string, unknown>;
  tokenError?: Error;
  tenant?: unknown;
  membership?: unknown;
  evidence?: unknown;
  policyError?: Error;
  hostHint?: string | null;
} = {}) {
  const counters = { verify: 0, tenant: 0, membership: 0, policy: 0, reads: 0, writes: 0 };
  const identity = options.identity ?? { uid: 'owner-a', tenantId: 'tenant-a', roles: ['user'] };
  const tenantId = identity.tenantId;
  const uid = identity.uid;
  const tenantContext: TenantContextDependencies = {
    verifyIdToken: vi.fn(async (_token: string, checkRevoked: true) => {
      counters.verify += 1;
      expect(checkRevoked).toBe(true);
      if (options.tokenError) throw options.tokenError;
      return identity;
    }),
    readTenant: vi.fn(async () => {
      counters.tenant += 1;
      return options.tenant === undefined ? { tenantId, active: true } : options.tenant;
    }),
    readMembership: vi.fn(async () => {
      counters.membership += 1;
      return options.membership === undefined
        ? { tenantId, uid, active: true, roles: Array.isArray(identity.roles) ? identity.roles : ['user'] }
        : options.membership;
    }),
    resolveHostTenantHint: vi.fn(() => options.hostHint ?? null),
  };
  const store: TenantScopedStore = {
    read: vi.fn(async (path: string) => {
      counters.reads += 1;
      return { path, synthetic: true };
    }),
    create: vi.fn(async () => { counters.writes += 1; }),
    update: vi.fn(async () => { counters.writes += 1; }),
    delete: vi.fn(async () => { counters.writes += 1; }),
  };
  const authorizationPolicy: TenantResourceAuthorizationPolicy = {
    resolve: vi.fn(async request => {
      counters.policy += 1;
      if (options.policyError) throw options.policyError;
      return options.evidence ?? {
        verified: true,
        tenantId: request.tenantId,
        resourcePath: request.resourcePath,
        ownerUid: 'owner-a',
        participantUids: ['owner-a', 'participant-b'],
      };
    }),
  };
  const dependencies: TenantRouteGuardDependencies = { tenantContext, store, authorizationPolicy };
  const adapter = createTenantRouteGuardAdapter(
    Object.prototype.hasOwnProperty.call(options, 'enabled') ? { enabled: options.enabled } : { enabled: true },
    dependencies,
  );
  const request = (overrides: Partial<TenantRouteGuardRequest> = {}): TenantRouteGuardRequest => ({
    authorizationHeader: authHeader,
    operation: 'read' as const,
    resourcePath: 'chats/chat-a',
    ...overrides,
  });
  return { adapter, dependencies, counters, request };
}

function expectNoAuthorityOrStoreCalls(h: ReturnType<typeof makeHarness>) {
  expect(h.counters.policy).toBe(0);
  expect(h.counters.reads).toBe(0);
  expect(h.counters.writes).toBe(0);
}

describe('isolated default-off tenant route guard adapter', () => {
  it.each([undefined, false, null, 0, 'true', {}, []])(
    'denies before resolver, policy or store when server flag is %s',
    async enabled => {
      const h = makeHarness({ enabled });
      const result = await h.adapter.execute(h.request());
      expect(result).toEqual({ ok: false, status: 503, code: 'tenant_route_guard_disabled' });
      expect(h.counters.verify).toBe(0);
      expect(h.counters.tenant).toBe(0);
      expect(h.counters.membership).toBe(0);
      expectNoAuthorityOrStoreCalls(h);
    },
  );

  it('denies when the entire server config is missing', async () => {
    const h = makeHarness();
    const disabled = createTenantRouteGuardAdapter(undefined, h.dependencies);
    await expect(disabled.execute(h.request())).resolves.toMatchObject({
      ok: false, status: 503, code: 'tenant_route_guard_disabled',
    });
    expect(h.counters.verify).toBe(0);
    expect(h.counters.tenant).toBe(0);
    expect(h.counters.membership).toBe(0);
    expectNoAuthorityOrStoreCalls(h);
  });

  it('requires a Bearer token and returns 401 without verifying a missing token', async () => {
    const h = makeHarness();
    const result = await h.adapter.execute(h.request({ authorizationHeader: undefined }));
    expect(result).toMatchObject({ ok: false, status: 401, code: 'tenant_authentication_required' });
    expect(h.counters.verify).toBe(0);
    expect(h.counters.tenant).toBe(0);
    expectNoAuthorityOrStoreCalls(h);
  });

  it.each(['invalid signature', 'revoked token'])(
    'returns 401 for invalid or revoked token: %s',
    async message => {
      const h = makeHarness({ tokenError: new Error(message) });
      const result = await h.adapter.execute(h.request());
      expect(result).toMatchObject({ ok: false, status: 401, code: 'tenant_authentication_failed' });
      expect(h.dependencies.tenantContext.verifyIdToken).toHaveBeenCalledWith(
        'synthetic-valid-token',
        true,
      );
      expect(h.counters.tenant).toBe(0);
      expectNoAuthorityOrStoreCalls(h);
    },
  );

  it('returns 403 when the signed tenant claim is missing', async () => {
    const h = makeHarness({ identity: { uid: 'owner-a', roles: ['user'] } });
    await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_context_denied', reason: 'tenant_claims_invalid',
    });
    expectNoAuthorityOrStoreCalls(h);
  });

  it('returns 403 for an X-Tenant-ID mismatch before membership reads', async () => {
    const h = makeHarness();
    const headerMismatch = await h.adapter.execute(h.request({ xTenantId: 'tenant-b' }));
    expect(headerMismatch).toMatchObject({ ok: false, status: 403, code: 'tenant_context_denied' });
    expect(h.counters.tenant).toBe(0);
    expect(h.counters.membership).toBe(0);
    expectNoAuthorityOrStoreCalls(h);
  });

  it('returns 403 for a host/subdomain mismatch before membership reads', async () => {
    const h = makeHarness({ hostHint: 'tenant-b' });
    const result = await h.adapter.execute(h.request({ host: 'tenant-b.example.test' }));
    expect(result).toMatchObject({ ok: false, status: 403, code: 'tenant_context_denied' });
    expect(h.counters.tenant).toBe(0);
    expect(h.counters.membership).toBe(0);
    expectNoAuthorityOrStoreCalls(h);
  });

  it('returns 403 for inactive or contradictory membership', async () => {
    const inactive = makeHarness({
      membership: { tenantId: 'tenant-a', uid: 'owner-a', active: false, roles: ['user'] },
    });
    const contradictory = makeHarness({
      membership: { tenantId: 'tenant-b', uid: 'owner-a', active: true, roles: ['user'] },
    });
    for (const h of [inactive, contradictory]) {
      await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
        ok: false, status: 403, code: 'tenant_context_denied',
      });
      expectNoAuthorityOrStoreCalls(h);
    }
  });

  it('denies cross-tenant BOLA before any store read or write', async () => {
    const h = makeHarness({ identity: { uid: 'attacker', tenantId: 'tenant-b', roles: ['user'] } });
    await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_resource_denied',
    });
    expect(h.counters.policy).toBe(1);
    expect(h.counters.reads).toBe(0);
    expect(h.counters.writes).toBe(0);
  });

  it('denies same-tenant IDOR before any store read or write', async () => {
    const h = makeHarness({ identity: { uid: 'intruder', tenantId: 'tenant-a', roles: ['user'] } });
    await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_resource_denied',
    });
    expect(h.counters.reads).toBe(0);
    expect(h.counters.writes).toBe(0);
  });

  it('fails closed for missing, contradictory or incomplete owner/participant evidence', async () => {
    const invalidEvidence = [
      null,
      { verified: true, tenantId: 'tenant-a', resourcePath: 'tenants/tenant-a/chats/chat-a', participantUids: ['owner-a'] },
      { verified: true, tenantId: 'tenant-b', resourcePath: 'tenants/tenant-a/chats/chat-a', ownerUid: 'owner-a', participantUids: ['owner-a'] },
      { verified: true, tenantId: 'tenant-a', resourcePath: 'tenants/tenant-a/chats/chat-a', ownerUid: 'owner-a', participantUids: [] },
      { verified: true, tenantId: 'tenant-a', resourcePath: 'tenants/tenant-a/chats/chat-a', ownerUid: 'owner-a', participantUids: ['participant-b'] },
    ];
    for (const evidence of invalidEvidence) {
      const h = makeHarness({ evidence });
      await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
        ok: false, status: 403, code: 'tenant_resource_denied',
      });
      expect(h.counters.reads).toBe(0);
      expect(h.counters.writes).toBe(0);
    }
  });

  it('fails closed when the server-side authorization policy throws', async () => {
    const h = makeHarness({ policyError: new Error('synthetic authority failure') });
    await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
      ok: false, status: 503, code: 'tenant_resource_authority_unavailable',
    });
    expect(h.counters.reads).toBe(0);
    expect(h.counters.writes).toBe(0);
  });

  it('does not allow admin or super_admin to bypass resource boundaries', async () => {
    for (const role of ['admin', 'super_admin']) {
      const h = makeHarness({
        identity: { uid: 'privileged', tenantId: 'tenant-a', roles: [role] },
        membership: { tenantId: 'tenant-a', uid: 'privileged', active: true, roles: [role] },
      });
      await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
        ok: false, status: 403, code: 'tenant_resource_denied',
      });
      expect(h.counters.reads).toBe(0);
      expect(h.counters.writes).toBe(0);
    }
  });

  it('allows a verified participant to read but never mutate a chat', async () => {
    const h = makeHarness({ identity: { uid: 'participant-b', tenantId: 'tenant-a', roles: ['user'] } });
    await expect(h.adapter.execute(h.request())).resolves.toMatchObject({
      ok: true, status: 200, path: 'tenants/tenant-a/chats/chat-a',
    });
    await expect(h.adapter.execute(h.request({
      operation: 'update',
      patch: { message: 'synthetic payload' },
    }))).resolves.toMatchObject({ ok: false, status: 403, code: 'tenant_resource_denied' });
    expect(h.counters.reads).toBe(1);
    expect(h.counters.writes).toBe(0);
  });

  it('allows an owner mutation only through the canonical tenant path', async () => {
    const h = makeHarness();
    await expect(h.adapter.execute(h.request({
      operation: 'update',
      patch: { displayName: 'synthetic' },
    }))).resolves.toMatchObject({
      ok: true, status: 200, path: 'tenants/tenant-a/chats/chat-a',
    });
    expect(h.dependencies.store.update).toHaveBeenCalledWith(
      'tenants/tenant-a/chats/chat-a',
      { displayName: 'synthetic' },
    );
  });

  it('never supplies request body or client-supplied owner fields to authorization policy', async () => {
    const h = makeHarness();
    const request = h.request({
      operation: 'create',
      resourcePath: 'profiles/profile-a',
      value: {
        ownerUid: 'attacker',
        participantUids: ['attacker'],
        tenantId: 'tenant-b',
      },
    });
    await h.adapter.execute(request);
    expect(h.dependencies.authorizationPolicy.resolve).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      uid: 'owner-a',
      resourcePath: 'tenants/tenant-a/profiles/profile-a',
    }));
    expect(h.dependencies.authorizationPolicy.resolve).not.toHaveBeenCalledWith(expect.objectContaining({
      ownerUid: 'attacker',
      participantUids: ['attacker'],
    }));
  });
});
