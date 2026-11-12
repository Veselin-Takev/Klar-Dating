import { z } from 'zod';
import type { TenantTransaction } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';

const record = z.record(z.string(), z.unknown());
export class DeletionHold extends Error {
  constructor() { super('deletion_legal_hold'); this.name = 'DeletionHold'; }
}
function assertNotHeld(data: Record<string, unknown> | null): void {
  for (const key of ['legalHold', 'photoPurgeHold', 'retentionHold']) {
    if (data && Object.hasOwn(data, key) && data[key] !== false) throw new DeletionHold();
  }
}
/** Read hold-bearing documents inside every destructive accounting transaction.
 * A concurrent hold update conflicts with that transaction instead of being lost.
 * Oversized inventories require review; truncation must never authorize deletion. */
export async function assertDeletionNotHeld(tx: TenantTransaction, uid: string): Promise<void> {
  const [user, events, requests] = await Promise.all([
    tx.read(`users/${uid}`, record),
    tx.list('verification_events', record, { where: ['uid', '==', uid], limit: 200 }),
    tx.list('verification_requests', record, { where: ['uid', '==', uid], limit: 200 }),
  ]);
  if (events.length >= 200 || requests.length >= 200) throw new DeletionHold();
  assertNotHeld(user);
  for (const row of [...events, ...requests]) assertNotHeld(row.data);
}
