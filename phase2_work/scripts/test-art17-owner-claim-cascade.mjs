#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const root = process.cwd();
const relativeFiles = [
  'src/server/trustAndSafety.ts',
  'src/server/partnerReferralDeletion.ts',
  'src/server/deletionAccounting.ts',
  'src/server/accountDeletion.ts',
  'docs/DATA_RETENTION.md',
  'scripts/loeschkaskade.mjs',
  'scripts/check-art17-deletion-audit.mjs',
];
const work = mkdtempSync(join(tmpdir(), 'klar-art17-cascade-'));
const sourcePath = 'src/server/trustAndSafety.ts';
try {
  for (const relative of relativeFiles) {
    const destination = join(work, relative);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, relative), destination);
  }

  const original = readFileSync(join(work, sourcePath), 'utf8');
  const runGate = () => spawnSync(process.execPath, ['scripts/check-art17-deletion-audit.mjs', '0'], {
    cwd: work, encoding: 'utf8', timeout: 15000, env: { ...process.env },
  });
  const baseline = runGate();
  assert.equal(baseline.status, 0, `baseline gate failed: ${baseline.stderr || baseline.error}`);
  assert.match(baseline.stdout, /Art\. 17 deletion audit boundary: PASS/);

  const cases = [
    {
      name: 'duplicate owner cascade start boundary',
      from: 'const ownedReferrals =',
      to: '/* const ownedReferrals = */\n      const ownedReferrals =',
      expectedError: /owner referral cascade boundary markers must be unique/,
    },
    {
      name: 'duplicate owner cascade end boundary',
      from: "for (const field of ['ownerRef', 'buyerRef'])",
      to: "/* for (const field of ['ownerRef', 'buyerRef']) */\n    for (const field of ['ownerRef', 'buyerRef'])",
      expectedError: /owner referral cascade boundary markers must be unique/,
    },
    {
      name: 'missing owner cascade start boundary',
      from: 'const ownedReferrals =',
      to: 'const referralPage =',
      expectedError: /owner referral cascade boundaries missing or invalid/,
    },
    {
      name: 'missing owner cascade end boundary',
      from: "for (const field of ['ownerRef', 'buyerRef'])",
      to: "for (const field of ['ownerRef', 'customerRef'])",
      expectedError: /owner referral cascade boundaries missing or invalid/,
    },
    {
      name: 'missing transactional referral quarantine',
      from: 'await quarantineOwnedPartnerReferral(db, referral.ref, meineUid)',
      to: "Promise.resolve('already_deleting')",
      expectedError: /owner referral must be transactionally quarantined before buyer claims are purged/,
    },
    {
      name: 'missing referralId claim lookup',
      from: ".where('referralId', '==', referral.id)",
      to: ".where('buyerRef', '==', partnerUidRef)",
    },
    {
      name: 'delete referral parent before buyer claims',
      from: 'await referral.ref.delete();\n        recordDeletionProgress();',
      to: "await referral.ref.delete();\n        recordDeletionProgress();",
      modify: (source) => {
        const claim = "await loescheAbfrage(db.collection('partner_referral_buyer_claims')\n          .where('referralId', '==', referral.id));";
        const parent = 'await referral.ref.delete();';
        assert.ok(source.includes(claim) && source.includes(parent), 'expected cascade statements absent');
        return source.replace(claim, parent).replace(
          /await referral\.ref\.delete\(\);\n        recordDeletionProgress\(\);/,
          claim + '\n        recordDeletionProgress();',
        );
      },
    },
    {
      name: 'buyer-claim deletion not awaited',
      from: "await loescheAbfrage(db.collection('partner_referral_buyer_claims')",
      to: "void loescheAbfrage(db.collection('partner_referral_buyer_claims')",
    },
    {
      name: 'omit parent referral deletion',
      from: 'await referral.ref.delete();',
      to: 'void referral.id;',
    },
    {
      name: 'omit per-referral slice guard',
      from: 'for (const referral of ownedReferrals.docs) {\n        checkDeletionSlice();',
      to: 'for (const referral of ownedReferrals.docs) {',
      expectedError: /owner referral iteration must check deletion slice before each child purge/,
    },
    {
      name: 'omit post-child pre-parent slice guard',
      from: 'checkDeletionSlice();\n        // Do not remove the parent pointer',
      to: '// Do not remove the parent pointer',
      expectedError: /owner referral parent deletion must recheck slice after buyer-claim purge/,
    },
    {
      name: 'omit buyer-claim deletion',
      from: "await loescheAbfrage(db.collection('partner_referral_buyer_claims')\n          .where('referralId', '==', referral.id));",
      to: 'void referral.id;',
    },
  ];

  for (const item of cases) {
    assert.ok(original.includes(item.from), `fixture missing: ${item.name}`);
    const mutated = item.modify ? item.modify(original) : original.replace(item.from, item.to);
    assert.notEqual(mutated, original, `mutation did not change source: ${item.name}`);
    writeFileSync(join(work, sourcePath), mutated, 'utf8');
    const result = runGate();
    assert.equal(result.status, 1, `gate accepted invalid cascade: ${item.name}; ${result.stdout}`);
    assert.match(result.stderr, item.expectedError ?? /owner deletion must remove buyer claims by referralId before deleting referral parent/,
      `missing expected denial: ${item.name}; ${result.stderr}`);
    writeFileSync(join(work, sourcePath), original, 'utf8');
    console.log(`PASS negative: ${item.name}`);
  }
  console.log('PASS: owner-claim Art. 17 static gate mutation regression (12 cases)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
