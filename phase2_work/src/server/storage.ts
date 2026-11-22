import { getStorage } from 'firebase-admin/storage';
import { getServerFirebaseApp } from './db';
import { readFileSync } from 'node:fs';

export function getAppBucket() {
  const app = getServerFirebaseApp();
  const configuredAppBucket = typeof app.options.storageBucket === 'string'
    ? app.options.storageBucket.trim() : undefined;
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    if (!app.options.projectId?.startsWith('demo-')) throw new Error('Storage emulator requires a demo project');
    const emulatorBucket = `${app.options.projectId}.appspot.com`;
    if (configuredAppBucket !== undefined && configuredAppBucket !== emulatorBucket) {
      throw new Error('Existing Firebase Admin app Storage bucket disagrees with emulator project identity');
    }
    return getStorage(app).bucket(emulatorBucket);
  }
  const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8')) as Record<string, unknown>;
  const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const configProject = typeof config.projectId === 'string' ? config.projectId.trim() : '';
  const configuredBucket = typeof config.storageBucket === 'string' ? config.storageBucket.trim() : '';
  // A checked-in Web SDK config may belong to another Firebase project.
  // Never silently access its bucket from an explicitly selected staging app.
  if (!explicitBucket && (!app.options.projectId || configProject !== app.options.projectId)) {
    throw new Error('Storage bucket must be explicitly set for the selected Firebase project');
  }
  const name = explicitBucket || configuredBucket;
  if (!name || name.startsWith('gs://')) {
    throw new Error('Storage bucket is not configured as a bucket name');
  }
  if (configuredAppBucket !== undefined && configuredAppBucket !== name) {
    throw new Error('Existing Firebase Admin app Storage bucket disagrees with runtime selection');
  }
  return getStorage(app).bucket(name);
}
