import { isTenantContext } from './tenantContext';
import type { TenantContext } from './tenantContext';

/**
 * Package 2: isolated tenant-scoped repository boundary.
 *
 * This module is deliberately not mounted by server.ts or any existing route.
 * Its authorization policy is a trusted server-side dependency and must obtain
 * verified resource metadata independently of the store passed to this module.
 * Never construct the policy from request data or pass caller-supplied ownership
 * or participant claims to it.
 */

const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const UID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// Deliberately small allow-list: legacy root collections (including users and
// public_profiles) cannot be silently reinterpreted as tenant-native paths.
const TENANT_NATIVE_ROOTS: ReadonlySet<string> = new Set([
  'profiles',
  'chats',
  'resources',
  'documents',
  'media',
]);

export type TenantRepositoryOperation = 'read' | 'create' | 'update' | 'delete';

export interface TenantScopedStore {
  read(path: string): Promise<unknown | null>;
  create(path: string, value: unknown): Promise<void>;
  update(path: string, patch: unknown): Promise<void>;
  delete(path: string): Promise<void>;
}

export interface TenantResourceAuthorizationRequest {
  readonly tenantId: string;
  readonly uid: string;
  readonly operation: TenantRepositoryOperation;
  /** Canonical full path, including tenants/{tenantId}/. */
  readonly resourcePath: string;
}

export interface TenantResourceAuthorizationPolicy {
  /**
   * Resolve authoritative resource metadata. This is a trusted server-side
   * boundary, not a user-provided callback. It must not call the repository
   * store supplied to createTenantScopedRepository.
   */
  resolve(
    request: TenantResourceAuthorizationRequest,
  ): Promise<unknown | null>;
}

export interface TenantResourceAuthorizationEvidence {
  readonly verified: true;
  readonly tenantId: string;
  readonly resourcePath: string;
  readonly ownerUid: string;
  /** Must be an explicit, complete participant list; owner must be included. */
  readonly participantUids: readonly string[];
}

export type TenantRepositoryFailureCode =
  | 'invalid_tenant_context'
  | 'invalid_resource_path'
  | 'authorization_policy_unavailable'
  | 'resource_authority_unavailable'
  | 'resource_authority_invalid'
  | 'resource_access_denied'
  | 'participant_write_forbidden'
  | 'store_unavailable';

export type TenantRepositoryResult<T = never> =
  | Readonly<{ ok: true; path: string; value: T }>
  | Readonly<{ ok: true; path: string; value?: never }>
  | Readonly<{ ok: false; code: TenantRepositoryFailureCode }>;

type AuthorizedRequest =
  | Readonly<{ ok: true; path: string }>
  | Readonly<{ ok: false; code: TenantRepositoryFailureCode }>;

function denied(code: TenantRepositoryFailureCode): TenantRepositoryResult {
  return Object.freeze({ ok: false as const, code });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUid(value: unknown): value is string {
  return typeof value === 'string'
    && UID_PATTERN.test(value)
    && !value.includes('/');
}

function isTenantId(value: unknown): value is string {
  return typeof value === 'string' && TENANT_ID_PATTERN.test(value);
}

/**
 * Accepts only a tenant-relative Firestore document path, never a collection
 * path or a path that already contains its tenant prefix. Even segment counts
 * enforce Firestore document-path shape (collection/document pairs).
 */
function resolveTenantDocumentPath(
  tenantId: string,
  relativePath: unknown,
): string | null {
  if (typeof relativePath !== 'string' || !relativePath || relativePath.trim() !== relativePath) {
    return null;
  }
  if (/[\\\u0000-\u001f\u007f%?#]/.test(relativePath)) return null;

  const segments = relativePath.split('/');
  if (segments.length < 2 || segments.length % 2 !== 0) return null;
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  if (segments.some(segment => segment.toLowerCase() === 'tenants')) return null;
  if (segments.some(segment => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(segment))) return null;

  // Explicitly reject legacy root families rather than remapping their old
  // UID/pair/provider identifiers into the new tenant namespace.
  if (!TENANT_NATIVE_ROOTS.has(segments[0])) return null;
  if (segments[0] === tenantId || segments[0].startsWith('tenant-') || segments[0].startsWith('tenant_')) {
    return null;
  }

  return 'tenants/' + tenantId + '/' + segments.join('/');
}

function validateAuthorizationEvidence(
  evidence: unknown,
  context: TenantContext,
  resourcePath: string,
): TenantResourceAuthorizationEvidence | null {
  if (!isRecord(evidence) || evidence.verified !== true) return null;
  if (evidence.tenantId !== context.tenantId || evidence.resourcePath !== resourcePath) return null;
  if (!isUid(evidence.ownerUid)) return null;
  if (!Array.isArray(evidence.participantUids) || evidence.participantUids.length === 0) return null;

  const participants: string[] = [];
  const seen = new Set<string>();
  for (const participant of evidence.participantUids) {
    if (!isUid(participant) || seen.has(participant)) return null;
    seen.add(participant);
    participants.push(participant);
  }

  // An owner excluded from the verified participant set is contradictory.
  if (!seen.has(evidence.ownerUid)) return null;

  return {
    verified: true,
    tenantId: context.tenantId,
    resourcePath,
    ownerUid: evidence.ownerUid,
    participantUids: participants,
  };
}

export function createTenantScopedRepository(
  store: TenantScopedStore,
  policy?: TenantResourceAuthorizationPolicy | null,
) {
  async function authorize(
    context: unknown,
    relativePath: unknown,
    operation: TenantRepositoryOperation,
  ): Promise<AuthorizedRequest> {
    // isTenantContext performs the module-private WeakSet and frozen-object
    // checks. A copied, serialized, reconstructed or cross-module object fails.
    if (!isTenantContext(context)) {
      return { ok: false, code: 'invalid_tenant_context' };
    }
    if (!isTenantId(context.tenantId) || !isUid(context.uid)) {
      return { ok: false, code: 'invalid_tenant_context' };
    }

    const resourcePath = resolveTenantDocumentPath(context.tenantId, relativePath);
    if (!resourcePath) return { ok: false, code: 'invalid_resource_path' };

    if (!policy || typeof policy.resolve !== 'function') {
      return { ok: false, code: 'authorization_policy_unavailable' };
    }

    let rawEvidence: unknown;
    try {
      rawEvidence = await policy.resolve(Object.freeze({
        tenantId: context.tenantId,
        uid: context.uid,
        operation,
        resourcePath,
      }));
    } catch {
      return { ok: false, code: 'resource_authority_unavailable' };
    }

    const evidence = validateAuthorizationEvidence(rawEvidence, context, resourcePath);
    if (!evidence) return { ok: false, code: 'resource_authority_invalid' };

    const isOwner = evidence.ownerUid === context.uid;
    const isParticipant = evidence.participantUids.includes(context.uid);

    // No role, including admin/super_admin, bypasses these object-level checks.
    if (!isOwner && !isParticipant) {
      return { ok: false, code: 'resource_access_denied' };
    }
    // Participants may read; only the explicit resource owner may mutate.
    if (operation !== 'read' && !isOwner) {
      return { ok: false, code: 'participant_write_forbidden' };
    }

    return { ok: true, path: resourcePath };
  }

  return Object.freeze({
    async read<T = unknown>(context: unknown, relativePath: unknown): Promise<TenantRepositoryResult<T>> {
      const authorization = await authorize(context, relativePath, 'read');
      if (!authorization.ok) return denied(authorization.code);
      try {
        return Object.freeze({
          ok: true as const,
          path: authorization.path,
          value: await store.read(authorization.path) as T,
        });
      } catch {
        return denied('store_unavailable');
      }
    },

    async create(
      context: unknown,
      relativePath: unknown,
      value: unknown,
    ): Promise<TenantRepositoryResult> {
      const authorization = await authorize(context, relativePath, 'create');
      if (!authorization.ok) return denied(authorization.code);
      try {
        await store.create(authorization.path, value);
        return Object.freeze({ ok: true as const, path: authorization.path });
      } catch {
        return denied('store_unavailable');
      }
    },

    async update(
      context: unknown,
      relativePath: unknown,
      patch: unknown,
    ): Promise<TenantRepositoryResult> {
      const authorization = await authorize(context, relativePath, 'update');
      if (!authorization.ok) return denied(authorization.code);
      try {
        await store.update(authorization.path, patch);
        return Object.freeze({ ok: true as const, path: authorization.path });
      } catch {
        return denied('store_unavailable');
      }
    },

    async delete(
      context: unknown,
      relativePath: unknown,
    ): Promise<TenantRepositoryResult> {
      const authorization = await authorize(context, relativePath, 'delete');
      if (!authorization.ok) return denied(authorization.code);
      try {
        await store.delete(authorization.path);
        return Object.freeze({ ok: true as const, path: authorization.path });
      } catch {
        return denied('store_unavailable');
      }
    },
  });
}
