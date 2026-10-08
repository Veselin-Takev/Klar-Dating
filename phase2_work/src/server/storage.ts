import { getStorage } from 'firebase-admin/storage';
import { getServerFirebaseApp } from './db';
import { readFileSync } from 'node:fs';

export function getAppBucket() {
  const app = getServerFirebaseApp();
  if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    if (!app.options.projectId?.startsWith('demo-')) throw new Error('Storage emulator requires a demo project');
    return getStorage(app).bucket(`${app.options.projectId}.appspot.com`);
  }
  const config = JSON.parse(readFileSync('firebase-applet-config.json', 'utf8'));
  const name = process.env.FIREBASE_STORAGE_BUCKET || config.storageBucket;
  if (typeof name !== 'string' || !name) throw new Error('Storage bucket is not configured');
  return getStorage(app).bucket(name);
}
