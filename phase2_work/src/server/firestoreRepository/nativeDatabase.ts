import { TenantAwareFirestoreRepository } from '../../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { TenantAwareFirestoreRepository as VerifiedRequestRepository } from '../TenantAwareFirestoreRepository';
import { getApps, initializeApp } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  type Firestore,
} from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveFirebaseRuntime } from '../firebaseRuntime';
import { observeFirestoreTransaction } from '../observability';
import { z } from 'zod';
export { FieldValue };
let native: Firestore | null = null;
let initialization: Promise<void> | null = null;
let termination: Promise<void> | null = null;
function readConfig(): Record<string, unknown> {
  const path = resolve(process.cwd(), 'firebase-applet-config.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}
export function getServerFirebaseApp() {
  const { projectId } = resolveFirebaseRuntime(readConfig());
  return getApps()[0] ?? initializeApp(projectId ? { projectId } : undefined);
}
/** Native client is private infrastructure, never an application capability. */
function nativeDatabase(): Firestore {
  if (!native) {
    try {
      const app = getServerFirebaseApp(),
        { databaseId } = resolveFirebaseRuntime(readConfig());
      native = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    } catch (error) {
      throw new Error(
        'Firestore initialization failed; automatic local fallback is disabled.',
        { cause: error },
      );
    }
  }
  return native;
}
/** Test-fixture escape hatch: denies before SDK initialization outside loopback demo emulators. */
export function getEmulatorDatabase(): Firestore {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.K_SERVICE ||
    process.env.FUNCTION_TARGET ||
    process.env.VERCEL ||
    !/^(localhost|127\.0\.0\.1|\[::1\]):[0-9]+$/.test(
      process.env.FIRESTORE_EMULATOR_HOST ?? '',
    )
  )
    throw new Error('raw_database_requires_loopback_test_emulator');
  const { projectId } = resolveFirebaseRuntime(readConfig());
  if (!projectId?.startsWith('demo-'))
    throw new Error('raw_database_requires_demo_project');
  return nativeDatabase();
}
export function getInfrastructureRepository() {
  return new TenantAwareFirestoreRepository(
    nativeDatabase(),
    'default',
    observeRepositoryTransaction,
  );
}
export function createVerifiedRequestRepository(verifiedClaims: unknown) {
  return new VerifiedRequestRepository(
    nativeDatabase(),
    verifiedClaims,
    observeRepositoryTransaction,
  );
}
export async function initServerDb(): Promise<void> {
  if (!initialization)
    initialization = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          getInfrastructureRepository().read(
            'system/ping',
            z.record(z.string(), z.unknown()),
          ),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Firestore initialization timed out')),
              10_000,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    })();
  try {
    await initialization;
  } catch (error) {
    initialization = null;
    throw error;
  }
}
export function closeServerDb(): Promise<void> {
  return (termination ??= (async () => {
    await native?.terminate();
  })());
}
/** Native SDK transactions remain authoritative; spans do not expose transaction objects. */
export function observeRepositoryTransaction<T>(
  work: () => Promise<T>,
): Promise<T> {
  return observeFirestoreTransaction('runTransaction', work);
}
export function scopeServiceDatabase(
  database: Firestore | TenantAwareFirestoreRepository,
  domain: 'auth' | 'payments',
) {
  if (
    process.env[`KLAR_TENANT_${domain.toUpperCase()}_MIGRATION_READY`] !==
    'true'
  )
    throw new Error('tenant_' + domain + '_migration_not_ready');
  return database instanceof TenantAwareFirestoreRepository
    ? database
    : new TenantAwareFirestoreRepository(
        database,
        'default',
        observeRepositoryTransaction,
      );
}
export function getServiceRepository(domain: 'auth' | 'payments') {
  if (
    process.env[`KLAR_TENANT_${domain.toUpperCase()}_MIGRATION_READY`] !==
    'true'
  )
    throw new Error('tenant_' + domain + '_migration_not_ready');
  return scopeServiceDatabase(nativeDatabase(), domain);
}
/** CLI/maintenance capability: tenant is deployment configuration, not a request argument. */
export function getConfiguredMaintenanceRepository() {
  const tenant = process.env.KLAR_MAINTENANCE_TENANT_ID;
  if (
    process.env.KLAR_TENANT_MIGRATION_READY !== 'true' ||
    !tenant ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(tenant)
  )
    throw new Error('explicit_maintenance_tenant_required');
  return new TenantAwareFirestoreRepository(
    nativeDatabase(),
    tenant,
    observeRepositoryTransaction,
  );
}
