import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildMappingReportArtifacts,
  classifyLegacyRecords,
  validateLegacyMappingManifest,
} from '../src/server/multitenant/legacyTenantMapping';

const fixtureDir = path.join(process.cwd(), 'tests/fixtures/tenant-mapping');
const records = JSON.parse(readFileSync(path.join(fixtureDir, 'fixtures.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

describe('P0 #254 Package 3 — deterministic legacy tenant mapping quarantine', () => {
  it('covers all 12 synthetic matrix cases with only the explicitly reviewed row mapped', () => {
    const results = classifyLegacyRecords(records, manifest);
    const byId = new Map(results.map(result => [result.recordId, result]));
    expect(byId.get('synthetic-mapped-001')).toMatchObject({ status: 'MAPPED', tenantId: 'tenant-alpha' });
    expect(byId.get('synthetic-missing-002')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'MISSING_MAPPING' });
    expect(byId.get('synthetic-ambiguous-003')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'AMBIGUOUS_TENANT_CANDIDATES' });
    expect(byId.get('synthetic-owner-conflict-004')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'CONTRADICTORY_OWNER_EVIDENCE' });
    expect(byId.get('synthetic-orphan-005')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'ORPHANED_RECORD' });
    expect(byId.get('synthetic-incomplete-006')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'INCOMPLETE_PARTICIPANT_EVIDENCE' });
    expect(byId.get('synthetic-cross-tenant-007')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'CROSS_TENANT_MULTI_PARTY' });
    expect(byId.get('synthetic-uid-only-008')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'FORBIDDEN_INFERENCE_ONLY' });
    expect(byId.get('synthetic-pair-only-009')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'FORBIDDEN_INFERENCE_ONLY' });
    expect(byId.get('synthetic-provider-only-010')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'FORBIDDEN_INFERENCE_ONLY' });
    expect(byId.get('synthetic-duplicate-011')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'DUPLICATE_MANIFEST_ENTRY' });
    expect(byId.get('synthetic-invalid-tenant-012')).toMatchObject({ status: 'UNMAPPED', reasonCode: 'INVALID_TENANT_ID' });
    expect(results).toHaveLength(12);
  });

  it('does not mutate fixture or manifest input', () => {
    const beforeRecords = JSON.stringify(records);
    const beforeManifest = JSON.stringify(manifest);
    classifyLegacyRecords(records, manifest);
    expect(JSON.stringify(records)).toBe(beforeRecords);
    expect(JSON.stringify(manifest)).toBe(beforeManifest);
  });

  it('never assigns a default tenant when no explicit mapping exists', () => {
    const result = classifyLegacyRecords([{ recordId: 'synthetic-no-default', uid: 'tenant-alpha' }], { schemaVersion: 1, entries: [] });
    expect(result[0]).toEqual({ recordId: 'synthetic-no-default', status: 'UNMAPPED', tenantId: null, reasonCode: 'FORBIDDEN_INFERENCE_ONLY' });
  });

  it('aborts closed on malformed manifest structure or malformed rows', () => {
    expect(() => validateLegacyMappingManifest({ schemaVersion: 1, entries: 'not-an-array' })).toThrow('MALFORMED_MANIFEST');
    expect(() => validateLegacyMappingManifest({ schemaVersion: 1, entries: [{ recordId: 'x' }] })).toThrow('MALFORMED_MANIFEST');
  });

  it('produces byte-identical report artifacts and hashes for repeated identical inputs', () => {
    const inputHashes = { manifestSha256: sha(JSON.stringify(manifest)), fixturesSha256: sha(JSON.stringify(records)) };
    const first = buildMappingReportArtifacts(classifyLegacyRecords(records, manifest), inputHashes);
    const second = buildMappingReportArtifacts(classifyLegacyRecords(records, manifest), inputHashes);
    expect(first).toEqual(second);
    for (const name of Object.keys(first) as Array<keyof typeof first>) {
      expect(sha(first[name])).toBe(sha(second[name]));
    }
  });

  it('fails closed for duplicate record identifiers and never maps colliding rows', () => {
    const duplicateRecords = [
      { recordId: 'synthetic-collision', ownerUid: 'synthetic-owner', participantUids: ['synthetic-owner'] },
      { recordId: 'synthetic-collision', ownerUid: 'synthetic-owner', participantUids: ['synthetic-owner'] },
    ];
    const result = classifyLegacyRecords(duplicateRecords, { schemaVersion: 1, entries: [] });
    expect(result.every(row => row.status === 'UNMAPPED' && row.reasonCode === 'DUPLICATE_RECORD_ID')).toBe(true);
  });

  it('keeps the engine and CLI free of Firebase, database, and network dependencies', () => {
    const engineSource = readFileSync(path.join(process.cwd(), 'src/server/multitenant/legacyTenantMapping.ts'), 'utf8');
    const cliSource = readFileSync(path.join(process.cwd(), 'scripts/tenant-mapping-dry-run.mjs'), 'utf8');
    for (const forbidden of ['firebase-admin', 'firebase/firestore', 'firebase/storage', 'node:http', 'node:https', 'fetch(']) {
      expect(engineSource).not.toContain(forbidden);
      expect(cliSource).not.toContain(forbidden);
    }
    expect(cliSource).not.toContain('--apply');
    expect(cliSource).toContain('node:fs/promises');
  });
});
