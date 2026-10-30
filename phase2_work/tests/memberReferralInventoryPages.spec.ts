// @vitest-environment node
import { describe, expect, it } from 'vitest';
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

  it('propagates interrupted asynchronous page sources without partial success', async () => {
    async function* interrupted() {
      yield page(0, null, 'cursor-a', false, [row('a', 'ABCDEFGHIJ')]);
      throw new Error('offline_fixture_io_interrupted');
    }
    await expect(summarizePagedMemberReferralInventory(interrupted()))
      .rejects.toThrow('offline_fixture_io_interrupted');
  });

  it('does not accept any pages missing a terminal marker', async () => {
    await expect(summarizePagedMemberReferralInventory([]))
      .rejects.toThrow('member_referral_pages_incomplete');
  });
});
