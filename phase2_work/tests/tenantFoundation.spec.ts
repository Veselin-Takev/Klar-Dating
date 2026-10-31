// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { Request, Response, NextFunction } from 'express';
import {
  authorizeTenant, createTenantMiddleware,
  type TenantAuthDependencies, type TenantContext,
} from '../src/server/multitenant/tenantAuth';
import { resolveTenantConfig, safeDeepMerge } from '../src/server/multitenant/tenantConfig';
import { createTenantReadRepository } from '../src/server/multitenant/tenantData';
import { evaluateTenantFlag } from '../src/server/multitenant/tenantFlags';

const uid = 'user_1';
const tenantId = 'tenant-one';
const traceId = '00000000-0000-4000-8000-000000000001';
const baseInput = () => ({
  authorization: 'Bearer abc.def.ghi', headerTenant: tenantId,
  hostname: 'tenant-one.klar.example', trustedBaseDomain: 'klar.example', traceId,
});
const dependency = (): TenantAuthDependencies => ({
  verifyToken: async () => ({ uid, tenantId, roles: ['user'] }),
  loadTenantAndMembership: async () => ({
    tenant: { tenantId, status: 'active' },
    membership: { tenantId, uid, status: 'active', roles: ['user'] },
  }),
});
const principal: TenantContext = { tenantId, uid, roles: ['user'], traceId };
const denied = async (task: Promise<unknown>, status: 401 | 403) =>
  expect(task).rejects.toMatchObject({ status, message: 'tenant_access_denied' });

describe('Tenant zero-trust identity and routing', () => {
  it('accepts only signed matching claim, active tenant and active membership', async () => {
    await expect(authorizeTenant(baseInput(), dependency())).resolves.toEqual(principal);
  });
  it('uses the signed claim when no routing hint is present', async () => {
    await expect(authorizeTenant({
      ...baseInput(), headerTenant: undefined, trustedBaseDomain: undefined,
    }, dependency())).resolves.toEqual(principal);
  });
  it('denies conflicting, invalid and duplicated routing headers', async () => {
    for (const headerTenant of ['tenant-two', '../tenant-one', 'Tenant-One', ['tenant-one', 'tenant-two'], 'tenant-one, tenant-two']) {
      await denied(authorizeTenant({ ...baseInput(), headerTenant }, dependency()), 403);
    }
  });
  it('denies mismatched or multiple subdomain labels', async () => {
    for (const hostname of ['tenant-two.klar.example', 'tenant-one.evil.klar.example']) {
      await denied(authorizeTenant({ ...baseInput(), hostname }, dependency()), 403);
    }
  });
  it('denies absent, malformed or failed Firebase verification before DB lookup', async () => {
    const lookup = vi.fn(async () => ({ tenant: { tenantId, status: 'active' }, membership: { tenantId, uid, status: 'active', roles: ['user'] } }));
    for (const authorization of [undefined, 'Basic abc', 'Bearer anything with spaces']) {
      await denied(authorizeTenant({ ...baseInput(), authorization }, { ...dependency(), loadTenantAndMembership: lookup }), 401);
    }
    await denied(authorizeTenant(baseInput(), { ...dependency(), verifyToken: async () => { throw Error('JWT invalid'); }, loadTenantAndMembership: lookup }), 401);
    expect(lookup).not.toHaveBeenCalled();
  });
  it('denies missing tenant claim and mismatching claim', async () => {
    for (const claims of [{ uid, roles: ['user'] }, { uid, tenantId: 'tenant-two', roles: ['user'] }]) {
      await denied(authorizeTenant(baseInput(), { ...dependency(), verifyToken: async () => claims }), claims.tenantId ? 403 : 401);
    }
  });
  it('denies inactive/absent tenant, membership, DB failure or stale claimed roles', async () => {
    const cases = [
      { tenant: null, membership: { tenantId, uid, status: 'active', roles: ['user'] } },
      { tenant: { tenantId, status: 'inactive' }, membership: { tenantId, uid, status: 'active', roles: ['user'] } },
      { tenant: { tenantId, status: 'active' }, membership: null },
      { tenant: { tenantId, status: 'active' }, membership: { tenantId, uid, status: 'suspended', roles: ['user'] } },
      { tenant: { tenantId, status: 'active' }, membership: { tenantId, uid, status: 'active', roles: ['finance'] } },
    ];
    cases.push(
      { tenant: { tenantId: 'tenant-two', status: 'active' },
        membership: { tenantId, uid, status: 'active', roles: ['user'] } },
      { tenant: { tenantId, status: 'active' },
        membership: { tenantId: 'tenant-two', uid, status: 'active', roles: ['user'] } },
      { tenant: { tenantId, status: 'active' },
        membership: { tenantId, uid: 'user_2', status: 'active', roles: ['user'] } },
    );
    for (const records of cases) {
      await denied(authorizeTenant(baseInput(), { ...dependency(), loadTenantAndMembership: async () => records }), 403);
    }
    await denied(authorizeTenant(baseInput(), { ...dependency(), loadTenantAndMembership: async () => { throw Error('Firestore offline'); } }), 403);
  });
  it('grants only intersected JWT and authoritative membership roles', async () => {
    const ctx = await authorizeTenant(baseInput(), {
      verifyToken: async () => ({ uid, tenantId, roles: ['user', 'admin'] }),
      loadTenantAndMembership: async () => ({ tenant: { tenantId, status: 'active' }, membership: { tenantId, uid, status: 'active', roles: ['user'] } }),
    });
    expect(ctx.roles).toEqual(['user']);
  });
  it('middleware sets context only on success and responds with non-leaking error', async () => {
    const next = vi.fn() as unknown as NextFunction;
    const response = { locals: {}, status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    const req = { headers: { authorization: 'Bearer abc.def.ghi', 'x-tenant-id': tenantId }, hostname: 'tenant-one.klar.example' } as unknown as Request;
    await createTenantMiddleware(dependency(), 'klar.example')(req, response as unknown as Response, next);
    expect(next).toHaveBeenCalledOnce();
    expect((response.locals as { tenantContext?: TenantContext }).tenantContext?.tenantId).toBe(tenantId);
    const deniedRes = { locals: {}, status: vi.fn(), json: vi.fn() };
    deniedRes.status.mockReturnValue(deniedRes);
    await createTenantMiddleware(dependency(), 'klar.example')({
      ...req, headers: { authorization: 'Bearer abc.def.ghi', 'x-tenant-id': 'tenant-two' },
    } as unknown as Request, deniedRes as unknown as Response, next);
    expect(deniedRes.status).toHaveBeenCalledWith(403);
    expect(deniedRes.json).toHaveBeenCalledWith({ code: 'tenant_access_denied' });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('Tenant configuration strictly validated after each inherited layer', () => {
  it('deep-merges base → region → tenant → subtenant without leaking inherited inputs', () => {
    const region = { interface: { locale: 'en' } };
    const config = resolveTenantConfig({
      region, tenant: { discovery: { dailySuggestions: 10 } },
      subTenantId: 'tenant-child',
      subTenant: { interface: { locale: 'fr', reducedMotion: true } },
    });
    expect(config).toEqual({
      interface: { locale: 'fr', reducedMotion: true },
      discovery: { dailySuggestions: 10 },
      privacy: { requireVerifiedProfile: true },
    });
    expect(region).toEqual({ interface: { locale: 'en' } });
    expect(resolveTenantConfig({}).interface.locale).toBe('de');
  });
  it('rejects prototype pollution, arrays, functions, unknown keys and weakening privacy', () => {
    const injection = JSON.parse('{"__proto__":{"isAdmin":true}}') as unknown;
    for (const layer of [
      injection, { interface: { constructor: {} } }, [],
      { discovery: { dailySuggestions: 99 } }, { privacy: { requireVerifiedProfile: false } },
      { rootUnknown: true }, { interface: { locale: 'xx' } }, { interface: { locale: () => 'de' } },
    ]) {
      expect(() => resolveTenantConfig({ region: layer })).toThrow();
    }
    expect(({} as { isAdmin?: boolean }).isAdmin).toBeUndefined();
  });
  it('rejects invalid earlier region despite later tenant correction', () => {
    expect(() => resolveTenantConfig({
      region: { discovery: { dailySuggestions: 200 } },
      tenant: { discovery: { dailySuggestions: 8 } },
    })).toThrow();
    expect(() => resolveTenantConfig({ subTenant: { interface: { locale: 'en' } } })).toThrow();
  });
  it('does not mutate inputs or permit unsafe inherited prototype sources', () => {
    const original = { a: { b: 1 } };
    const changed = safeDeepMerge(original, { a: { b: 2 } });
    expect(original.a.b).toBe(1);
    expect(changed).toEqual({ a: { b: 2 } });
    expect(() => safeDeepMerge(original, Object.create({ polluted: true }) as unknown)).toThrow();
  });
});

describe('Tenant-scoped data layer and structured feature flag audit', () => {
  const paths: string[] = [];
  const documents = new Map<string, unknown>();
  const db = { doc(path: string) {
    paths.push(path);
    return { get: async () => ({
      exists: documents.has(path),
      data: () => documents.get(path),
    }) };
  } } as unknown as Firestore;
  let issuedPrincipal: TenantContext;
  let repository: ReturnType<typeof createTenantReadRepository>;
  beforeAll(async () => {
    issuedPrincipal = await authorizeTenant(baseInput(), dependency());
    repository = createTenantReadRepository(db, issuedPrincipal);
  });
  it('rejects fabricated tenant contexts, even when their shape is valid', async () => {
    expect(() => createTenantReadRepository(db, principal)).toThrow('tenant_access_denied');
    await expect(evaluateTenantFlag(principal, 'SAFE_CHAT', repository, { info: vi.fn() })).rejects.toThrow('tenant_access_denied');
  });
  it('only reads own profile under leaf tenant; mismatched tenant label fails closed', async () => {
    paths.length = 0;
    const path = 'tenants/tenant-one/users/user_1';
    documents.set(path, { tenantId: 'tenant-two' });
    await expect(repository.getOwnProfile()).rejects.toThrow('tenant_record_inconsistent');
    documents.set(path, { tenantId: 'tenant-one', uid: 'user_2', name: 'Other' });
    await expect(repository.getOwnProfile()).rejects.toThrow('tenant_record_inconsistent');
    documents.set(path, { tenantId: 'tenant-one', name: 'No owner' });
    await expect(repository.getOwnProfile()).rejects.toThrow('tenant_record_inconsistent');
    documents.set(path, { tenantId: 'tenant-one', uid, name: 'Self' });
    await expect(repository.getOwnProfile()).resolves.toEqual({ tenantId, uid, name: 'Self' });
    expect(paths).toEqual([path, path, path, path]);
    expect('getPayment' in repository).toBe(false);
    expect('getChat' in repository).toBe(false);
  });
  it('rejects malicious flag ID before any Firestore access', async () => {
    paths.length = 0;
    await expect(repository.getFeatureFlag('../other')).rejects.toThrow();
    expect(paths).toEqual([]);
  });
  it('logs tenant_id, trace_id and timestamp for every decision and rejects cross-tenant flag', async () => {
    paths.length = 0;
    const sink = { info: vi.fn() };
    const path = 'tenants/tenant-one/featureFlags/SAFE_CHAT';
    documents.set(path, { tenantId: 'tenant-two', status: 'active', enabled: true, privateData: 'MUST_NOT_ESCAPE' });
    await expect(repository.getFeatureFlag('SAFE_CHAT')).rejects.toThrow('tenant_record_inconsistent');
    await expect(evaluateTenantFlag(issuedPrincipal, 'SAFE_CHAT', repository, sink, () => new Date('2026-10-31T12:00:00.000Z'))).rejects.toThrow('tenant_record_inconsistent');
    documents.set(path, { tenantId: 'tenant-one', status: 'active', enabled: true, privateData: 'MUST_NOT_ESCAPE' });
    await expect(repository.getFeatureFlag('SAFE_CHAT')).resolves.toEqual({
      tenantId: 'tenant-one', status: 'active', enabled: true,
    });
    await expect(evaluateTenantFlag(issuedPrincipal, 'SAFE_CHAT', repository, sink)).resolves.toBe(true);
    expect(paths).toEqual([path, path, path, path]);
    expect(sink.info).toHaveBeenCalledTimes(2);
    expect(sink.info.mock.calls[0]?.[0]).toEqual({
      tenant_id: tenantId, trace_id: traceId, timestamp: '2026-10-31T12:00:00.000Z',
      flag_name: 'SAFE_CHAT', enabled: false, outcome: 'denied',
    });
  });
  it('refuses malformed and inactive feature flag records at the repository boundary', async () => {
    const path = 'tenants/tenant-one/featureFlags/SAFE_CHAT';
    for (const invalid of [
      { status: 'active', enabled: true },
      { tenantId: 'tenant-one', status: 'inactive', enabled: true },
      { tenantId: 'tenant-one', status: 'active', enabled: 'true' },
    ]) {
      documents.set(path, invalid);
      await expect(repository.getFeatureFlag('SAFE_CHAT')).rejects.toThrow('tenant_record_inconsistent');
    }
    documents.delete(path);
    await expect(repository.getFeatureFlag('SAFE_CHAT')).resolves.toBeNull();
  });
  it('logs denied decision on storage failure and refuses to proceed if audit logger fails', async () => {
    const broken = { getOwnProfile: repository.getOwnProfile, getFeatureFlag: async () => { throw Error('DB offline'); } };
    const sink = { info: vi.fn() };
    await expect(evaluateTenantFlag(issuedPrincipal, 'SAFE_CHAT', broken, sink)).rejects.toThrow('DB offline');
    expect(sink.info.mock.calls[0]?.[0]).toMatchObject({ enabled: false, outcome: 'denied' });
    const brokenLogger = { info: () => { throw Error('log sink offline'); } };
    await expect(evaluateTenantFlag(issuedPrincipal, 'SAFE_CHAT', repository, brokenLogger)).rejects.toThrow('log sink offline');
  });
});
