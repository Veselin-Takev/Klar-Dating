import { createHash } from 'node:crypto';

export const LEGACY_TENANT_MAPPING_ENGINE_VERSION = '1.0.0';
const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export interface LegacyRecord {
  recordId: string;
  ownerUid?: string;
  participantUids?: string[];
  candidateTenantIds?: string[];
  participantTenantIds?: string[];
  [key: string]: unknown;
}

export interface ReviewedMappingEntry {
  recordId: string;
  tenantId: string;
  ownerUid: string;
  participantUids: string[];
  reviewed: true;
  evidenceRef: string;
}

export interface LegacyMappingManifest {
  schemaVersion: 1;
  entries: ReviewedMappingEntry[];
}

export type QuarantineReason =
  | 'MISSING_MAPPING'
  | 'AMBIGUOUS_MAPPING'
  | 'AMBIGUOUS_TENANT_CANDIDATES'
  | 'CONTRADICTORY_OWNER_EVIDENCE'
  | 'ORPHANED_RECORD'
  | 'INCOMPLETE_PARTICIPANT_EVIDENCE'
  | 'CROSS_TENANT_MULTI_PARTY'
  | 'FORBIDDEN_INFERENCE_ONLY'
  | 'DUPLICATE_MANIFEST_ENTRY'
  | 'INVALID_TENANT_ID'
  | 'INVALID_MAPPING_EVIDENCE'
  | 'DUPLICATE_RECORD_ID';

export type Classification =
  | Readonly<{ recordId: string; status: 'MAPPED'; tenantId: string; reasonCode: null }>
  | Readonly<{ recordId: string; status: 'UNMAPPED'; tenantId: null; reasonCode: QuarantineReason }>;

export interface MappingRunParameters {
  mode: 'offline-dry-run';
  allowNetwork: false;
  allowDatabase: false;
}

export interface MappingReportArtifacts {
  'mapping-report.json': string;
  'mapping-report.csv': string;
  'mapping-report.md': string;
  'manifest.sha256': string;
  'fixtures.sha256': string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));
}

function canonicalHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Structural manifest errors abort the entire dry-run; row collisions remain quarantined. */
export function validateLegacyMappingManifest(input: unknown): LegacyMappingManifest {
  if (!isObject(input) || input.schemaVersion !== 1 || !Array.isArray(input.entries)) {
    throw new Error('MALFORMED_MANIFEST: expected schemaVersion=1 and entries[]');
  }
  const entries: unknown[] = input.entries;
  for (const [index, entry] of entries.entries()) {
    if (!isObject(entry)
      || !nonEmptyString(entry.recordId)
      || !nonEmptyString(entry.tenantId)
      || !nonEmptyString(entry.ownerUid)
      || !Array.isArray(entry.participantUids)
      || !entry.participantUids.every(nonEmptyString)
      || entry.reviewed !== true
      || !nonEmptyString(entry.evidenceRef)) {
      throw new Error(`MALFORMED_MANIFEST: invalid row at index ${index}`);
    }
  }
  return input as unknown as LegacyMappingManifest;
}

/**
 * Pure, deterministic classifier. It never infers tenant authority from legacy identifiers.
 * The only path to MAPPED is one reviewed row-level entry whose evidence agrees exactly.
 */
export function classifyLegacyRecords(
  records: readonly LegacyRecord[],
  manifestInput: unknown,
): Classification[] {
  const manifest = validateLegacyMappingManifest(manifestInput);
  if (!Array.isArray(records) || records.some(record => !isObject(record) || !nonEmptyString(record.recordId))) {
    throw new Error('MALFORMED_FIXTURES: every record requires a non-empty recordId');
  }

  const manifestById = new Map<string, ReviewedMappingEntry[]>();
  for (const entry of manifest.entries) {
    const rows = manifestById.get(entry.recordId) ?? [];
    rows.push(entry);
    manifestById.set(entry.recordId, rows);
  }
  const recordCounts = new Map<string, number>();
  for (const record of records) recordCounts.set(record.recordId, (recordCounts.get(record.recordId) ?? 0) + 1);

  const results = records.map((record): Classification => {
    const unmapped = (reasonCode: QuarantineReason): Classification => ({
      recordId: record.recordId, status: 'UNMAPPED', tenantId: null, reasonCode,
    });
    if ((recordCounts.get(record.recordId) ?? 0) > 1) return unmapped('DUPLICATE_RECORD_ID');
    const rows = manifestById.get(record.recordId) ?? [];
    const hasAmbiguousTenantCandidates = Array.isArray(record.candidateTenantIds)
      && record.candidateTenantIds.every(nonEmptyString)
      && sortedUnique(record.candidateTenantIds).length > 1;
    if (rows.length === 0 && hasAmbiguousTenantCandidates) {
      return unmapped('AMBIGUOUS_TENANT_CANDIDATES');
    }
    if (rows.length === 0) {
      const hasOnlyForbiddenIdentifiers = ['uid', 'pairId', 'participantIds', 'providerId',
        'kycId', 'sessionId', 'emailHash', 'documentId', 'hostname', 'profileTenantId',
        'requestTenantId'].some(key => nonEmptyString(record[key]));
      return unmapped(hasOnlyForbiddenIdentifiers ? 'FORBIDDEN_INFERENCE_ONLY' : 'MISSING_MAPPING');
    }
    if (rows.length > 1) return unmapped('DUPLICATE_MANIFEST_ENTRY');
    const entry = rows[0];
    if (!entry) return unmapped('INVALID_MAPPING_EVIDENCE');

    if (!TENANT_ID_PATTERN.test(entry.tenantId)) return unmapped('INVALID_TENANT_ID');
    if (Array.isArray(record.candidateTenantIds) && sortedUnique(record.candidateTenantIds).length > 1) {
      return unmapped('AMBIGUOUS_TENANT_CANDIDATES');
    }
    if (!nonEmptyString(record.ownerUid)) return unmapped('ORPHANED_RECORD');
    if (!Array.isArray(record.participantUids) || record.participantUids.length < 1
      || !record.participantUids.every(nonEmptyString)
      || new Set(record.participantUids).size !== record.participantUids.length
      || !record.participantUids.includes(record.ownerUid)) {
      return unmapped('INCOMPLETE_PARTICIPANT_EVIDENCE');
    }
    if (Array.isArray(record.participantTenantIds)
      && record.participantTenantIds.some((value: unknown) => value !== entry.tenantId)) {
      return unmapped('CROSS_TENANT_MULTI_PARTY');
    }
    if (entry.ownerUid !== record.ownerUid) return unmapped('CONTRADICTORY_OWNER_EVIDENCE');
    if (sortedUnique(entry.participantUids).join('\0') !== sortedUnique(record.participantUids).join('\0')) {
      return unmapped('INCOMPLETE_PARTICIPANT_EVIDENCE');
    }
    if (entry.reviewed !== true || !nonEmptyString(entry.evidenceRef)) {
      return unmapped('INVALID_MAPPING_EVIDENCE');
    }
    return { recordId: record.recordId, status: 'MAPPED', tenantId: entry.tenantId, reasonCode: null };
  });

  return results.sort((a, b) => a.recordId.localeCompare(b.recordId, 'en'));
}

export function buildMappingReportArtifacts(
  classifications: readonly Classification[],
  inputHashes: Readonly<{ manifestSha256: string; fixturesSha256: string }>,
  runParameters: MappingRunParameters = {
    mode: 'offline-dry-run', allowNetwork: false, allowDatabase: false,
  },
): MappingReportArtifacts {
  const rows = [...classifications].sort((a, b) => a.recordId.localeCompare(b.recordId, 'en'));
  const mapped = rows.filter(row => row.status === 'MAPPED').length;
  const unmapped = rows.length - mapped;
  const reasonBreakdown = Object.fromEntries(
    [...new Set(rows.flatMap(row => row.reasonCode ? [row.reasonCode] : []))]
      .sort()
      .map(reason => [reason, rows.filter(row => row.reasonCode === reason).length]),
  );
  const conflictCount = rows.filter(row => [
    'AMBIGUOUS_MAPPING', 'AMBIGUOUS_TENANT_CANDIDATES', 'CONTRADICTORY_OWNER_EVIDENCE',
    'CROSS_TENANT_MULTI_PARTY', 'DUPLICATE_MANIFEST_ENTRY', 'DUPLICATE_RECORD_ID',
  ].includes(row.reasonCode ?? '')).length;
  const duplicateCount = rows.filter(row =>
    row.reasonCode === 'DUPLICATE_MANIFEST_ENTRY' || row.reasonCode === 'DUPLICATE_RECORD_ID').length;
  const summary = {
    engineVersion: LEGACY_TENANT_MAPPING_ENGINE_VERSION,
    runParameters,
    totals: { records: rows.length, mapped, unmapped },
    conflictCount,
    duplicateCount,
    quarantineReasonBreakdown: reasonBreakdown,
    classifications: rows,
    inputHashes: {
      manifestSha256: inputHashes.manifestSha256,
      fixturesSha256: inputHashes.fixturesSha256,
    },
  };
  const outputSha256 = canonicalHash(JSON.stringify(summary));
  const json = JSON.stringify({ ...summary, outputSha256 }, null, 2) + '\n';
  const csvEscape = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  const csv = [
    'recordId,status,tenantId,reasonCode',
    ...rows.map(row => [row.recordId, row.status, row.tenantId ?? '', row.reasonCode ?? '']
      .map(csvEscape).join(',')),
  ].join('\n') + '\n';
  const markdown = [
    '# Legacy Tenant Mapping — Offline Dry-Run',
    '',
    `- Engine version: ${LEGACY_TENANT_MAPPING_ENGINE_VERSION}`,
    `- Mode: ${runParameters.mode}`,
    '- Network access: disabled',
    '- Database access: disabled',
    `- Records: ${rows.length}`,
    `- MAPPED: ${mapped}`,
    `- UNMAPPED: ${unmapped}`,
    `- Conflicts: ${conflictCount}`,
    `- Duplicate/colliding rows: ${duplicateCount}`,
    `- Manifest SHA-256: ${inputHashes.manifestSha256}`,
    `- Fixtures SHA-256: ${inputHashes.fixturesSha256}`,
    `- Output SHA-256: ${outputSha256}`,
    '',
    '## Quarantine reason breakdown',
    '',
    '| Reason | Count |',
    '|---|---:|',
    ...Object.entries(reasonBreakdown).map(([reason, count]) => `| ${reason} | ${count} |`),
    '',
    '## Classifications',
    '',
    '| Record | Status | Tenant | Reason |',
    '|---|---|---|---|',
    ...rows.map(row => `| ${row.recordId} | ${row.status} | ${row.tenantId ?? '—'} | ${row.reasonCode ?? '—'} |`),
    '',
    'UNMAPPED records are quarantined. This report does not authorize migration or write-back.',
    '',
  ].join('\n');
  return {
    'mapping-report.json': json,
    'mapping-report.csv': csv,
    'mapping-report.md': markdown,
    'manifest.sha256': `${inputHashes.manifestSha256}  manifest.json\n`,
    'fixtures.sha256': `${inputHashes.fixturesSha256}  fixtures.json\n`,
  };
}
