import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTenantContextResolver,
  type TenantContext,
} from '../src/server/multitenant/tenantContext';
import {
  createTenantScopedRepository,
  type TenantResourceAuthorizationEvidence,
  type TenantResourceAuthorizationPolicy,
  type TenantScopedStore,
} from '../src/server/multitenant/tenantRepository';

type Roles = Array<'user' | 'admin' | 'super_admin' | 'moderator'>;

async function makeContext(
  uid = 'user-a',
  tenantId = 'tenant-a',
  roles: Roles = ['user'],
): Promise<TenantContext> {
  const resolve = createTenantContextResolver({
    verifyIdToken: vi.fn(async () => ({ uid, tenantId, roles })),
    readTenant: vi.fn(async (id: string) => ({ tenantId: id, active: true })),
    readMembership: vi.fn(async (id: string, memberUid: string) => ({
      tenantId: id,
      uid: memberUid,
      active: true,
      roles,
    })),
    resolveHostTenantHint: () => null,
  });
  const result = await resolve({ authorizationHeader: 'Bearer test-token' });
  if (!result.ok) throw new Error('Test fixture failed to issue a valid context');
  return result.context;
}

function evidence(
  overrides: Partial<TenantResourceAuthorizationEvidence> = {},
): TenantResourceAuthorizationEvidence {
  return {
    verified: true,
    tenantId: 'tenant-a',
    resourcePath: 'tenants/tenant-a/chats/chat-a',
    ownerUid: 'user-a',
    participantUids: ['user-a', 'user-b'],
    ...overrides,
  };
}

function makePolicy(
  metadata: unknown = evidence(),
): TenantResourceAuthorizationPolicy & { resolve: ReturnType<typeof vi.fn> } {
  return { resolve: vi.fn(async () => metadata) };
}

function makeStore() {
  return {
    read: vi.fn(async (path: string) => ({ path, payload: 'synthetic-only' })),
    create: vi.fn(async (_path: string, _value: unknown) => undefined),
    update: vi.fn(async (_path: string, _patch: unknown) => undefined),
    delete: vi.fn(async (_path: string) => undefined),
  };
}

function expectNoStoreCalls(store: ReturnType<typeof makeStore>) {
  expect(store.read).not.toHaveBeenCalled();
  expect(store.create).not.toHaveBeenCalled();
  expect(store.update).not.toHaveBeenCalled();
  expect(store.delete).not.toHaveBeenCalled();
}

describe('isolated tenant-scoped repository boundary', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  it('denies a cross-tenant BOLA context before touching the tenant-A resource', async () => {
    const contextB = await makeContext('user-b', 'tenant-b');
    const policy = makePolicy(evidence({
      tenantId: 'tenant-a',
      resourcePath: 'tenants/tenant-b/chats/chat-a',
      ownerUid: 'user-a',
      participantUids: ['user-a'],
    }));
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    const result = await repository.read(contextB, 'chats/chat-a');
    expect(result).toEqual({ ok: false, code: 'resource_authority_invalid' });
    expect(policy.resolve).toHaveBeenCalledTimes(1);
    expect(policy.resolve).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-b',
      uid: 'user-b',
      resourcePath: 'tenants/tenant-b/chats/chat-a',
    }));
    expectNoStoreCalls(store);
  });

  it('denies a foreign UID within the same tenant (same-tenant IDOR)', async () => {
    const foreignActor = await makeContext('user-c', 'tenant-a');
    const policy = makePolicy(evidence({
      ownerUid: 'user-a',
      participantUids: ['user-a', 'user-b'],
    }));
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(foreignActor, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'resource_access_denied',
    });
    expectNoStoreCalls(store);
  });

  it('denies a non-participant attempting to access a chat/multi-party object', async () => {
    const outsider = await makeContext('outsider', 'tenant-a');
    const policy = makePolicy(evidence({
      ownerUid: 'owner-a',
      participantUids: ['owner-a', 'member-b', 'member-c'],
    }));
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(outsider, 'chats/chat-a')).resolves.toMatchObject({
      ok: false, code: 'resource_access_denied',
    });
    expectNoStoreCalls(store);
  });

  it('rejects a spread/forged context before asking the resource policy', async () => {
    const genuine = await makeContext();
    const forged = { ...genuine } as unknown as TenantContext;
    const policy = makePolicy();
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(forged, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'invalid_tenant_context',
    });
    expect(policy.resolve).not.toHaveBeenCalled();
    expectNoStoreCalls(store);
  });

  it('rejects a manually reconstructed context before any policy/store call', async () => {
    const reconstructed = {
      tenantId: 'tenant-a',
      uid: 'user-a',
      roles: ['user'],
    };
    const policy = makePolicy();
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(reconstructed, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'invalid_tenant_context',
    });
    expect(policy.resolve).not.toHaveBeenCalled();
    expectNoStoreCalls(store);
  });

  it.each([
    '../profiles/user-a',
    'profiles/../user-a',
    '/chats/chat-a',
    'chats//chat-a',
    'tenants/tenant-a/chats/chat-a',
    'tenant-a/chats/chat-a',
    'tenant-b/chats/chat-a',
    'users/user-a',
    'public_profiles/user-a',
    'user-a',
    'chats/chat-a/messages',
    'chats/chat-a/messages/message-a/extra',
    'chats/chat-a%2f..%2fusers/user-a',
  ])('rejects manipulated, prefixed, malformed or legacy path: %s', async path => {
    const context = await makeContext();
    const policy = makePolicy();
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(context, path)).resolves.toEqual({
      ok: false, code: 'invalid_resource_path',
    });
    expect(policy.resolve).not.toHaveBeenCalled();
    expectNoStoreCalls(store);
  });

  it('fails closed when resource owner metadata is missing', async () => {
    const context = await makeContext();
    const policy = makePolicy({
      verified: true,
      tenantId: 'tenant-a',
      resourcePath: 'tenants/tenant-a/chats/chat-a',
      participantUids: ['user-a', 'user-b'],
    });
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(context, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'resource_authority_invalid',
    });
    expectNoStoreCalls(store);
  });

  it('fails closed when the participant list is missing or empty', async () => {
    const context = await makeContext();
    for (const metadata of [
      { ...evidence(), participantUids: undefined },
      { ...evidence(), participantUids: [] },
    ]) {
      const policy = makePolicy(metadata);
      const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);
      await expect(repository.read(context, 'chats/chat-a')).resolves.toEqual({
        ok: false, code: 'resource_authority_invalid',
      });
    }
    expectNoStoreCalls(store);
  });

  it('rejects contradictory participant metadata (owner omitted or duplicate participants)', async () => {
    const context = await makeContext();
    for (const participants of [
      ['user-b', 'user-c'],
      ['user-a', 'user-b', 'user-b'],
      ['user-a', ''],
    ]) {
      const policy = makePolicy(evidence({ participantUids: participants }));
      const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);
      await expect(repository.read(context, 'chats/chat-a')).resolves.toEqual({
        ok: false, code: 'resource_authority_invalid',
      });
    }
    expectNoStoreCalls(store);
  });

  it('fails closed when resource-level authorization policy is absent', async () => {
    const context = await makeContext();
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore);

    await expect(repository.read(context, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'authorization_policy_unavailable',
    });
    expectNoStoreCalls(store);
  });

  it('fails closed when the resource authority throws or is unavailable', async () => {
    const context = await makeContext();
    const policy = { resolve: vi.fn(async () => { throw new Error('authority unavailable'); }) };
    const repository = createTenantScopedRepository(
      store as unknown as TenantScopedStore,
      policy,
    );

    await expect(repository.read(context, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'resource_authority_unavailable',
    });
    expectNoStoreCalls(store);
  });

  it.each(['admin', 'super_admin'] as const)(
    'does not let role %s bypass a foreign owner or participant boundary',
    async role => {
      const privilegedButForeign = await makeContext('privileged-user', 'tenant-a', [role]);
      const policy = makePolicy(evidence({
        ownerUid: 'resource-owner',
        participantUids: ['resource-owner', 'actual-participant'],
      }));
      const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

      await expect(repository.read(privilegedButForeign, 'chats/chat-a')).resolves.toEqual({
        ok: false, code: 'resource_access_denied',
      });
      expectNoStoreCalls(store);
    },
  );

  it('does not let super_admin bypass a mismatching tenant resource record', async () => {
    const privileged = await makeContext('root-operator', 'tenant-a', ['super_admin']);
    const policy = makePolicy(evidence({
      tenantId: 'tenant-b',
      resourcePath: 'tenants/tenant-a/chats/chat-a',
      ownerUid: 'root-operator',
      participantUids: ['root-operator'],
    }));
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(privileged, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'resource_authority_invalid',
    });
    expectNoStoreCalls(store);
  });

  it('allows an authorized owner to read and perform owner mutations only under the tenant prefix', async () => {
    const owner = await makeContext('user-a', 'tenant-a');
    const policy = {
      resolve: vi.fn(async (request: { resourcePath: string }) => evidence({
        resourcePath: request.resourcePath,
        ownerUid: 'user-a',
        participantUids: ['user-a', 'user-b'],
      })),
    };
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    const read = await repository.read(owner, 'profiles/user-a');
    expect(read).toEqual({
      ok: true,
      path: 'tenants/tenant-a/profiles/user-a',
      value: { path: 'tenants/tenant-a/profiles/user-a', payload: 'synthetic-only' },
    });
    await expect(repository.create(owner, 'profiles/user-a', { displayName: 'Synthetic' }))
      .resolves.toEqual({ ok: true, path: 'tenants/tenant-a/profiles/user-a' });
    await expect(repository.update(owner, 'profiles/user-a', { displayName: 'Updated' }))
      .resolves.toEqual({ ok: true, path: 'tenants/tenant-a/profiles/user-a' });
    await expect(repository.delete(owner, 'profiles/user-a'))
      .resolves.toEqual({ ok: true, path: 'tenants/tenant-a/profiles/user-a' });

    expect(store.read).toHaveBeenCalledTimes(1);
    expect(store.create).toHaveBeenCalledTimes(1);
    expect(store.update).toHaveBeenCalledTimes(1);
    expect(store.delete).toHaveBeenCalledTimes(1);
    expect(store.read.mock.calls[0]?.[0]).toBe('tenants/tenant-a/profiles/user-a');
    expect(store.create.mock.calls[0]?.[0]).toBe('tenants/tenant-a/profiles/user-a');
    expect(store.update.mock.calls[0]?.[0]).toBe('tenants/tenant-a/profiles/user-a');
    expect(store.delete.mock.calls[0]?.[0]).toBe('tenants/tenant-a/profiles/user-a');
    expect(policy.resolve).toHaveBeenCalledTimes(4);
  });

  it('allows a verified participant to read a tenant-scoped chat but not mutate it', async () => {
    const participant = await makeContext('user-b', 'tenant-a');
    const policy = makePolicy(evidence({
      ownerUid: 'user-a',
      participantUids: ['user-a', 'user-b'],
    }));
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(participant, 'chats/chat-a')).resolves.toMatchObject({
      ok: true,
      path: 'tenants/tenant-a/chats/chat-a',
    });
    await expect(repository.update(participant, 'chats/chat-a', { message: 'not allowed' }))
      .resolves.toEqual({ ok: false, code: 'participant_write_forbidden' });
    await expect(repository.delete(participant, 'chats/chat-a'))
      .resolves.toEqual({ ok: false, code: 'participant_write_forbidden' });
    expect(store.read).toHaveBeenCalledTimes(1);
    expect(store.update).not.toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('uses a separate policy result tied to the exact canonical resource path and tenant', async () => {
    const context = await makeContext();
    const policy = makePolicy(evidence({
      resourcePath: 'tenants/tenant-a/chats/some-other-chat',
    }));
    const repository = createTenantScopedRepository(store as unknown as TenantScopedStore, policy);

    await expect(repository.read(context, 'chats/chat-a')).resolves.toEqual({
      ok: false, code: 'resource_authority_invalid',
    });
    expectNoStoreCalls(store);
  });
});
