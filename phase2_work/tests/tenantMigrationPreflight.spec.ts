// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { preflightLegacyProfileMapping } from '../src/server/multitenant/tenantMigrationPreflight';

const SHA = 'a'.repeat(64);
const OTHER_SHA = 'b'.repeat(64);
const EVIDENCE = 'c'.repeat(64);
const snapshotId = '00000000-0000-4000-8000-000000000001';
const good = () => ({
  inventory: {
    schemaVersion: 1, snapshotId,
    records: [
      { sourcePath: 'users/user_1', ownerUid: 'user_1', sourceSha256: SHA, deletionState: 'none' },
      { sourcePath: 'users/user_2', ownerUid: 'user_2', sourceSha256: OTHER_SHA, deletionState: 'none' },
    ],
  },
  mapping: {
    schemaVersion: 1, snapshotId,
    assignments: [
      { sourcePath: 'users/user_1', ownerUid: 'user_1', sourceSha256: SHA, tenantId: 'tenant-one', mappingEvidenceSha256: EVIDENCE },
      { sourcePath: 'users/user_2', ownerUid: 'user_2', sourceSha256: OTHER_SHA, tenantId: 'tenant-two', mappingEvidenceSha256: EVIDENCE },
    ],
  },
});
describe('read-only legacy profile migration preflight', () => {
  it('returns only a minimal, reproducible BLOCKED summary, never an approval', () => {
    const { inventory, mapping } = good();
    const report = preflightLegacyProfileMapping(inventory, mapping);
    expect(report.status).toBe('BLOCKED_MANUAL_APPROVAL_REQUIRED');
    expect(report.profileCount).toBe(2);
    expect(report.tenantCount).toBe(2);
    expect(report.reconciliationSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(report)).not.toContain('user_1');
    expect(preflightLegacyProfileMapping(inventory, mapping)).toEqual(report);
    expect(inventory.records).toHaveLength(2);
  });
  it('reconciles shuffled assignment order to the same evidence digest', () => {
    const { inventory, mapping } = good();
    const expected = preflightLegacyProfileMapping(inventory, mapping);
    mapping.assignments.reverse();
    expect(preflightLegacyProfileMapping(inventory, mapping)).toEqual(expected);
  });
  it('rejects absent or ambiguous mappings, including default-tenant guessing', () => {
    const { inventory, mapping } = good();
    mapping.assignments.pop();
    expect(() => preflightLegacyProfileMapping(inventory, mapping)).toThrow('migration_missing_mapping');
    mapping.assignments.push({ ...mapping.assignments[0], tenantId: 'default' });
    expect(() => preflightLegacyProfileMapping(inventory, mapping)).toThrow('migration_mapping_unverifiable');
  });
  it('rejects mismatched snapshots, source hashes, owner identities and record paths', () => {
    for (const variant of ['snapshot', 'hash', 'uid', 'path', 'unknown'] as const) {
      const { inventory, mapping } = good();
      if (variant === 'snapshot') mapping.snapshotId = '00000000-0000-4000-8000-000000000002';
      if (variant === 'hash') mapping.assignments[0].sourceSha256 = OTHER_SHA;
      if (variant === 'uid') mapping.assignments[0].ownerUid = 'user_2';
      if (variant === 'path') mapping.assignments[0].sourcePath = 'chats/chat_1';
      if (variant === 'unknown') mapping.assignments[0].sourcePath = 'users/user_3';
      expect(() => preflightLegacyProfileMapping(inventory, mapping)).toThrow();
    }
  });
  it('rejects duplicate inventory records and duplicate destination assignments', () => {
    const { inventory, mapping } = good();
    inventory.records.push({ ...inventory.records[0] });
    expect(() => preflightLegacyProfileMapping(inventory, mapping)).toThrow('migration_inventory_unverifiable');
    const second = good();
    second.mapping.assignments.push({ ...second.mapping.assignments[0] });
    expect(() => preflightLegacyProfileMapping(second.inventory, second.mapping)).toThrow('migration_mapping_unverifiable');
  });
  it('rejects records subject to erasure or legal hold instead of migrating them', () => {
    for (const deletionState of ['pending_erasure', 'legal_hold'] as const) {
      const { inventory, mapping } = good();
      inventory.records[0].deletionState = deletionState;
      expect(() => preflightLegacyProfileMapping(inventory, mapping)).toThrow('migration_inventory_unverifiable');
    }
  });
  it('rejects unknown schema keys, prototype keys, invalid digests and tenant IDs', () => {
    for (const mutate of [
      (v: ReturnType<typeof good>) => { Object.assign(v.mapping, { unexpected: true }); },
      (v: ReturnType<typeof good>) => { v.mapping.assignments[0].tenantId = '../other'; },
      (v: ReturnType<typeof good>) => { v.mapping.assignments[0].mappingEvidenceSha256 = 'not-a-digest'; },
      (v: ReturnType<typeof good>) => { Object.defineProperty(v.inventory, '__proto__', { value: { isAdmin: true }, enumerable: true }); },
    ]) {
      const values = good(); mutate(values);
      expect(() => preflightLegacyProfileMapping(values.inventory, values.mapping)).toThrow();
    }
  });
});
