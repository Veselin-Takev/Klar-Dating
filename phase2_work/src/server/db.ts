import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { resolveFirebaseRuntime } from './firebaseRuntime';
import { createDurableDbProxy } from './durableStore';
import { observeFirestoreTransaction } from './observability';

export { FieldValue };

export function runObservedTransaction<T>(db: Firestore, name: string, fn: (tx: import('firebase-admin/firestore').Transaction) => Promise<T>): Promise<T> {
  return observeFirestoreTransaction(name, () => db.runTransaction(fn));
}

let realDbInstance: ReturnType<typeof getFirestore> | null = null;
let proxyDbInstance: Firestore | null = null;
let initialization: Promise<void> | null = null;

function durableFallbackAllowed(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true';
}
function readConfig(): Record<string, unknown> {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  return fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
}
export function getServerFirebaseApp() {
  const { projectId } = resolveFirebaseRuntime(readConfig());
  return getApps()[0] ?? initializeApp(projectId ? { projectId } : undefined);
}
export function getDb(): Firestore {
  if (!proxyDbInstance) {
    try {
      const app = getServerFirebaseApp();
      const { databaseId } = resolveFirebaseRuntime(readConfig());
      realDbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    } catch (err) {
      if (!durableFallbackAllowed()) throw new Error('Firestore initialization failed; durable fallback is disabled outside explicitly enabled non-production environments.', { cause: err });
      console.warn('Direct Firestore initialization failed; explicitly enabled non-production durable fallback is active:', err);
    }
    if (!realDbInstance && !durableFallbackAllowed()) throw new Error('Firestore is unavailable; durable fallback is disabled.');
    proxyDbInstance = (realDbInstance && typeof realDbInstance.runTransaction !== 'function')
      ? realDbInstance
      : createDurableDbProxy(realDbInstance) as unknown as Firestore;
  }
  return proxyDbInstance;
}
export async function initServerDb(): Promise<Firestore> {
  const db = getDb();
  if (!initialization) {
    initialization = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          db.collection('system').doc('ping').get(),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Firestore initialization timed out')), 10_000); }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })();
  }
  try { await initialization; } catch (error) { initialization = null; throw error; }
  return db;
}
