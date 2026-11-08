import { getFirestore } from 'firebase-admin/firestore';

/** Infrastructure-only legacy factory; no tenant certification is implied. */
export function openMaintenanceDatabase(databaseId: string) {
  if (!databaseId) throw new Error('Explicit maintenance database is required');
  return getFirestore(databaseId);
}
