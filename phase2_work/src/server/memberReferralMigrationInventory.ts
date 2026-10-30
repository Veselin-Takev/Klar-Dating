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

/**
 * Branded internal diagnostic; untrusted iterator errors must not be selected
 * by their message text (which can be spoofed by a data source).
 * Only the listed constant values may cross the inventory boundary.
 */
export type MemberReferralInventoryDiagnostic =
  | 'member_referral_inventory_invalid_limit'
  | 'member_referral_inventory_limit_exceeded'
  | 'member_referral_pages_overflow'
  | 'member_referral_pages_integrity_failure'
  | 'member_referral_pages_scope_changed'
  | 'member_referral_pages_invalid_terminal'
  | 'member_referral_pages_invalid_continuation'
  | 'member_referral_pages_incomplete'
  | 'member_referral_inventory_source_failure';

const KNOWN_INVENTORY_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  'member_referral_inventory_invalid_limit',
  'member_referral_inventory_limit_exceeded',
  'member_referral_pages_overflow',
  'member_referral_pages_integrity_failure',
  'member_referral_pages_scope_changed',
  'member_referral_pages_invalid_terminal',
  'member_referral_pages_invalid_continuation',
  'member_referral_pages_incomplete',
  'member_referral_inventory_source_failure',
]);

export class MemberReferralInventoryValidationFailure extends Error {
  readonly code: MemberReferralInventoryDiagnostic;

  constructor(code: MemberReferralInventoryDiagnostic) {
    // TypeScript types are erased at runtime. A caller-supplied iterator can
    // construct this exported class with an arbitrary string via JS/casts.
    // Never allow that raw string into Error.message or Error.stack.
    const fixedCode = KNOWN_INVENTORY_DIAGNOSTIC_CODES.has(code)
      ? code : 'member_referral_inventory_source_failure';
    super(fixedCode);
    this.name = 'MemberReferralInventoryValidationFailure';
    this.code = fixedCode;
    // Prevent later mutation or getter replacement on an exported error object.
    // The privacy boundary rethrows a fresh instance from this fixed value.
    Object.defineProperty(this, 'code', {
      value: fixedCode, enumerable: true, writable: false, configurable: false,
    });
  }
}

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
    throw new MemberReferralInventoryValidationFailure('member_referral_inventory_invalid_limit');
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
        throw new MemberReferralInventoryValidationFailure('member_referral_inventory_limit_exceeded');
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
    if (error instanceof MemberReferralInventoryValidationFailure) {
      // Reconstruct a fresh known-safe diagnostic; never propagate an
      // arbitrary upstream Error identified only by its message.
      throw new MemberReferralInventoryValidationFailure(error.code);
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
