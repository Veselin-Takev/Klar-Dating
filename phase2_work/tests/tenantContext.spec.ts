import { describe, expect, it, vi } from 'vitest';
import {
  createFirebaseAdminTenantContextDependencies,
  createSubdomainTenantHintResolver,
  createTenantContextResolver,
  isTenantContext,
  isTenantContextForTenant,
  type TenantContextDependencies,
  type VerifiedFirebaseIdentity,
} from '../src/server/multitenant/tenantContext';

type HarnessOptions = {
  identity?: VerifiedFirebaseIdentity;
  tokenError?: Error;
  tenant?: unknown | null;
  membership?: unknown | null;
  hostMap?: Record<string, string>;
};

function makeHarness(options: HarnessOptions = {}) {
  const identity: VerifiedFirebaseIdentity = options.identity ?? {
    uid: 'user-a',
    tenantId: 'tenant-a',
    roles: ['user', 'admin'],
  };
  const tenant = options.tenant === undefined
    ? { tenantId: 'tenant-a', active: true }
    : options.tenant;
  const membership = options.membership === undefined
    ? { tenantId: 'tenant-a', uid: 'user-a', active: true, roles: ['user'] }
    : options.membership;

  const dependencies: TenantContextDependencies = {
    verifyIdToken: vi.fn(async (_token: string, checkRevoked: true) => {
      expect(checkRevoked).toBe(true);
      if (options.tokenError) throw options.tokenError;
      return identity;
    }),
    readTenant: vi.fn(async () => tenant),
    readMembership: vi.fn(async () => membership),
    resolveHostTenantHint: vi.fn((host: string) => options.hostMap?.[host] ?? null),
  };

  return {
    dependencies,
    resolve: createTenantContextResolver(dependencies),
  };
}

const authorizationHeader = 'Bearer valid-firebase-id-token';

describe('isolated tenant context boundary', () => {
  it('returns 401 for a missing bearer token without reading tenant data', async () => {
    const harness = makeHarness();
    const result = await harness.resolve({});
    expect(result).toMatchObject({ ok: false, status: 401, code: 'tenant_authentication_required' });
    expect(harness.dependencies.verifyIdToken).not.toHaveBeenCalled();
    expect(harness.dependencies.readTenant).not.toHaveBeenCalled();
    expect(harness.dependencies.readMembership).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', async () => {
    const harness = makeHarness({ tokenError: new Error('invalid signature') });
    await expect(harness.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 401, code: 'tenant_authentication_failed',
    });
  });

  it('returns 401 for a revoked token', async () => {
    const harness = makeHarness({ tokenError: new Error('revoked ID token') });
    await expect(harness.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 401, code: 'tenant_authentication_failed',
    });
    expect(harness.dependencies.verifyIdToken).toHaveBeenCalledWith(
      'valid-firebase-id-token',
      true,
    );
  });

  it('returns 403 when the signed tenantId claim is missing', async () => {
    const harness = makeHarness({
      identity: { uid: 'user-a', roles: ['user'] },
    });
    await expect(harness.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_claims_invalid',
    });
  });

  it('returns 403 when tenant or role claims are malformed', async () => {
    const malformedTenant = makeHarness({
      identity: { uid: 'user-a', tenantId: '../tenant-a', roles: ['user'] },
    });
    const malformedRoles = makeHarness({
      identity: { uid: 'user-a', tenantId: 'tenant-a', roles: 'admin' },
    });
    await expect(malformedTenant.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_claims_invalid',
    });
    await expect(malformedRoles.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_claims_invalid',
    });
  });

  it('returns 403 when X-Tenant-ID attempts to select another tenant', async () => {
    const harness = makeHarness();
    await expect(harness.resolve({
      authorizationHeader,
      xTenantId: 'tenant-b',
    })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_routing_hint_mismatch',
    });
    expect(harness.dependencies.readTenant).not.toHaveBeenCalled();
    expect(harness.dependencies.readMembership).not.toHaveBeenCalled();
  });

  it('returns 403 when the FQDN/subdomain routing hint names another tenant', async () => {
    const harness = makeHarness({ hostMap: { 'tenant-b.example.test': 'tenant-b' } });
    await expect(harness.resolve({
      authorizationHeader,
      host: 'tenant-b.example.test',
    })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_routing_hint_mismatch',
    });
  });

  it('supports a strict single-level subdomain hint without granting authority', () => {
    const resolveHint = createSubdomainTenantHintResolver('example.test');
    expect(resolveHint('tenant-a.example.test')).toBe('tenant-a');
    expect(resolveHint('tenant-a.example.test:443')).toBe('tenant-a');
    expect(resolveHint('other.test')).toBeNull();
    expect(() => resolveHint('nested.tenant-a.example.test')).toThrow('Invalid tenant subdomain');
    expect(() => resolveHint('tenant a.example.test')).toThrow('Invalid Host header');
  });

  it('returns 403 for malformed hosts claiming the configured tenant namespace', async () => {
    const harness = makeHarness();
    const resolve = createTenantContextResolver({
      ...harness.dependencies,
      resolveHostTenantHint: createSubdomainTenantHintResolver('example.test'),
    });
    await expect(resolve({
      authorizationHeader,
      host: 'nested.tenant-a.example.test',
    })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_routing_hint_mismatch',
    });
  });

  it('returns 403 when the tenant document is missing or inactive', async () => {
    const missing = makeHarness({ tenant: null });
    const inactive = makeHarness({ tenant: { tenantId: 'tenant-a', active: false } });
    await expect(missing.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_not_active',
    });
    await expect(inactive.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_not_active',
    });
  });

  it('returns 403 when membership is missing, inactive or inconsistent', async () => {
    const missing = makeHarness({ membership: null });
    const inactive = makeHarness({
      membership: { tenantId: 'tenant-a', uid: 'user-a', active: false, roles: ['user'] },
    });
    const wrongTenant = makeHarness({
      membership: { tenantId: 'tenant-b', uid: 'user-a', active: true, roles: ['user'] },
    });
    const wrongUid = makeHarness({
      membership: { tenantId: 'tenant-a', uid: 'user-b', active: true, roles: ['user'] },
    });
    for (const harness of [missing, inactive, wrongTenant, wrongUid]) {
      await expect(harness.resolve({ authorizationHeader })).resolves.toMatchObject({
        ok: false, status: 403, code: 'tenant_membership_not_active',
      });
    }
  });

  it('returns 403 when the server-side tenant record is inconsistent', async () => {
    const harness = makeHarness({
      tenant: { tenantId: 'tenant-b', active: true },
    });
    await expect(harness.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_not_active',
    });
  });

  it('intersects signed role claims with active membership and discards stale privilege', async () => {
    const harness = makeHarness({
      identity: {
        uid: 'user-a',
        tenantId: 'tenant-a',
        roles: ['user', 'admin', 'super_admin'],
      },
      membership: {
        tenantId: 'tenant-a',
        uid: 'user-a',
        active: true,
        roles: ['user', 'moderator'],
      },
    });
    const result = await harness.resolve({ authorizationHeader });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.context.roles).toEqual(['user']);
      expect(result.context.roles).not.toContain('admin');
      expect(result.context.roles).not.toContain('super_admin');
    }
  });

  it('returns 403 when signed claims and membership have no common role', async () => {
    const harness = makeHarness({
      identity: { uid: 'user-a', tenantId: 'tenant-a', roles: ['admin'] },
      membership: {
        tenantId: 'tenant-a', uid: 'user-a', active: true, roles: ['user'],
      },
    });
    await expect(harness.resolve({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_roles_not_authorized',
    });
  });

  it('issues a frozen, non-forgeable context only after both reads succeed', async () => {
    const harness = makeHarness();
    const result = await harness.resolve({
      authorizationHeader,
      xTenantId: 'tenant-a',
      host: 'tenant-a.example.test',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isTenantContext(result.context)).toBe(true);
    expect(Object.isFrozen(result.context)).toBe(true);
    expect(Object.isFrozen(result.context.roles)).toBe(true);
    expect(isTenantContextForTenant(result.context, 'tenant-a')).toBe(true);
  });

  it('rejects a spread, serialized or reconstructed context', async () => {
    const harness = makeHarness();
    const result = await harness.resolve({ authorizationHeader });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const spread = { ...result.context };
    const serialized = JSON.parse(JSON.stringify(result.context)) as unknown;
    const reconstructed = {
      tenantId: 'tenant-a',
      uid: 'user-a',
      roles: ['user'],
    };
    expect(isTenantContext(spread)).toBe(false);
    expect(isTenantContext(serialized)).toBe(false);
    expect(isTenantContext(reconstructed)).toBe(false);
  });

  it('rejects cross-tenant context reuse', async () => {
    const harness = makeHarness();
    const result = await harness.resolve({ authorizationHeader });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isTenantContextForTenant(result.context, 'tenant-b')).toBe(false);
    expect(isTenantContextForTenant(result.context, 'tenant-a')).toBe(true);
  });

  it('fails closed when a tenant authority read fails', async () => {
    const dependencies: TenantContextDependencies = {
      verifyIdToken: vi.fn(async () => ({
        uid: 'user-a', tenantId: 'tenant-a', roles: ['user'],
      })),
      readTenant: vi.fn(async () => { throw new Error('Firestore unavailable'); }),
      readMembership: vi.fn(async () => ({
        tenantId: 'tenant-a', uid: 'user-a', active: true, roles: ['user'],
      })),
      resolveHostTenantHint: () => null,
    };
    await expect(createTenantContextResolver(dependencies)({ authorizationHeader })).resolves.toMatchObject({
      ok: false, status: 403, code: 'tenant_authority_unavailable',
    });
  });

  it('performs only read operations through the Firebase Admin adapter', async () => {
    const reads: string[] = [];
    let writes = 0;
    const fakeFirestore = {
      doc: (path: string) => ({
        get: async () => {
          reads.push(path);
          if (path === 'tenants/tenant-a') {
            return { exists: true, data: () => ({ tenantId: 'tenant-a', active: true }) };
          }
          return {
            exists: true,
            data: () => ({
              tenantId: 'tenant-a', uid: 'user-a', active: true, roles: ['user'],
            }),
          };
        },
        set: () => { writes += 1; },
        update: () => { writes += 1; },
        delete: () => { writes += 1; },
      }),
    };

    const fakeAuth = {
      verifyIdToken: vi.fn(async () => ({
        uid: 'user-a', tenantId: 'tenant-a', roles: ['user'],
      })),
    };
    const deps = createFirebaseAdminTenantContextDependencies(
      fakeAuth as never,
      fakeFirestore as never,
      () => null,
    );
    const result = await createTenantContextResolver(deps)({ authorizationHeader });

    expect(result.ok).toBe(true);
    expect(reads).toEqual([
      'tenants/tenant-a',
      'tenants/tenant-a/members/user-a',
    ]);
    expect(writes).toBe(0);
    expect(fakeAuth.verifyIdToken).toHaveBeenCalledWith('valid-firebase-id-token', true);
  });
});
