import { createHash } from 'node:crypto';
import { z } from 'zod';

// Profile-only, read-only preflight. No Firebase Admin or storage write API is
// imported: missing owner provenance blocks all future migration stages.
const uidSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const tenantIdSchema = z.string().regex(/^[a-z][a-z0-9-]{2,62}$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const profilePathSchema = z.string().min(7).max(134).regex(/^users\/[A-Za-z0-9_-]{1,128}$/);
const inventoryRecordSchema = z.strictObject({
  sourcePath: profilePathSchema,
  ownerUid: uidSchema,
  sourceSha256: digestSchema,
  deletionState: z.enum(['none', 'pending_erasure', 'legal_hold']),
});
const mappingEntrySchema = z.strictObject({
  sourcePath: profilePathSchema,
  ownerUid: uidSchema,
  sourceSha256: digestSchema,
  tenantId: tenantIdSchema,
  mappingEvidenceSha256: digestSchema,
});
const inventorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  snapshotId: z.string().uuid(),
  records: z.array(inventoryRecordSchema).nonempty().max(10000),
});
const mappingSchema = z.strictObject({
  schemaVersion: z.literal(1),
  snapshotId: z.string().uuid(),
  assignments: z.array(mappingEntrySchema).nonempty().max(10000),
});
type Inventory = z.infer<typeof inventorySchema>;
type Mapping = z.infer<typeof mappingSchema>;
export type LegacyProfileInventory = Inventory;
export type LegacyTenantAssignments = Mapping;

export interface TenantMigrationPreflightReport {
  readonly status: 'BLOCKED_MANUAL_APPROVAL_REQUIRED';
  readonly schemaVersion: 1;
  readonly profileCount: number;
  readonly tenantCount: number;
  readonly reconciliationSha256: string;
}

/** Strict offline reconciliation only; a digest is NOT a verified signature. */
export function preflightLegacyProfileMapping(
  rawInventory: unknown, rawMapping: unknown,
): TenantMigrationPreflightReport {
  const inventory = inventorySchema.parse(rawInventory);
  const mapping = mappingSchema.parse(rawMapping);
  if (inventory.snapshotId !== mapping.snapshotId) {
    throw new Error('migration_snapshot_mismatch');
  }

  const records = new Map<string, Inventory['records'][number]>();
  for (const record of inventory.records) {
    if (record.ownerUid !== record.sourcePath.slice('users/'.length) ||
        record.deletionState !== 'none' || records.has(record.sourcePath)) {
      throw new Error('migration_inventory_unverifiable');
    }
    records.set(record.sourcePath, record);
  }

  const assignments = new Map<string, Mapping['assignments'][number]>();
  const destinations = new Set<string>();
  for (const assignment of mapping.assignments) {
    const original = records.get(assignment.sourcePath);
    if (!original || assignments.has(assignment.sourcePath) ||
        original.ownerUid !== assignment.ownerUid ||
        original.sourceSha256 !== assignment.sourceSha256) {
      throw new Error('migration_mapping_unverifiable');
    }
    const destination = 'tenants/' + assignment.tenantId + '/users/' + assignment.ownerUid;
    if (destinations.has(destination)) throw new Error('migration_destination_conflict');
    destinations.add(destination);
    assignments.set(assignment.sourcePath, assignment);
  }
  if (assignments.size !== records.size) throw new Error('migration_missing_mapping');

  // Sort by source path; no UID, path, evidence or raw profile data is returned
  // or logged. This fingerprint allows human reviewers to compare snapshots.
  const canonical = [...assignments.values()]
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'en'))
    .map(a => [
      a.sourcePath, a.sourceSha256, a.ownerUid, a.tenantId, a.mappingEvidenceSha256,
    ]);
  const reconciliationSha256 = createHash('sha256')
    .update(JSON.stringify([inventory.snapshotId, canonical]), 'utf8')
    .digest('hex');
  return Object.freeze({
    status: 'BLOCKED_MANUAL_APPROVAL_REQUIRED' as const,
    schemaVersion: 1 as const,
    profileCount: records.size,
    tenantCount: new Set(mapping.assignments.map(x => x.tenantId)).size,
    reconciliationSha256,
  });
}
