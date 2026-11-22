import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

/**
 * Package 1 tenant-context boundary.
 *
 * This module is deliberately not mounted by server.ts. It is a read-only,
 * injectable foundation for a separately reviewed future route cut-over.
 * No request-supplied tenant identifier or role is ever used as authority.
 */

export const TENANT_CONTEXT_ROLES = [
  'user',
  'moderator',
  'support',
  'trust_safety',
  'finance',
  'admin',
  'super_admin',
] as const;

export type TenantContextRole = (typeof TENANT_CONTEXT_ROLES)[number];

const ROLE_SET: ReadonlySet<string> = new Set(TENANT_CONTEXT_ROLES);
const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const TENANT_CONTEXT_BRAND: unique symbol = Symbol('KlarTenantContext');
const ISSUED_CONTEXTS = new WeakSet<object>();

export type TenantContext = Readonly<{
  tenantId: string;
  uid: string;
  roles: readonly TenantContextRole[];
  readonly [TENANT_CONTEXT_BRAND]: true;
}>;

export interface VerifiedFirebaseIdentity {
  uid?: unknown;
  tenantId?: unknown;
  roles?: unknown;
  [claim: string]: unknown;
}

export interface TenantContextDependencies {
  /** Must call Firebase Admin verifyIdToken(token, true). */
  verifyIdToken(token: string, checkRevoked: true): Promise<VerifiedFirebaseIdentity>;
  /** Independently reads tenants/{tenantId}; null means absent. */
  readTenant(tenantId: string): Promise<unknown | null>;
  /** Independently reads tenants/{tenantId}/members/{uid}; null means absent. */
  readMembership(tenantId: string, uid: string): Promise<unknown | null>;
  /** Resolves an optional host/FQDN route hint; it is never authority. */
  resolveHostTenantHint(host: string): string | null;
}

export interface ResolveTenantContextInput {
  authorizationHeader?: unknown;
  xTenantId?: unknown;
  host?: unknown;
}

export type TenantContextResolution =
  | Readonly<{ ok: true; context: TenantContext }>
  | Readonly<{
      ok: false;
      status: 401 | 403;
      code:
        | 'tenant_authentication_required'
        | 'tenant_authentication_failed'
        | 'tenant_claims_invalid'
        | 'tenant_routing_hint_mismatch'
        | 'tenant_not_active'
        | 'tenant_membership_not_active'
        | 'tenant_membership_inconsistent'
        | 'tenant_roles_not_authorized'
        | 'tenant_authority_unavailable';
    }>;

function failure(
  status: 401 | 403,
  code: Extract<TenantContextResolution, { ok: false }>['code'],
): TenantContextResolution {
  return Object.freeze({ ok: false as const, status, code });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTenantId(value: unknown): value is string {
  return typeof value === 'string' && TENANT_ID_PATTERN.test(value);
}

function isUid(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && !value.includes('/')
    && !value.split('').some(character => character.trim() === '');
}

function parseRoles(value: unknown): TenantContextRole[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const roles: TenantContextRole[] = [];
  const seen = new Set<string>();
  for (const role of value) {
    if (typeof role !== 'string' || !ROLE_SET.has(role) || seen.has(role)) return null;
    seen.add(role);
    roles.push(role as TenantContextRole);
  }
  return roles;
}

function bearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

function routingHintMatches(value: unknown, tenantId: string): boolean {
  if (value === undefined || value === null || value === '') return true;
  return typeof value === 'string' && isTenantId(value) && value === tenantId;
}

/**
 * Creates a resolver with no hidden global state, project discovery or writes.
 * Any token verification error is 401. Any claim, routing, document or role
 * inconsistency is 403. Dependency/read errors fail closed as 403.
 */
export function createTenantContextResolver(
  dependencies: TenantContextDependencies,
): (input: ResolveTenantContextInput) => Promise<TenantContextResolution> {
  return async (input): Promise<TenantContextResolution> => {
    const token = bearerToken(input.authorizationHeader);
    if (!token) return failure(401, 'tenant_authentication_required');

    let identity: VerifiedFirebaseIdentity;
    try {
      identity = await dependencies.verifyIdToken(token, true);
    } catch {
      return failure(401, 'tenant_authentication_failed');
    }

    const uid = identity?.uid;
    const tenantId = identity?.tenantId;
    const claimedRoles = parseRoles(identity?.roles);
    if (!isUid(uid) || !isTenantId(tenantId) || !claimedRoles) {
      return failure(403, 'tenant_claims_invalid');
    }

    // Routing hints may only confirm the signed claim. They cannot select or
    // override the tenant, even when both hints agree with each other.
    if (!routingHintMatches(input.xTenantId, tenantId)) {
      return failure(403, 'tenant_routing_hint_mismatch');
    }
    if (input.host !== undefined && input.host !== null && input.host !== '') {
      if (typeof input.host !== 'string') {
        return failure(403, 'tenant_routing_hint_mismatch');
      }
      let hostHint: string | null;
      try {
        hostHint = dependencies.resolveHostTenantHint(input.host);
      } catch {
        return failure(403, 'tenant_routing_hint_mismatch');
      }
      if (hostHint !== null && (!isTenantId(hostHint) || hostHint !== tenantId)) {
        return failure(403, 'tenant_routing_hint_mismatch');
      }
    }

    let tenantDocument: unknown | null;
    let membershipDocument: unknown | null;
    try {
      // Keep the tenant and membership lookups independent; both must return
      // explicit active records. No fallback/default tenant is ever consulted.
      [tenantDocument, membershipDocument] = await Promise.all([
        dependencies.readTenant(tenantId),
        dependencies.readMembership(tenantId, uid),
      ]);
    } catch {
      return failure(403, 'tenant_authority_unavailable');
    }

    if (!isRecord(tenantDocument)
      || tenantDocument.tenantId !== tenantId
      || tenantDocument.active !== true) {
      return failure(403, 'tenant_not_active');
    }

    if (!isRecord(membershipDocument)
      || membershipDocument.tenantId !== tenantId
      || membershipDocument.uid !== uid
      || membershipDocument.active !== true) {
      return failure(403, 'tenant_membership_not_active');
    }

    const memberRoles = parseRoles(membershipDocument.roles);
    if (!memberRoles) return failure(403, 'tenant_membership_inconsistent');

    const memberRoleSet: ReadonlySet<TenantContextRole> = new Set(memberRoles);
    const effectiveRoles = claimedRoles.filter(role => memberRoleSet.has(role));
    if (effectiveRoles.length === 0) return failure(403, 'tenant_roles_not_authorized');

    const context = {
      tenantId,
      uid,
      roles: Object.freeze(effectiveRoles),
    } as Omit<TenantContext, typeof TENANT_CONTEXT_BRAND>;

    Object.defineProperty(context, TENANT_CONTEXT_BRAND, {
      value: true,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    Object.freeze(context);
    ISSUED_CONTEXTS.add(context);

    return Object.freeze({
      ok: true as const,
      context: context as TenantContext,
    });
  };
}

/** True only for the exact frozen object issued by this module instance. */
export function isTenantContext(value: unknown): value is TenantContext {
  return isRecord(value)
    && ISSUED_CONTEXTS.has(value)
    && (value as TenantContext)[TENANT_CONTEXT_BRAND] === true
    && Object.isFrozen(value)
    && Array.isArray(value.roles)
    && Object.isFrozen(value.roles);
}

/** Prevents a valid context from being reused for a different tenant. */
export function isTenantContextForTenant(
  value: unknown,
  expectedTenantId: string,
): value is TenantContext {
  return isTenantContext(value) && value.tenantId === expectedTenantId;
}

/**
 * Server-owned host routing helper for a single-level tenant subdomain.
 * Example: tenant-a.example.test -> tenant-a. The returned value remains a
 * hint; the resolver compares it with the signed tenantId claim.
 */
export function createSubdomainTenantHintResolver(
  rootDomain: string,
): (host: string) => string | null {
  const root = rootDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!root || root.includes('/') || root.includes(':')) {
    throw new Error('Invalid tenant routing root domain');
  }

  return (host: string): string | null => {
    const normalizedHost = host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
    const suffix = `.${root}`;
    if (!normalizedHost.endsWith(suffix)) return null;
    const subdomain = normalizedHost.slice(0, -suffix.length);
    if (!isTenantId(subdomain) || subdomain.includes('.')) return null;
    return subdomain;
  };
}

/**
 * Read-only production adapter. It exposes only Admin Auth token verification
 * and Firestore document get() calls; no write-capable API is used.
 */
export function createFirebaseAdminTenantContextDependencies(
  auth: Pick<Auth, 'verifyIdToken'>,
  firestore: Pick<Firestore, 'doc'>,
  resolveHostTenantHint: (host: string) => string | null,
): TenantContextDependencies {
  const readDocument = async (path: string): Promise<unknown | null> => {
    const snapshot = await firestore.doc(path).get();
    return snapshot.exists ? snapshot.data() ?? null : null;
  };

  return {
    verifyIdToken: async (token, checkRevoked) => (
      await auth.verifyIdToken(token, checkRevoked)
    ) as unknown as VerifiedFirebaseIdentity,
    readTenant: tenantId => readDocument(`tenants/${tenantId}`),
    readMembership: (tenantId, uid) => readDocument(`tenants/${tenantId}/members/${uid}`),
    resolveHostTenantHint,
  };
}
