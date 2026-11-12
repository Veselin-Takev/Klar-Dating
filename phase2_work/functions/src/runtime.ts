import { openMaintenanceRepository } from './firestoreRepository/nativeDatabase';
import { getStorage } from 'firebase-admin/storage';
import { defineString } from 'firebase-functions/params';

const databaseId = defineString('FIRESTORE_DATABASE_ID', {
  description:
    'Exact database ID used by the Klar API. Required; never infer the default database.',
});
const storageBucket = defineString('KLAR_STORAGE_BUCKET', {
  description: 'Exact Storage bucket used by the Klar API, without gs://.',
});
export function getMaintenanceBucket() {
  const name = storageBucket.value();
  if (!name)
    throw new Error('KLAR_STORAGE_BUCKET must match the Klar API bucket');
  return getStorage().bucket(name);
}
/** Scheduler tenant is deployer-controlled configuration, never payload data. */
export function getMaintenanceTenantId() {
  if (process.env.KLAR_TENANT_MIGRATION_READY !== 'true')
    throw new Error('tenant_migration_not_ready');
  const tenant = process.env.KLAR_MAINTENANCE_TENANT_ID;
  if (!tenant || !/^[A-Za-z0-9_-]{1,64}$/.test(tenant))
    throw new Error('maintenance_tenant_required');
  return tenant;
}
export function getMaintenanceRepository() {
  const tenant = getMaintenanceTenantId();
  const id = databaseId.value();
  if (!id)
    throw new Error('FIRESTORE_DATABASE_ID must match the Klar API database');
  return openMaintenanceRepository(id, tenant);
}
