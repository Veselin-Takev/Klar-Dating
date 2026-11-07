import { getStorage } from 'firebase-admin/storage';
import { getServerFirebaseApp } from './db';
import { readFileSync } from 'node:fs';

export function getAppBucket() {
  const app = getServerFirebaseApp();
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    if (!app.options.projectId?.startsWith('demo-')) throw new Error('Storage emulator requires a demo project');
    return getStorage(app).bucket(`${app.options.projectId}.appspot.com`);
  }
  const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8')) as Record<string, unknown>;
  const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  // A checked-in Web SDK config may belong to another Firebase project.
  // Never silently access its bucket from an explicitly selected staging app.
  if (!explicitBucket && (!app.options.projectId || config.projectId !== app.options.projectId)) {
    throw new Error('Storage bucket must be explicitly set for the selected Firebase project');
  }
  const name = explicitBucket || config.storageBucket;
  if (typeof name !== 'string' || !name.trim() || name.startsWith('gs://')) {
    throw new Error('Storage bucket is not configured as a bucket name');
  }
  return getStorage(app).bucket(name);
}
