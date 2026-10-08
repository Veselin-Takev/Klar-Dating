import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { defineString } from 'firebase-functions/params';

const databaseId = defineString('FIRESTORE_DATABASE_ID', {
  description: 'Exact database ID used by the Klar API. Required; never infer the default database.',
});
const storageBucket = defineString('KLAR_STORAGE_BUCKET', {
  description: 'Exact Storage bucket used by the Klar API, without gs://.',
});
export function getMaintenanceBucket() {
  const name = storageBucket.value();
  if (!name) throw new Error('KLAR_STORAGE_BUCKET must match the Klar API bucket');
  return getStorage().bucket(name);
}
export function getMaintenanceDb() {
  const id = databaseId.value();
  if (!id) throw new Error('FIRESTORE_DATABASE_ID must match the Klar API database');
  return getFirestore(id);
}
