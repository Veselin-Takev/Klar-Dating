import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { getServerFirebaseApp, getDb } from '../db';

export const tenantIdSchema = z.string().regex(/^[a-z][a-z0-9-]{2,62}$/);
export const tenantRoleSchema = z.enum(['user', 'moderator', 'support', 'finance', 'admin', 'tenant_owner']);
export const tenantContextSchema = z.object({
  tenantId: tenantIdSchema,
  uid: z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/),
  roles: z.array(tenantRoleSchema).min(1),
  traceId: z.string().uuid(),
});
export type TenantContext = z.infer<typeof tenantContextSchema>;

// Runtime capability: callers may not invent a tenant context by casting a
// plain object. Only successful verify+membership issuance populates this set.
const issuedContexts = new WeakSet<object>();
export function assertIssuedTenantContext(value: unknown): TenantContext {
  if (value === null || typeof value !== 'object' || !issuedContexts.has(value) ||
      !tenantContextSchema.safeParse(value).success) throw new TenantAccessDenied(403);
  return value as TenantContext;
}

const verifiedClaimSchema = z.object({
  uid: tenantContextSchema.shape.uid,
  tenantId: tenantIdSchema,
  roles: z.array(tenantRoleSchema).min(1).max(8),
});
const tenantDocumentSchema = z.object({
  tenantId: tenantIdSchema,
  status: z.literal('active'),
});
const membershipSchema = z.object({
  tenantId: tenantIdSchema,
  uid: tenantContextSchema.shape.uid,
  status: z.literal('active'),
  roles: z.array(tenantRoleSchema).min(1).max(8),
});

export interface TenantAuthDependencies {
  verifyToken(token: string): Promise<unknown>;
  loadTenantAndMembership(tenantId: string, uid: string): Promise<{
    tenant: unknown;
    membership: unknown;
  }>;
}
export interface TenantRouting {
  authorization: unknown;
  headerTenant: unknown;
  hostname: string;
  trustedBaseDomain?: string;
  traceId: string;
}
export class TenantAccessDenied extends Error {
  constructor(readonly status: 401 | 403) { super('tenant_access_denied'); }
}
function routingHint(value: unknown): string | null {
  if (value == null) return null;
  const parsed = tenantIdSchema.safeParse(value);
  if (!parsed.success) throw new TenantAccessDenied(403);
  return parsed.data;
}
function subdomainHint(hostname: string, baseDomain: string | undefined): string | null {
  if (baseDomain === undefined) return null;
  if (!/^[a-z0-9.-]+$/.test(baseDomain) || baseDomain.includes('..')) throw new TenantAccessDenied(403);
  const host = hostname.toLowerCase();
  const suffix = '.' + baseDomain.toLowerCase();
  if (!host.endsWith(suffix)) return null;
  const prefix = host.slice(0, -suffix.length);
  return routingHint(prefix);
}

export async function authorizeTenant(input: TenantRouting, deps: TenantAuthDependencies): Promise<TenantContext> {
  if (typeof input.authorization !== 'string' ||
      !/^Bearer [A-Za-z0-9._~-]+$/.test(input.authorization)) {
    throw new TenantAccessDenied(401);
  }
  let claims: z.infer<typeof verifiedClaimSchema>;
  try {
    const decoded = await deps.verifyToken(input.authorization.slice(7));
    claims = verifiedClaimSchema.parse(decoded);
  } catch {
    throw new TenantAccessDenied(401);
  }
  const header = routingHint(input.headerTenant);
  const host = subdomainHint(input.hostname, input.trustedBaseDomain);
  if ((header !== null && header !== claims.tenantId) ||
      (host !== null && host !== claims.tenantId)) throw new TenantAccessDenied(403);

  let tenant: z.infer<typeof tenantDocumentSchema>;
  let membership: z.infer<typeof membershipSchema>;
  try {
    const records = await deps.loadTenantAndMembership(claims.tenantId, claims.uid);
    tenant = tenantDocumentSchema.parse(records.tenant);
    membership = membershipSchema.parse(records.membership);
  } catch {
    throw new TenantAccessDenied(403);
  }
  // Defend against a copied or incorrectly migrated membership/tenant record,
  // even when its Firestore document path is otherwise correctly scoped.
  if (tenant.tenantId !== claims.tenantId ||
      membership.tenantId !== claims.tenantId ||
      membership.uid !== claims.uid ||
      tenant.status !== 'active' || membership.status !== 'active') {
    throw new TenantAccessDenied(403);
  }
  // Neither a stale JWT nor an over-privileged membership record can grant a
  // role the other source lacks.
  const roles = claims.roles.filter(role => membership.roles.includes(role));
  if (!roles.length) throw new TenantAccessDenied(403);
  const result = tenantContextSchema.safeParse({
    tenantId: claims.tenantId, uid: claims.uid, roles, traceId: input.traceId,
  });
  if (!result.success) throw new TenantAccessDenied(403);
  Object.freeze(result.data.roles);
  Object.freeze(result.data);
  issuedContexts.add(result.data);
  return result.data;
}
export function firebaseTenantDependencies(db: Firestore = getDb()): TenantAuthDependencies {
  return {
    verifyToken: token => getAuth(getServerFirebaseApp()).verifyIdToken(token, true),
    async loadTenantAndMembership(tenantId, uid) {
      const [tenant, membership] = await Promise.all([
        db.doc('tenants/' + tenantId).get(),
        db.doc('tenants/' + tenantId + '/members/' + uid).get(),
      ]);
      return { tenant: tenant.data(), membership: membership.data() };
    },
  };
}
export function createTenantMiddleware(deps: TenantAuthDependencies, trustedBaseDomain?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = await authorizeTenant({
        authorization: req.headers.authorization,
        headerTenant: req.headers['x-tenant-id'],
        hostname: req.hostname,
        trustedBaseDomain,
        traceId: typeof req.headers['x-trace-id'] === 'string' &&
          z.string().uuid().safeParse(req.headers['x-trace-id']).success
          ? req.headers['x-trace-id'] : randomUUID(),
      }, deps);
      res.locals.tenantContext = context;
      next();
    } catch (error) {
      const status = error instanceof TenantAccessDenied ? error.status : 403;
      res.status(status).json({ code: 'tenant_access_denied' });
    }
  };
}
export function requireTenantContext(res: Response): TenantContext {
  return assertIssuedTenantContext(res.locals.tenantContext);
}
