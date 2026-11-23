/**
 * P0 #374 Package 1 — isolated profile-media authorization and delivery contract.
 *
 * This module is intentionally not mounted by server.ts. It accepts only
 * server-owned configuration and injected authorities; it performs no direct
 * Firebase, HTTP, database, or cloud operation itself.
 */

export interface ProfileMediaDeliveryServerConfig {
  readonly enabled?: unknown;
  /** Exact HTTPS hostnames returned by the trusted signer. */
  readonly allowedSignerHosts?: readonly string[];
}

export interface ProfileMediaDeliveryRequest {
  readonly authorizationHeader?: string | null;
  readonly targetProfileId: string;
  /** Canonical opaque storage path; never a URL or a user/UID-derived path. */
  readonly objectPath: string;
  readonly ttlSeconds: number;
}

export interface ProfileMediaRequester {
  readonly uid: string;
  readonly guest: boolean;
  readonly ageVerified: boolean;
  readonly adult: boolean;
  readonly consentGranted: boolean;
  /** Roles are descriptive only and never bypass the checks below. */
  readonly roles?: readonly string[];
}

export interface ProfileMediaAccessPolicy {
  readonly targetExists: boolean;
  readonly targetDeleted: boolean;
  readonly targetActive: boolean;
  readonly targetAgeVerified: boolean;
  readonly targetAdult: boolean;
  readonly requesterBlockedTarget: boolean;
  readonly targetBlockedRequester: boolean;
}

export interface ProfileMediaDeliveryDependencies {
  readonly authenticateRequester: (
    authorizationHeader: string,
  ) => Promise<ProfileMediaRequester | null>;
  readonly readAccessPolicy: (input: Readonly<{
    requesterUid: string;
    targetProfileId: string;
  }>) => Promise<ProfileMediaAccessPolicy | null>;
  readonly storage: Readonly<{
    objectExists: (objectPath: string) => Promise<boolean>;
  }>;
  readonly signer: Readonly<{
    signReadUrl: (input: Readonly<{
      objectPath: string;
      expiresInSeconds: number;
    }>) => Promise<Readonly<{
      url: string;
      expiresAtEpochMs: number;
    }>>;
  }>;
  readonly now?: () => number;
}

export type ProfileMediaDeliveryFailureCode =
  | 'profile_media_delivery_disabled'
  | 'invalid_profile_media_request'
  | 'authentication_required'
  | 'guest_not_allowed'
  | 'requester_not_verified_adult'
  | 'consent_required'
  | 'target_not_found'
  | 'target_unavailable'
  | 'target_not_verified_adult'
  | 'profile_media_blocked'
  | 'profile_media_object_not_found'
  | 'profile_media_policy_unavailable'
  | 'profile_media_storage_unavailable'
  | 'profile_media_signer_unavailable'
  | 'profile_media_signed_url_invalid';

export type ProfileMediaDeliveryResult =
  | Readonly<{
      ok: true;
      status: 200;
      url: string;
      expiresAtEpochMs: number;
      headers: Readonly<{
        'Cache-Control': 'no-store, max-age=0';
        Pragma: 'no-cache';
        Expires: '0';
      }>;
    }>
  | Readonly<{
      ok: false;
      status: 400 | 401 | 403 | 404 | 503;
      code: ProfileMediaDeliveryFailureCode;
    }>;

const MAX_SIGNED_URL_TTL_SECONDS = 300;
const OPAQUE_PROFILE_MEDIA_PATH = /^profile-media\/v1\/[A-Za-z0-9_-]{32,128}$/;
const NO_STORE_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, max-age=0' as const,
  Pragma: 'no-cache' as const,
  Expires: '0' as const,
});

function failure(
  status: 400 | 401 | 403 | 404 | 503,
  code: ProfileMediaDeliveryFailureCode,
): ProfileMediaDeliveryResult {
  return Object.freeze({ ok: false as const, status, code });
}

function isCanonicalOpaquePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 160) return false;
  // The allow-list grammar excludes URLs, token query strings, traversal,
  // encoded separators, backslashes, UID paths, and untrusted hosts.
  return OPAQUE_PROFILE_MEDIA_PATH.test(value) && !value.includes('..');
}

function trustedSignerHosts(config: ProfileMediaDeliveryServerConfig): ReadonlySet<string> | null {
  const hosts = config.allowedSignerHosts;
  if (!Array.isArray(hosts) || hosts.length === 0) return null;
  const normalized: string[] = [];
  for (const host of hosts) {
    if (typeof host !== 'string' || host.length === 0 || host !== host.trim()) return null;
    const lower = host.toLowerCase();
    if (lower.includes('/') || lower.includes(':') || lower.includes('@') || lower.includes(' ')) return null;
    normalized.push(lower);
  }
  return new Set(normalized);
}

/**
 * Creates a default-off delivery contract. When disabled, execute returns 503
 * before invoking authentication, policy, storage, or signer dependencies.
 */
export function createProfileMediaDeliveryContract(
  serverConfig: ProfileMediaDeliveryServerConfig | null | undefined,
  dependencies: ProfileMediaDeliveryDependencies,
) {
  const enabled = serverConfig?.enabled === true;
  const allowedHosts = enabled ? trustedSignerHosts(serverConfig) : null;
  const now = dependencies.now ?? Date.now;

  return Object.freeze({
    readonlyEnabled: enabled,

    async execute(request: ProfileMediaDeliveryRequest): Promise<ProfileMediaDeliveryResult> {
      // First operation: no request parsing or downstream invocation while OFF.
      if (!enabled) return failure(503, 'profile_media_delivery_disabled');
      if (!allowedHosts) return failure(503, 'profile_media_signer_unavailable');

      if (
        !request ||
        typeof request.targetProfileId !== 'string' ||
        request.targetProfileId.trim().length === 0 ||
        !isCanonicalOpaquePath(request.objectPath) ||
        !Number.isSafeInteger(request.ttlSeconds) ||
        request.ttlSeconds < 1 ||
        request.ttlSeconds > MAX_SIGNED_URL_TTL_SECONDS
      ) {
        return failure(400, 'invalid_profile_media_request');
      }

      if (typeof request.authorizationHeader !== 'string' || request.authorizationHeader.trim() === '') {
        return failure(401, 'authentication_required');
      }

      let requester: ProfileMediaRequester | null;
      try {
        requester = await dependencies.authenticateRequester(request.authorizationHeader);
      } catch {
        return failure(503, 'profile_media_policy_unavailable');
      }
      if (!requester || typeof requester.uid !== 'string' || requester.uid.trim() === '') {
        return failure(401, 'authentication_required');
      }
      if (requester.guest !== false) {
        return failure(401, 'guest_not_allowed');
      }
      if (requester.ageVerified !== true || requester.adult !== true) {
        return failure(403, 'requester_not_verified_adult');
      }
      if (requester.consentGranted !== true) {
        return failure(403, 'consent_required');
      }

      let policy: ProfileMediaAccessPolicy | null;
      try {
        policy = await dependencies.readAccessPolicy({
          requesterUid: requester.uid,
          targetProfileId: request.targetProfileId,
        });
      } catch {
        return failure(503, 'profile_media_policy_unavailable');
      }
      if (!policy || policy.targetExists !== true) return failure(404, 'target_not_found');
      if (policy.targetDeleted !== false || policy.targetActive !== true) {
        return failure(404, 'target_unavailable');
      }
      if (policy.targetAgeVerified !== true || policy.targetAdult !== true) {
        return failure(403, 'target_not_verified_adult');
      }
      if (policy.requesterBlockedTarget !== false || policy.targetBlockedRequester !== false) {
        return failure(403, 'profile_media_blocked');
      }

      let objectExists: boolean;
      try {
        objectExists = await dependencies.storage.objectExists(request.objectPath);
      } catch {
        return failure(503, 'profile_media_storage_unavailable');
      }
      if (!objectExists) return failure(404, 'profile_media_object_not_found');

      const issuedAt = now();
      let signed: Readonly<{ url: string; expiresAtEpochMs: number }>;
      try {
        signed = await dependencies.signer.signReadUrl({
          objectPath: request.objectPath,
          expiresInSeconds: request.ttlSeconds,
        });
      } catch {
        return failure(503, 'profile_media_signer_unavailable');
      }

      if (!signed || typeof signed.url !== 'string') {
        return failure(503, 'profile_media_signed_url_invalid');
      }
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(signed.url);
      } catch {
        return failure(503, 'profile_media_signed_url_invalid');
      }
      const expiry = signed.expiresAtEpochMs;
      const latestAllowedExpiry = issuedAt + request.ttlSeconds * 1000;
      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.username !== '' ||
        parsedUrl.password !== '' ||
        (parsedUrl.port !== '' && parsedUrl.port !== '443') ||
        parsedUrl.hostname.toLowerCase() === 'firebasestorage.googleapis.com' ||
        Array.from(parsedUrl.searchParams.keys()).some(key => key.toLowerCase() === 'token') ||
        !allowedHosts.has(parsedUrl.hostname.toLowerCase()) ||
        !Number.isSafeInteger(expiry) ||
        expiry <= issuedAt ||
        expiry > latestAllowedExpiry
      ) {
        return failure(503, 'profile_media_signed_url_invalid');
      }

      return Object.freeze({
        ok: true as const,
        status: 200 as const,
        url: signed.url,
        expiresAtEpochMs: expiry,
        headers: NO_STORE_HEADERS,
      });
    },
  });
}
