// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MemberReferralInventoryValidationFailure, type MemberReferralInventoryDiagnostic } from '../src/server/memberReferralMigrationInventory';
import {
  summarizePagedMemberReferralInventory,
  type MemberReferralInventoryPage,
} from '../src/server/memberReferralInventoryPages';

const row = (uid: string, referralCode: string) => ({ uid, referralCode });
const page = (
  index: number,
  previousCursor: string | null,
  nextCursor: string | null,
  terminal: boolean,
  records: readonly unknown[],
  scope = 'synthetic-snapshot-1',
): MemberReferralInventoryPage => ({
  index, previousCursor, nextCursor, terminal, records, scope,
});

describe('offline-only paged member-referral inventory integrity (P0 #48)', () => {
  it('counts collisions across separate valid pages without returning IDs, codes or cursors', async () => {
    const result = await summarizePagedMemberReferralInventory([
      page(0, null, 'cursor-a', false, [row('owner-a', 'ABCDEFGHIJ')]),
      page(1, 'cursor-a', null, true, [
        row('owner-b', 'ABCDEFGHIJ'), row('owner-c', 'ZYXWVUTSRQ'),
      ]),
    ]);
    expect(result).toMatchObject({
      coverage: 'provided_stream_only',
      pageChain: 'validated_supplied_pages_only',
      pagesRead: 2,
      recordsRead: 3,
      conflictingCodeGroups: 1,
      uniqueCodeGroups: 1,
      migrationAuthorized: false,
    });
    for (const secret of ['owner-a', 'owner-b', 'owner-c', 'ABCDEFGHIJ', 'cursor-a']) {
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  it('never certifies a true source inventory for a valid empty terminal page', async () => {
    const result = await summarizePagedMemberReferralInventory([
      page(0, null, null, true, []),
    ]);
    expect(result.recordsRead).toBe(0);
    expect(result.coverage).toBe('provided_stream_only');
    expect(result.migrationAuthorized).toBe(false);
    expect(result.pagesRead).toBe(1);
  });

  it.each([
    ['missing page', [
      page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]),
      page(2, 'cursor-a', null, true, [row('b', 'ZYXWVUTSRQ')]),
    ]],
    ['cursor gap', [
      page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]),
      page(1, 'unknown', null, true, [row('b', 'ZYXWVUTSRQ')]),
    ]],
    ['changed snapshot scope', [
      page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]),
      page(1, 'cursor-a', null, true, [row('b', 'ZYXWVUTSRQ')], 'other-snapshot'),
    ]],
    ['replayed continuation', [
      page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]),
      page(1, 'cursor-a', 'cursor-a', false, [row('b', 'ZYXWVUTSRQ')]),
      page(2, 'cursor-a', null, true, []),
    ]],
  ] as const)('rejects %s without producing a partial report', async (_name, pages) => {
    await expect(summarizePagedMemberReferralInventory(pages)).rejects.toThrow();
  });

  it('rejects a missing terminal even if all supplied rows look clean', async () => {
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]),
    ])).rejects.toThrow('member_referral_pages_incomplete');
  });

  it('rejects nonterminal empty page, dangling cursor and extra pages after terminal', async () => {
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, 'cursor-a', false, []),
      page(1, 'cursor-a', null, true, []),
    ])).rejects.toThrow('member_referral_pages_invalid_continuation');
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, 'cursor-a', true, [row('a', 'ABCDEFGHIJ')]),
    ])).rejects.toThrow('member_referral_pages_invalid_terminal');
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, null, true, []),
      page(1, null, null, true, []),
    ])).rejects.toThrow('member_referral_pages_overflow');
  });

  it('rejects too many pages or records and invalid limits', async () => {
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]),
      page(1, 'cursor-a', null, true, [row('b', 'ZYXWVUTSRQ')]),
    ], 50_000, 1)).rejects.toThrow('member_referral_pages_overflow');
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, null, true, [row('a', 'ABCDEFGHIJ'), row('b', 'ZYXWVUTSRQ')]),
    ], 1)).rejects.toThrow('member_referral_inventory_limit_exceeded');
    await expect(summarizePagedMemberReferralInventory([], 50_000, 1001))
      .rejects.toThrow('member_referral_pages_invalid_limit');
    await expect(summarizePagedMemberReferralInventory([
      page(0, null, null, true, Array.from({ length: 1001 }, (_, n) => row('u-' + n, 'ABCDEFGHIJ'))),
    ])).rejects.toThrow('member_referral_pages_integrity_failure');
  });

  it('redacts sensitive upstream iterator error messages and still fails closed', async () => {
    const sensitive = 'private-uid:owner-a/ref:ABCDEFGHIJ/cursor:cursor-a';
    async function* interrupted() {
      yield page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]);
      throw new Error('upstream scanner failure ' + sensitive);
    }
    let thrown: unknown;
    try {
      await summarizePagedMemberReferralInventory(interrupted());
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('member_referral_pages_source_failure');
    expect(JSON.stringify(thrown)).not.toContain(sensitive);
    expect(String((thrown as Error).stack)).not.toContain(sensitive);
    expect((thrown as Error).cause).toBeUndefined();
  });

  it('redacts even errors thrown as non-Error objects or spoofed diagnostic prefixes', async () => {
    async function* malicious() {
      throw { message: 'member_referral_pages_fake_code; uid=private' };
      yield page(0, null, null, true, []);
    }
    await expect(summarizePagedMemberReferralInventory(malicious()))
      .rejects.toThrow('member_referral_pages_source_failure');
  });

  it('does not trust a source error that spoofs an internal page diagnostic', async () => {
    async function* malicious() {
      throw new Error('member_referral_pages_incomplete');
      yield page(0, null, null, true, []);
    }
    await expect(summarizePagedMemberReferralInventory(malicious()))
      .rejects.toThrow('member_referral_pages_source_failure');
  });

  it('sanitizes an exported typed diagnostic with a spoofed secret code', async () => {
    const secret = 'user=private-account;code=ABCDEFGHIJ';
    async function* malicious() {
      throw new MemberReferralInventoryValidationFailure(
        secret as MemberReferralInventoryDiagnostic,
      );
      yield page(0, null, null, true, []);
    }
    let actual: unknown;
    try {
      await summarizePagedMemberReferralInventory(malicious());
    } catch (error) {
      actual = error;
    }
    expect(actual).toBeInstanceOf(Error);
    expect((actual as Error).message).toBe('member_referral_inventory_source_failure');
    expect(String((actual as Error).stack)).not.toContain(secret);
    expect((actual as Error).cause).toBeUndefined();
  });

  it('does not accept any pages missing a terminal marker', async () => {
    await expect(summarizePagedMemberReferralInventory([]))
      .rejects.toThrow('member_referral_pages_incomplete');
  });
});
