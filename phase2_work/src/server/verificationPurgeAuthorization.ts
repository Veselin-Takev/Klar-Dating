import { z } from 'zod';
import type { TenantAwareFirestoreRepository } from '../../functions/src/firestoreRepository/TenantAwareFirestoreRepository';
import { assertDeletionNotHeld } from './deletionHolds';
import { timestampMillis } from '../../functions/src/firestoreRepository/runtimeSchemas';
const record = z.record(z.string(), z.unknown());

/** Account-specific proof, never a global env toggle. Clients cannot write plans
 * or evidence. No legacy/missing proof becomes implicit deletion authorization.
 * The staging/live all-writer and legal attestations remain release gates. */
export function verificationPurgeAuthorization(repo: TenantAwareFirestoreRepository, uid: string, requestId: string, lease: string | undefined, bucket: string) {
  return async (path: string, metadata: {generation?: string | number}) => {
    await repo.transaction(async tx => {
      const [job, plan, events] = await Promise.all([
        tx.read(`account_deletions/${uid}`, record),
        tx.read(`account_photo_purge_plans/${uid}`, record),
        tx.list('verification_events', record, {where:['uid','==',uid],limit:200}),
      ]);
      await assertDeletionNotHeld(tx, uid);
      const now = Date.now();
      if (!job || job.requestId !== requestId || job.status !== 'pending' || (lease && (job.lease !== lease || Number(job.leaseUntil) <= now))) throw new Error('deletion_lease_lost');
      if (!(timestampMillis(job.createdAt) > 0 && now - timestampMillis(job.createdAt) >= 61 * 60_000)) throw new Error('verification_photo_p0_fencing_unverified');
      if (!plan || plan.requestId !== requestId || plan.bucket !== bucket || plan.writerFenceVerified !== true || plan.legalApproved !== true || timestampMillis(plan.expiresAt) <= now || typeof plan.evidenceDigest !== 'string' || !/^[a-f0-9]{64}$/.test(plan.evidenceDigest)) throw new Error('verification_photo_p0_fencing_unverified');
      const evidence = events.filter(row => row.data.storagePath === path);
      if (events.length >= 200 || evidence.length !== 1) throw new Error('verification_provenance_unverified');
      const event = evidence[0]!.data;
      if (event.legalHold !== false || event.photoPurgeHold !== false || event.bucket !== bucket || String(event.generation) !== String(metadata.generation) || !['bestaetigt','abgelehnt','approved','rejected'].includes(String(event.entscheidung ?? event.status))) throw new Error('verification_provenance_unverified');
      tx.write(`verification_events/${evidence[0]!.id}`, record, { purgeIntentRequestId: requestId, purgeIntentGeneration: String(metadata.generation), purgeIntentAt: new Date() }, {merge:true});
    });
  };
}
