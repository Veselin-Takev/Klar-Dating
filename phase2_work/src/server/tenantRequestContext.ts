import { z } from 'zod';
import { assertDefaultTenantClaims } from '../lib/defaultTenantBoundary';

const verifiedPrincipal = z.object({ uid: z.string().min(1).max(128).refine(uid => !/[\\/]/.test(uid)) });
export type TenantRequestContext = Readonly<{ tenant: 'default'; uid: string }>;

/** Call only after verifyIdToken(..., true); never pass headers, body or query. */
export function resolveVerifiedTenantContext(decodedToken: unknown): TenantRequestContext {
  assertDefaultTenantClaims(decodedToken);
  const { uid } = verifiedPrincipal.parse(decodedToken);
  return Object.freeze({tenant: 'default', uid});
}
