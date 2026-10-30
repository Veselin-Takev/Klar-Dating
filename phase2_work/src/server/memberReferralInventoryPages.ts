import {
  summarizeMemberReferralInventory,
  type MemberReferralInventory,
} from './memberReferralMigrationInventory';

/**
 * Locally supplied, paginated rows. The cursors and scope are opaque metadata
 * supplied by an approved upstream export; neither is returned or logged.
 */
export type MemberReferralInventoryPage = Readonly<{
  index: number;
  scope: string;
  previousCursor: string | null;
  nextCursor: string | null;
  terminal: boolean;
  records: readonly unknown[];
}>;

export type MemberReferralPageInventory = MemberReferralInventory & Readonly<{
  pagesRead: number;
  pageChain: 'validated_supplied_pages_only';
}>;

const ABSOLUTE_PAGE_LIMIT = 1000;
const ABSOLUTE_PAGE_RECORDS = 1000;

// Only fixed diagnostics may cross this privacy boundary. An upstream
// iterator may throw an Error containing a raw UID, code or cursor.
const SAFE_PAGE_ERROR_CODES = new Set([
  'member_referral_pages_overflow',
  'member_referral_pages_integrity_failure',
  'member_referral_pages_scope_changed',
  'member_referral_pages_invalid_terminal',
  'member_referral_pages_invalid_continuation',
  'member_referral_pages_incomplete',
  'member_referral_inventory_invalid_limit',
  'member_referral_inventory_limit_exceeded',
]);

function validCursor(cursor: unknown): cursor is string {
  return typeof cursor === 'string' && cursor.length > 0 && cursor.length <= 512;
}

/**
 * Validates continuity of supplied pages before returning count-only output.
 * Fail closed on gaps, replayed cursors, changed scope, missing final page and
 * oversized streams. It does NOT verify external Firestore source coverage,
 * a server-side point-in-time snapshot, or permission to run a migration.
 */
export async function summarizePagedMemberReferralInventory(
  pages: Iterable<MemberReferralInventoryPage> | AsyncIterable<MemberReferralInventoryPage>,
  maxRecords = 50_000,
  maxPages = 1000,
): Promise<MemberReferralPageInventory> {
  if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > ABSOLUTE_PAGE_LIMIT) {
    throw new Error('member_referral_pages_invalid_limit');
  }
  let pagesRead = 0;
  let expectedCursor: string | null = null;
  let scope: string | undefined;
  let terminal = false;
  const seenCursors = new Set<string>();

  async function* validatedRecords(): AsyncGenerator<unknown> {
    for await (const page of pages) {
      if (terminal || pagesRead >= maxPages) {
        throw new Error('member_referral_pages_overflow');
      }
      if (!page || typeof page !== 'object'
        || !Number.isSafeInteger(page.index) || page.index !== pagesRead
        || typeof page.scope !== 'string' || page.scope.length < 1
        || page.scope.length > 128
        || page.previousCursor !== expectedCursor
        || typeof page.terminal !== 'boolean'
        || !Array.isArray(page.records)
        || page.records.length > ABSOLUTE_PAGE_RECORDS) {
        throw new Error('member_referral_pages_integrity_failure');
      }
      if (scope === undefined) scope = page.scope;
      if (page.scope !== scope) throw new Error('member_referral_pages_scope_changed');

      if (page.terminal) {
        if (page.nextCursor !== null) {
          throw new Error('member_referral_pages_invalid_terminal');
        }
        terminal = true;
      } else {
        if (!validCursor(page.nextCursor) || seenCursors.has(page.nextCursor)
          || page.records.length === 0) {
          throw new Error('member_referral_pages_invalid_continuation');
        }
        seenCursors.add(page.nextCursor);
        expectedCursor = page.nextCursor;
      }

      pagesRead += 1;
      for (const record of page.records) yield record;
    }
    if (!terminal || pagesRead === 0) {
      throw new Error('member_referral_pages_incomplete');
    }
  }

  try {
    const counts = await summarizeMemberReferralInventory(validatedRecords(), maxRecords);
    return Object.freeze({
      ...counts,
      pagesRead,
      pageChain: 'validated_supplied_pages_only' as const,
    });
  } catch (error) {
    // Re-throw a fresh fixed diagnostic, never the upstream error object,
    // stack, cause or user-supplied message.
    if (error instanceof Error && SAFE_PAGE_ERROR_CODES.has(error.message)) {
      throw new Error(error.message);
    }
    throw new Error('member_referral_pages_source_failure');
  }
}
