// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { summarizeMemberReferralInventory } from '../src/server/memberReferralMigrationInventory';

describe('offline member referral legacy inventory (P0 #48)', () => {
  it('counts only aggregated unique and conflicting groups and never approves migration', async () => {
    const report = await summarizeMemberReferralInventory([
      { uid: 'owner-alpha', referralCode: 'ABCDEFGHIJ' },
      { uid: 'owner-beta', referralCode: 'ABCDEFGHIJ' },
      { uid: 'owner-gamma', referralCode: '12_45-7890' },
      { uid: 'no-code' },
    ]);
    expect(report).toEqual({
      coverage: 'provided_stream_only',
      recordsRead: 4,
      profilesWithoutCode: 1,
      malformedRecords: 0,
      repeatedRows: 0,
      uniqueCodeGroups: 1,
      conflictingCodeGroups: 1,
      inconsistentOwnerGroups: 0,
      migrationAuthorized: false,
    });
    const serialized = JSON.stringify(report);
    for (const sensitive of ['owner-alpha', 'owner-beta', 'owner-gamma', 'ABCDEFGHIJ', '12_45-7890']) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it('does not confuse repeated rows for one owner with colliding owners', async () => {
    const report = await summarizeMemberReferralInventory([
      { uid: 'a', referralCode: 'ABCDEFGHIJ' },
      { uid: 'a', referralCode: 'ABCDEFGHIJ' },
      { uid: 'b', referralCode: 'Z9Y8X7W6V5' },
    ]);
    expect(report.repeatedRows).toBe(1);
    expect(report.uniqueCodeGroups).toBe(2);
    expect(report.conflictingCodeGroups).toBe(0);
    expect(report.migrationAuthorized).toBe(false);
  });

  it('detects a single owner with inconsistent legacy codes across supplied records', async () => {
    const report = await summarizeMemberReferralInventory([
      { uid: 'owner', referralCode: 'ABCDEFGHIJ' },
      { uid: 'owner', referralCode: 'ZYXWVUTSRQ' },
    ]);
    expect(report.inconsistentOwnerGroups).toBe(1);
    expect(report.uniqueCodeGroups).toBe(2);
    expect(report.migrationAuthorized).toBe(false);
  });

  it('classifies missing, malformed, path-like and unsupported codes without exporting contents', async () => {
    const report = await summarizeMemberReferralInventory([
      { uid: 'a', referralCode: '' },
      { uid: 'b', referralCode: null },
      { uid: 'c', referralCode: 'abcdefghij' },
      { uid: 'd', referralCode: 'ABCDEFGHI!' },
      { uid: 'x/y', referralCode: 'ABCDEFGHIJ' },
      { uid: 'e', referralCode: 123 },
      {},
      null,
      [],
    ]);
    expect(report.recordsRead).toBe(9);
    expect(report.profilesWithoutCode).toBe(2);
    expect(report.malformedRecords).toBe(7);
    expect(report.uniqueCodeGroups).toBe(0);
    expect(Object.keys(report)).not.toContain('uid');
    expect(Object.keys(report)).not.toContain('code');
  });

  it('rejects invalid limits and any truncated stream without partial success output', async () => {
    await expect(summarizeMemberReferralInventory([], 0))
      .rejects.toThrow('member_referral_inventory_invalid_limit');
    await expect(summarizeMemberReferralInventory([], 100_001))
      .rejects.toThrow('member_referral_inventory_invalid_limit');
    await expect(summarizeMemberReferralInventory([
      { uid: 'a', referralCode: 'ABCDEFGHIJ' },
      { uid: 'b', referralCode: 'ZYXWVUTSRQ' },
    ], 1)).rejects.toThrow('member_referral_inventory_limit_exceeded');
  });

  it('propagates an interrupted source stream rather than returning a false clean report', async () => {
    async function* interrupted() {
      yield { uid: 'a', referralCode: 'ABCDEFGHIJ' };
      throw new Error('synthetic_input_interrupted');
    }
    await expect(summarizeMemberReferralInventory(interrupted()))
      .rejects.toThrow('synthetic_input_interrupted');
  });

  it('never declares full coverage or migration approval even for an empty stream', async () => {
    const report = await summarizeMemberReferralInventory([]);
    expect(report.coverage).toBe('provided_stream_only');
    expect(report.recordsRead).toBe(0);
    expect(report.migrationAuthorized).toBe(false);
  });
});
