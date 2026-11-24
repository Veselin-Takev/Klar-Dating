// @node --test
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const auditScript = fileURLToPath(new URL('./audit-git-history-retention.mjs', import.meta.url));
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 30_000 });
  if (result.error || result.status !== 0) {
    throw Error(command + ' ' + args.join(' ') + ': ' + (result.stderr || result.error));
  }
  return result.stdout.trim();
}
test('complete Git history preserves deleted data even when main no longer contains the file', () => {
  const folder = mkdtempSync(join(tmpdir(), 'klar-git-retention-'));
  try {
    run('git', ['init', '-b', 'main'], folder);
    run('git', ['config', 'user.name', 'Klar CI'], folder);
    run('git', ['config', 'user.email', 'ci@example.invalid'], folder);
    writeFileSync(join(folder, 'README.md'), 'initial repository\n');
    run('git', ['add', '-A'], folder);
    run('git', ['commit', '-m', 'initial'], folder);
    writeFileSync(join(folder, 'archive.txt'), 'retain on another branch\n');
    run('git', ['add', '-A'], folder);
    run('git', ['commit', '-m', 'add archive'], folder);
    run('git', ['branch', 'archive'], folder);
    writeFileSync(join(folder, 'transient.txt'), 'still recoverable through an old commit\n');
    run('git', ['add', '-A'], folder);
    run('git', ['commit', '-m', 'add transient'], folder);
    run('git', ['rm', 'archive.txt', 'transient.txt'], folder);
    run('git', ['commit', '-m', 'delete files from main'], folder);
    writeFileSync(join(folder, '.gitignore'), '*.zip\nrelease/\n');
    writeFileSync(join(folder, 'release.SHA256SUMS'), '0'.repeat(64) + '  /mnt/data/missing-old-release.zip\n');
    run('git', ['add', '-A'], folder);
    run('git', ['commit', '-m', 'add checksum pointer'], folder);

    const output = join(folder, 'evidence', 'retention.json');
    const exec = spawnSync(process.execPath, [auditScript, '--repo=' + folder, '--report=' + output], {
      cwd: folder, encoding: 'utf8', timeout: 40_000,
    });
    assert.equal(exec.status, 0, exec.stdout + '\n' + exec.stderr);
    const report = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(report.verdict, 'REACHABLE_GIT_HISTORY_INTACT_WITH_EXTERNAL_LIMITATIONS');
    assert.equal(report.summary.fsckPassed, true);
    assert.equal(report.summary.missingGitObjects, 0);
    assert.equal(report.summary.mainTrackedPaths, 3);
    assert.ok(report.historicalPathInventory.includes('archive.txt'));
    assert.ok(report.historicalPathInventory.includes('transient.txt'));
    assert.ok(report.pathsAbsentFromMain.includes('archive.txt'));
    assert.ok(report.pathsAbsentFromMain.includes('transient.txt'));
    assert.ok(report.pathsOnlyInHistoricalCommits.includes('transient.txt'));
    assert.ok(!report.pathsOnlyInHistoricalCommits.includes('archive.txt'));
    assert.equal(report.references.localBranches, 2);
    assert.equal(report.summary.externalArchiveChecksumReferences, 1);
    assert.equal(report.referencedReleaseArchives[0].archiveName, 'missing-old-release.zip');
    assert.equal(report.referencedReleaseArchives[0].archiveEverTrackedInReachableGitHistory, false);
    assert.ok(readFileSync(output.replace(/\.json$/, '.md'), 'utf8').includes('External release evidence'));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
