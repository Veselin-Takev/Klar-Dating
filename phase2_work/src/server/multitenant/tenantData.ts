import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertIssuedTenantContext, type TenantContext } from './tenantAuth';

// The public API intentionally does NOT expose arbitrary collection/doc IDs.
// Cross-tenant isolation alone cannot prevent within-tenant BOLA on chats,
// KYC, payment objects, or other users' profiles.
const flagIdSchema = z.string().min(1).max(64).regex(/^[A-Z][A-Z0-9_]+$/);
export interface TenantReadRepository {
  getOwnProfile(): Promise<unknown>;
  getFeatureFlag(name: string): Promise<unknown>;
}
export function createTenantReadRepository(db: Firestore, context: TenantContext): TenantReadRepository {
  const identity = assertIssuedTenantContext(context);
  const prefix = 'tenants/' + identity.tenantId + '/';
  return Object.freeze({
    async getOwnProfile(): Promise<unknown> {
      const doc = await db.doc(prefix + 'users/' + identity.uid).get();
      const data: unknown = doc.data();
      if (!doc.exists) return null;
      // A moved or mislabelled document must fail closed, even at the
      // correct hierarchical path. Legacy unlabelled records are denied.
      const check = z.object({
        tenantId: z.literal(identity.tenantId),
        uid: z.literal(identity.uid),
      }).safeParse(data);
      if (!check.success) throw new Error('tenant_record_inconsistent');
      return data;
    },
    async getFeatureFlag(name: string): Promise<unknown> {
      const key = flagIdSchema.parse(name);
      const doc = await db.doc(prefix + 'featureFlags/' + key).get();
      if (!doc.exists) return null;
      // No raw Firestore record may escape this repository, including to a
      // caller that does not use the higher-level flag evaluation service.
      const parsed = z.object({
        tenantId: z.literal(identity.tenantId),
        status: z.literal('active'),
        enabled: z.boolean(),
      }).safeParse(doc.data());
      if (!parsed.success) throw new Error('tenant_record_inconsistent');
      return parsed.data;
    },
  });
}
