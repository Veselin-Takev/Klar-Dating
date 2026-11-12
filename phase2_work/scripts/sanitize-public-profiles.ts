import {
  getConfiguredMaintenanceRepository,
  closeServerDb,
} from '../src/server/firestoreRepository/nativeDatabase';
import { z } from 'zod';
const schema = z.record(z.string(), z.unknown());
import { toPublicProfile } from '../src/server/platform/launchPlatform';

// Read-only by default. Production application requires a reviewed backup and release approval.
const apply = process.argv.includes('--apply');
const db = getConfiguredMaintenanceRepository();
let cursor: string | undefined;
let inspected = 0,
  replaced = 0,
  removed = 0;
for (;;) {
  const page = await db.list('public_profiles', schema, {
    orderBy: '__name__',
    limit: 200,
    ...(cursor ? { startAfter: cursor } : {}),
  });
  if (!page.length) break;
  for (const row of page) {
    inspected++;
    const source = await db.read(`users/${row.id}`, schema);
    const safe =
      source?.isVerified === true ? toPublicProfile(row.id, source) : null;
    if (safe) replaced++;
    else removed++;
    if (apply)
      await db.transaction(async (tx) => {
        const [current, deletion] = await Promise.all([
          tx.read(`users/${row.id}`, schema),
          tx.read(`account_deletions/${row.id}`, schema),
        ]);
        const projection =
          !deletion && current?.isVerified === true
            ? toPublicProfile(row.id, current)
            : null;
        if (projection)
          tx.write(`public_profiles/${row.id}`, schema, projection);
        else tx.delete(`public_profiles/${row.id}`);
      });
  }
  cursor = page.at(-1)?.id;
}
console.log(
  JSON.stringify({
    mode: apply ? 'applied' : 'dry-run',
    inspected,
    replaced,
    removed,
  }),
);
await closeServerDb();
