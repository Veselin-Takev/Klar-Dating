import { getDb } from '../src/server/db';
import { toPublicProfile } from '../src/server/platform/launchPlatform';

// Read-only by default. Production application requires a reviewed backup and release approval.
const apply = process.argv.includes('--apply');
const db = getDb();
let cursor: string | undefined;
let inspected = 0, replaced = 0, removed = 0;
for (;;) {
  let query = db.collection('public_profiles').orderBy('__name__').limit(200);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  const batch = db.batch();
  for (const doc of page.docs) {
    const source = await db.collection('users').doc(doc.id).get();
    const safe = source.data()?.isVerified === true ? toPublicProfile(doc.id, source.data()) : null;
    inspected++;
    if (safe) { replaced++; if (apply) batch.set(doc.ref, safe); }
    else { removed++; if (apply) batch.delete(doc.ref); }
  }
  if (apply) await batch.commit();
  cursor = page.docs.at(-1)?.id;
}
console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', inspected, replaced, removed }));
await db.terminate();
