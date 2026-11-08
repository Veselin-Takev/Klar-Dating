import { getFirestore } from 'firebase-admin/firestore';
import { TenantAwareFirestoreRepository } from './TenantAwareFirestoreRepository';
/** Returns only a scoped capability. Database and tenant are explicit deployer configuration. */
export function openMaintenanceRepository(
  databaseId: string,
  tenantId: string,
): TenantAwareFirestoreRepository {
  if (!databaseId) throw new Error('Explicit maintenance database is required');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(tenantId))
    throw new Error('maintenance_tenant_required');
  return new TenantAwareFirestoreRepository(getFirestore(databaseId), tenantId);
}
