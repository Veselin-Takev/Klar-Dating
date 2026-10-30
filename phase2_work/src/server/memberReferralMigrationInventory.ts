/**
 * P0 #48: Pure, offline-only classification of a supplied legacy referral
 * snapshot. No Firestore client, network, logging, file access or writes.
 *
 * IMPORTANT: these are only aggregate findings for the PROVIDED stream.
 * An exhausted stream is not proof that all production accounts were covered.
 * Never use this report to trigger a backfill or grant an entitlement.
 */
export type MemberReferralInventory = Readonly<{
  coverage: 'provided_stream_only';
  recordsRead: number;
  profilesWithoutCode: number;
  malformedRecords: number;
  repeatedRows: number;
  uniqueCodeGroups: number;
  conflictingCodeGroups: number;
  inconsistentOwnerGroups: number;
  migrationAuthorized: false;
}>;

const ABSOLUTE_MAX_RECORDS = 100_000;
const CODE_PATTERN = /^[A-Z0-9_-]{10}$/;

function isUid(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && value !== '.'
    && value !== '..'
    && !value.includes('/');
}

export async function summarizeMemberReferralInventory(
  records: Iterable<unknown> | AsyncIterable<unknown>,
  maxRecords: number = 50_000,
): Promise<MemberReferralInventory> {
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > ABSOLUTE_MAX_RECORDS) {
    throw new Error('member_referral_inventory_invalid_limit');
  }

  // Transient, process-local integrity indexes. The result contains ONLY counts.
  // Batch/chunk callers must not claim global uniqueness from partial input.
  const ownerByCode = new Map<string, Set<string>>();
  const codesByOwner = new Map<string, Set<string>>();
  let recordsRead = 0;
  let profilesWithoutCode = 0;
  let malformedRecords = 0;
  let repeatedRows = 0;

  try {
    for await (const value of records) {
      recordsRead += 1;
      if (recordsRead > maxRecords) {
        // Do not return a misleading, partial "clean" report when truncated.
        throw new Error('member_referral_inventory_limit_exceeded');
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        malformedRecords += 1;
        continue;
      }

      const row = value as Record<string, unknown>;
      if (!isUid(row.uid)) {
        malformedRecords += 1;
        continue;
      }
      const uid = row.uid;
      const code = row.referralCode;
      if (code === undefined || code === null || code === '') {
        profilesWithoutCode += 1;
        continue;
      }
      if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
        malformedRecords += 1;
        continue;
      }

      let owners = ownerByCode.get(code);
      if (!owners) {
        owners = new Set<string>();
        ownerByCode.set(code, owners);
      }
      if (owners.has(uid)) repeatedRows += 1;
      owners.add(uid);
      let codes = codesByOwner.get(uid);
      if (!codes) {
        codes = new Set<string>();
        codesByOwner.set(uid, codes);
      }
      codes.add(code);
    }
  } catch (error) {
    // Source iterators and record getters may throw arbitrary messages containing
    // sensitive UIDs/codes. Never propagate an untrusted cause, text or stack.
    if (error instanceof Error && error.message === 'member_referral_inventory_limit_exceeded') {
      throw new Error('member_referral_inventory_limit_exceeded');
    }
    throw new Error('member_referral_inventory_source_failure');
  }

  let uniqueCodeGroups = 0;
  let conflictingCodeGroups = 0;
  for (const owners of ownerByCode.values()) {
    if (owners.size === 1) uniqueCodeGroups += 1;
    else conflictingCodeGroups += 1;
  }
  let inconsistentOwnerGroups = 0;
  for (const codes of codesByOwner.values()) {
    if (codes.size > 1) inconsistentOwnerGroups += 1;
  }

  return Object.freeze({
    coverage: 'provided_stream_only' as const,
    recordsRead,
    profilesWithoutCode,
    malformedRecords,
    repeatedRows,
    uniqueCodeGroups,
    conflictingCodeGroups,
    inconsistentOwnerGroups,
    migrationAuthorized: false as const,
  });
}
