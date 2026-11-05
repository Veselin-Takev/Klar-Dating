// @node --test
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { digestArchive, verifyManifestPair } from './check-legacy-release-archive.mjs';

const cli = fileURLToPath(new URL('./check-legacy-release-archive.mjs', import.meta.url));
const archiveName = 'Klar_Enterprise_Final_15.09.2026.zip';
const pinnedSha = '36b2a3ac3953cecc0bbfecbf7ca7f7cc2dd0e39f118820a51591bcce97725aac';

function fixture(pinned = false) {
  const dir = mkdtempSync(join(tmpdir(), 'klar-ves10-'));
  const manifest = join(dir, 'Klar_Enterprise_Final_15.09.2026.SHA256SUMS');
  const second = join(dir, 'phase2_work', 'Klar_Enterprise_Final_15.09.2026.SHA256SUMS');
  const archive = join(dir, archiveName);
  // Deliberately not a real historical release archive.
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
  const fixtureSha = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(dirname(second), { recursive: true });
  const entry = (pinned ? pinnedSha : fixtureSha) + '  /mnt/data/' + archiveName + '\n';
  writeFileSync(manifest, entry);
  writeFileSync(second, entry);
  writeFileSync(archive, bytes);
  return { dir, manifest, second, archive, bytes, fixtureSha };
}
function run(f, args = []) {
  const output = join(f.dir, 'audit', 'result.json');
  const p = spawnSync(process.execPath, [cli, '--repo=' + f.dir, '--report=' + output, ...args], {
    encoding: 'utf8', timeout: 20000,
  });
  assert.equal(p.error, undefined);
  return { exit: p.status, report: JSON.parse(readFileSync(output, 'utf8')) };
}
function dispose(f) {
  rmSync(f.dir, { recursive: true, force: true });
}

test('a synthetic ZIP can test pure SHA helpers but never claims original release custody', async () => {
  const f = fixture();
  try {
    const first = readFileSync(f.manifest, 'utf8');
    const second = readFileSync(f.second, 'utf8');
    assert.equal(verifyManifestPair(first, second, f.fixtureSha), f.fixtureSha);
    const actual = await digestArchive(f.archive);
    assert.deepEqual(actual, { sha256: f.fixtureSha, sizeBytes: f.bytes.length });
    const cliResult = run(f, ['--archive=' + f.archive]);
    assert.equal(cliResult.exit, 1);
    assert.equal(cliResult.report.reason, 'historical_release_digest_changed');
    assert.ok(!JSON.stringify(cliResult.report).includes(f.dir));
  } finally { dispose(f); }
});

test('matching historical checksum manifests are NOT proof of the ZIP bytes', () => {
  const f = fixture(true);
  try {
    const a = run(f, ['--manifests-only']);
    assert.equal(a.exit, 0);
    assert.equal(a.report.verdict, 'MANIFESTS_CONSISTENT_ARCHIVE_UNVERIFIED');
    assert.equal(a.report.expectedSha256, pinnedSha);
    assert.equal(a.report.archiveSha256, null);
    assert.equal(a.report.reason, 'archive_not_provided');
  } finally { dispose(f); }
});

test('archive bytes that do not match pinned historical digest fail without rewriting manifests', () => {
  const f = fixture(true);
  try {
    const before = readFileSync(f.manifest, 'utf8');
    writeFileSync(f.archive, Buffer.concat([f.bytes, Buffer.from('tampered')]));
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.reason, 'archive_sha256_mismatch');
    assert.equal(readFileSync(f.manifest, 'utf8'), before);
  } finally { dispose(f); }
});

test('conflicting source manifests fail before reading any archive', () => {
  const f = fixture(true);
  try {
    writeFileSync(f.second, '0'.repeat(64) + '  ' + archiveName + '\n');
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.reason, 'source_manifests_disagree');
  } finally { dispose(f); }
});

test('coordinated rewriting of both historical manifests cannot reset the pinned digest', () => {
  const f = fixture();
  try {
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.reason, 'historical_release_digest_changed');
    assert.equal(a.report.archiveSha256, null);
  } finally { dispose(f); }
});

test('missing archive and missing archive argument fail closed', () => {
  const f = fixture(true);
  try {
    const missingArgument = run(f);
    assert.equal(missingArgument.exit, 1);
    assert.equal(missingArgument.report.reason, 'archive_argument_required_or_conflicts_with_manifests_only');
    rmSync(f.archive);
    const noFile = run(f, ['--archive=' + f.archive]);
    assert.equal(noFile.exit, 1);
    assert.equal(noFile.report.verdict, 'FAIL');
  } finally { dispose(f); }
});

test('symlink in the final archive path is rejected without reading the target', () => {
  const f = fixture(true);
  try {
    const target = join(f.dir, 'real.zip');
    writeFileSync(target, f.bytes);
    rmSync(f.archive);
    symlinkSync(target, f.archive);
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.verdict, 'FAIL');
  } finally { dispose(f); }
});

test('a substituted path with the same basename cannot redefine historical manifest provenance', () => {
  const f = fixture(true);
  try {
    const content = pinnedSha + '  /untrusted/copy/' + archiveName + '\n';
    writeFileSync(f.manifest, content);
    writeFileSync(f.second, content);
    const a = run(f, ['--manifests-only']);
    assert.equal(a.exit, 1);
    assert.equal(a.report.reason, 'invalid_manifest_format_or_filename');
  } finally { dispose(f); }
});

test('a substituted archive filename is rejected before reading any contents', () => {
  const f = fixture(true);
  try {
    const different = join(f.dir, 'substitute.zip');
    writeFileSync(different, f.bytes);
    const a = run(f, ['--archive=' + different]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.reason, 'archive_filename_mismatch');
  } finally { dispose(f); }
});
