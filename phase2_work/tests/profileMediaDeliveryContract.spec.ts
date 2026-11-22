import { describe, expect, it, vi } from 'vitest';
import {
  createProfileMediaDeliveryContract,
  type ProfileMediaAccessPolicy,
  type ProfileMediaDeliveryDependencies,
  type ProfileMediaDeliveryRequest,
  type ProfileMediaRequester,
} from '../src/server/media/profileMediaDeliveryContract';

const NOW = 1_800_000_000_000;
const OPAQUE_PATH = `profile-media/v1/${'a'.repeat(40)}`;
const AUTH = 'Bearer synthetic-test-token';

const adultRequester: ProfileMediaRequester = {
  uid: 'synthetic-requester',
  guest: false,
  ageVerified: true,
  adult: true,
  consentGranted: true,
  roles: ['user'],
};
const allowedPolicy: ProfileMediaAccessPolicy = {
  targetExists: true,
  targetDeleted: false,
  targetActive: true,
  targetAgeVerified: true,
  targetAdult: true,
  requesterBlockedTarget: false,
  targetBlockedRequester: false,
};

function harness(options: {
  enabled?: unknown;
  requester?: ProfileMediaRequester | null;
  policy?: ProfileMediaAccessPolicy | null;
  objectExists?: boolean;
  signedUrl?: string;
  expiresAtEpochMs?: number;
  roles?: readonly string[];
} = {}) {
  const calls = { auth: 0, policy: 0, storage: 0, signer: 0 };
  const requester = options.requester === undefined
    ? adultRequester
    : options.requester;
  const policy = options.policy === undefined ? allowedPolicy : options.policy;
  const dependencies: ProfileMediaDeliveryDependencies = {
    authenticateRequester: vi.fn(async (_header: string) => {
      calls.auth += 1;
      return requester;
    }),
    readAccessPolicy: vi.fn(async () => {
      calls.policy += 1;
      return policy;
    }),
    storage: {
      objectExists: vi.fn(async (_path: string) => {
        calls.storage += 1;
        return options.objectExists ?? true;
      }),
    },
    signer: {
      signReadUrl: vi.fn(async ({ expiresInSeconds }: { objectPath: string; expiresInSeconds: number }) => {
        calls.signer += 1;
        return {
          url: options.signedUrl ?? 'https://media.example.test/signed/object?signature=synthetic',
          expiresAtEpochMs: options.expiresAtEpochMs ?? NOW + expiresInSeconds * 1000,
        };
      }),
    },
    now: () => NOW,
  };
  const contract = createProfileMediaDeliveryContract(
    {
      enabled: Object.prototype.hasOwnProperty.call(options, 'enabled')
        ? options.enabled
        : true,
      allowedSignerHosts: ['media.example.test'],
    },
    dependencies,
  );
  const request = (overrides: Partial<ProfileMediaDeliveryRequest> = {}): ProfileMediaDeliveryRequest => ({
    authorizationHeader: AUTH,
    targetProfileId: 'synthetic-target',
    objectPath: OPAQUE_PATH,
    ttlSeconds: 120,
    ...overrides,
  });
  return { contract, dependencies, calls, request };
}

function expectNoDeliveryCalls(h: ReturnType<typeof harness>) {
  expect(h.calls.storage).toBe(0);
  expect(h.calls.signer).toBe(0);
}

describe('isolated default-off profile media delivery contract', () => {
  it.each([undefined, false, null, 0, 'true', {}, []])(
    'fails closed before every downstream dependency when enabled=%s',
    async enabled => {
      const h = harness({ enabled });
      const result = await h.contract.execute(h.request());
      expect(result).toEqual({
        ok: false,
        status: 503,
        code: 'profile_media_delivery_disabled',
      });
      expect(h.calls).toEqual({ auth: 0, policy: 0, storage: 0, signer: 0 });
    },
  );

  it('returns 401 for a missing Authorization header without invoking dependencies', async () => {
    const h = harness();
    const result = await h.contract.execute(h.request({ authorizationHeader: null }));
    expect(result).toMatchObject({ ok: false, status: 401, code: 'authentication_required' });
    expect(h.calls).toEqual({ auth: 0, policy: 0, storage: 0, signer: 0 });
  });

  it('returns 401 for unauthenticated identity', async () => {
    const h = harness({ requester: null });
    expect(await h.contract.execute(h.request())).toMatchObject({ ok: false, status: 401 });
    expect(h.calls).toMatchObject({ auth: 1, policy: 0, storage: 0, signer: 0 });
  });

  it('returns 401 for guest sessions', async () => {
    const h = harness({ requester: { ...adultRequester, guest: true } });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 401, code: 'guest_not_allowed',
    });
    expect(h.calls).toMatchObject({ auth: 1, policy: 0, storage: 0, signer: 0 });
  });

  it.each([
    ['underage', { ...adultRequester, adult: false }],
    ['not age verified', { ...adultRequester, ageVerified: false }],
  ])('denies requester who is %s', async (_label, requester) => {
    const h = harness({ requester });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 403, code: 'requester_not_verified_adult',
    });
    expect(h.calls).toMatchObject({ auth: 1, policy: 0, storage: 0, signer: 0 });
  });

  it('denies missing consent before policy, storage, or signer calls', async () => {
    const h = harness({ requester: { ...adultRequester, consentGranted: false } });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 403, code: 'consent_required',
    });
    expect(h.calls).toMatchObject({ auth: 1, policy: 0, storage: 0, signer: 0 });
  });

  it.each([
    ['requester blocked target', { ...allowedPolicy, requesterBlockedTarget: true }],
    ['target blocked requester', { ...allowedPolicy, targetBlockedRequester: true }],
  ])('denies either-direction block: %s', async (_label, policy) => {
    const h = harness({ policy });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 403, code: 'profile_media_blocked',
    });
    expect(h.calls).toMatchObject({ auth: 1, policy: 1, storage: 0, signer: 0 });
  });

  it('returns 404 for a missing target profile', async () => {
    const h = harness({ policy: null });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 404, code: 'target_not_found',
    });
    expectNoDeliveryCalls(h);
  });

  it.each([
    ['deleted', { ...allowedPolicy, targetDeleted: true }],
    ['deactivated', { ...allowedPolicy, targetActive: false }],
  ])('denies %s target profiles', async (_label, policy) => {
    const h = harness({ policy });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 404, code: 'target_unavailable',
    });
    expectNoDeliveryCalls(h);
  });

  it('denies a target without verified-adult status', async () => {
    const h = harness({ policy: { ...allowedPolicy, targetAgeVerified: false } });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 403, code: 'target_not_verified_adult',
    });
    expectNoDeliveryCalls(h);
  });

  it.each([
    ['persistent Firebase download-token URL', 'https://firebasestorage.googleapis.com/v0/b/example/o/profiles%2Fx?alt=media&token=legacy'],
    ['path traversal', 'profile-media/v1/../../private/object'],
    ['encoded traversal', 'profile-media/v1/%2e%2e%2fprivate'],
    ['UID-derived legacy path', 'profiles/synthetic-uid/photo.jpg'],
  ])('rejects %s before authentication or URL issuance', async (_label, objectPath) => {
    const h = harness();
    expect(await h.contract.execute(h.request({ objectPath }))).toMatchObject({
      ok: false, status: 400, code: 'invalid_profile_media_request',
    });
    expect(h.calls).toEqual({ auth: 0, policy: 0, storage: 0, signer: 0 });
  });

  it.each([0, -1, 301, 3600, 1.5, Number.NaN])(
    'rejects invalid or excessive requested TTL %s',
    async ttlSeconds => {
      const h = harness();
      expect(await h.contract.execute(h.request({ ttlSeconds }))).toMatchObject({
        ok: false, status: 400, code: 'invalid_profile_media_request',
      });
      expect(h.calls).toEqual({ auth: 0, policy: 0, storage: 0, signer: 0 });
    },
  );

  it('rejects a signer URL whose expiry is already elapsed', async () => {
    const h = harness({ expiresAtEpochMs: NOW });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 503, code: 'profile_media_signed_url_invalid',
    });
  });

  it('rejects a signer URL that exceeds the requested TTL ceiling', async () => {
    const h = harness({ expiresAtEpochMs: NOW + 121_001 });
    expect(await h.contract.execute(h.request({ ttlSeconds: 120 }))).toMatchObject({
      ok: false, status: 503, code: 'profile_media_signed_url_invalid',
    });
  });

  it('rejects a signer URL returned from an untrusted host', async () => {
    const h = harness({ signedUrl: 'https://attacker.example.test/object?signature=x' });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 503, code: 'profile_media_signed_url_invalid',
    });
  });

  it('returns a short-lived signed URL with mandatory no-store headers for authorized adults', async () => {
    const h = harness();
    const result = await h.contract.execute(h.request());
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      url: 'https://media.example.test/signed/object?signature=synthetic',
      expiresAtEpochMs: NOW + 120_000,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
    expect(h.calls).toEqual({ auth: 1, policy: 1, storage: 1, signer: 1 });
  });

  it('does not grant admin or super_admin a policy bypass', async () => {
    const h = harness({
      requester: { ...adultRequester, roles: ['super_admin'] },
      policy: { ...allowedPolicy, targetDeleted: true },
    });
    expect(await h.contract.execute(h.request())).toMatchObject({
      ok: false, status: 404, code: 'target_unavailable',
    });
    expectNoDeliveryCalls(h);
  });

  it('fails closed when the signer host allow-list is missing', async () => {
    const h = harness();
    const contract = createProfileMediaDeliveryContract(
      { enabled: true },
      h.dependencies,
    );
    expect(await contract.execute(h.request())).toMatchObject({
      ok: false, status: 503, code: 'profile_media_signer_unavailable',
    });
    expect(h.calls).toEqual({ auth: 0, policy: 0, storage: 0, signer: 0 });
  });
});
