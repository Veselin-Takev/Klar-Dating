import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  openSync,
  closeSync,
  fsyncSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import {
  LocalRepositoryStore,
  assertLocalRepositoryMode,
} from './firestoreRepository/localStore';

// Deliberately JSON-only. SDK transforms, timestamps and Dates require the native emulator.
const document = z.record(z.string(), z.json());
const envelope = z
  .object({
    version: z.literal(1),
    tenant: z.string(),
    documents: z.record(z.string(), document),
  })
  .strict();
const digest = (value: string | null) =>
  value === null ? null : createHash('sha256').update(value).digest('hex');
/** Explicit development store; never reads or rewrites legacy root snapshots. */
export function createDurableTenantRepository(
  tenantId: string,
  directory = resolve(process.cwd(), '.data', 'tenant-repositories'),
): TenantAwareFirestoreRepository {
  assertLocalRepositoryMode();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(tenantId))
    throw new Error('tenant_id_invalid');
  const file = join(
    directory,
    'tenant-' + createHash('sha256').update(tenantId).digest('hex') + '.json',
  );
  const prefix = `tenants/${tenantId}/`;
  const original = existsSync(file) ? readFileSync(file, 'utf8') : null;
  let expected = digest(original);
  const loaded =
    original === null
      ? { version: 1 as const, tenant: tenantId, documents: {} }
      : envelope.parse(JSON.parse(original));
  if (
    loaded.tenant !== tenantId ||
    Object.keys(loaded.documents).some((path) => !path.startsWith(prefix))
  )
    throw new Error('durable_repository_foreign_snapshot');
  const initial = new Map(Object.entries(loaded.documents));
  const persist = (state: ReadonlyMap<string, Record<string, unknown>>) => {
    assertLocalRepositoryMode();
    if ([...state.keys()].some((path) => !path.startsWith(prefix)))
      throw new Error('durable_repository_foreign_write');
    const serialized = JSON.stringify(
      envelope.parse({
        version: 1,
        tenant: tenantId,
        documents: Object.fromEntries(state),
      }),
    );
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    // Lock + optimistic revision prevents silent overwrite by another instance/process.
    const lock = file + '.lock',
      pending = file + '.' + randomUUID() + '.tmp';
    const descriptor = openSync(lock, 'wx', 0o600);
    try {
      if (
        digest(existsSync(file) ? readFileSync(file, 'utf8') : null) !==
        expected
      )
        throw new Error('durable_repository_stale_snapshot');
      writeFileSync(pending, serialized, { mode: 0o600, flag: 'wx' });
      const written = openSync(pending, 'r');
      try {
        fsyncSync(written);
      } finally {
        closeSync(written);
      }
      renameSync(pending, file);
      expected = digest(serialized);
    } finally {
      closeSync(descriptor);
      unlinkSync(lock);
      if (existsSync(pending)) unlinkSync(pending);
    }
  };
  return new TenantAwareFirestoreRepository(
    new LocalRepositoryStore(initial, persist),
    tenantId,
  );
}
