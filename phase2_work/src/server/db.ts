import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { resolveFirebaseRuntime } from './firebaseRuntime';
import { createDurableDbProxy } from './durableStore';

export { FieldValue };

let realDbInstance: ReturnType<typeof getFirestore> | null = null;
let proxyDbInstance: unknown = null;
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

/** Production must fail closed when Firestore is unavailable; local durable fallback is explicit and non-production only. */
export function getDb(): unknown {
  if (!proxyDbInstance) {
    try {
      const app = getServerFirebaseApp();
      const { databaseId } = resolveFirebaseRuntime(readConfig());
      realDbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    } catch (err) {
      if (!durableFallbackAllowed()) {
        throw new Error('Firestore initialization failed; durable fallback is disabled outside explicitly enabled non-production environments.', { cause: err });
      }
      console.warn('Direct Firestore initialization failed; explicitly enabled non-production durable fallback is active:', err);
    }
    // If initialization yielded no real Firestore instance, fail closed unless the
    // caller explicitly enabled the non-production durable fallback.
    if (!realDbInstance && !durableFallbackAllowed()) {
      throw new Error('Firestore is unavailable; durable fallback is disabled.');
    }
    // If realDbInstance is a mock double (e.g. in unit tests without runTransaction), return it directly.
    if (realDbInstance && typeof realDbInstance.runTransaction !== 'function') {
      proxyDbInstance = realDbInstance;
    } else {
      proxyDbInstance = createDurableDbProxy(realDbInstance);
    }
  }
  return proxyDbInstance;
}

export async function initServerDb() {
  const db = getDb();
  if (!initialization) {
    initialization = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const probeTarget = (realDbInstance && typeof realDbInstance.runTransaction !== 'function') ? realDbInstance : db;
        await Promise.race([
          probeTarget.collection('system').doc('ping').get(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Firestore initialization timed out')), 10_000);
          }),
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    })();
  }
  try {
    await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
  return db;
}
