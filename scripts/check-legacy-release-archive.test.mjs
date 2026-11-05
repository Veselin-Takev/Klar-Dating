// @node --test
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('./check-legacy-release-archive.mjs', import.meta.url));
const archiveName = 'Klar_Enterprise_Final_15.09.2026.zip';
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'klar-ves10-'));
  const manifest = join(dir, 'Klar_Enterprise_Final_15.09.2026.SHA256SUMS');
  const second = join(dir, 'phase2_work', 'Klar_Enterprise_Final_15.09.2026.SHA256SUMS');
  const archive = join(dir, archiveName);
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
  const hash = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(dirname(second), { recursive: true });
  const entry = hash + '  /mnt/data/' + archiveName + '\n';
  writeFileSync(manifest, entry); writeFileSync(second, entry); writeFileSync(archive, bytes);
  return { dir, manifest, second, archive, bytes, hash };
}
function run(f, args = []) {
  const path = join(f.dir, 'audit', 'result.json');
  const p = spawnSync(process.execPath, [cli, '--repo=' + f.dir, '--report=' + path, ...args], {
    encoding: 'utf8', timeout: 20000,
  });
  assert.equal(p.error, undefined);
  return { exit: p.status, report: JSON.parse(readFileSync(path, 'utf8')) };
}

test('valid fixture bytes match BOTH manifests but do not prove historical provenance', () => {
  const f = fixture();
  try {
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 0);
    assert.equal(a.report.verdict, 'ARCHIVE_BYTES_MATCH_MANIFESTS_CUSTODY_UNVERIFIED');
    assert.equal(a.report.expectedSha256, f.hash);
    assert.equal(a.report.archiveSha256, f.hash);
    assert.equal(a.report.archiveSizeBytes, f.bytes.length);
    assert.ok(!JSON.stringify(a.report).includes(f.dir), 'do not persist a local absolute archive path');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('manifest consistency alone is NOT proof of original archive availability', () => {
  const f = fixture();
  try {
    const a = run(f, ['--manifests-only']);
    assert.equal(a.exit, 0);
    assert.equal(a.report.verdict, 'MANIFESTS_CONSISTENT_ARCHIVE_UNVERIFIED');
    assert.equal(a.report.archiveSha256, null);
    assert.equal(a.report.reason, 'archive_not_provided');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('tampered ZIP bytes fail without extracting or rewriting original manifest', () => {
  const f = fixture();
  try {
    const manifestBefore = readFileSync(f.manifest, 'utf8');
    writeFileSync(f.archive, Buffer.concat([f.bytes, Buffer.from('tampered')]));
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.verdict, 'FAIL');
    assert.equal(a.report.reason, 'archive_sha256_mismatch');
    assert.equal(readFileSync(f.manifest, 'utf8'), manifestBefore);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('conflicting source manifests always fail even if supplied archive matches one', () => {
  const f = fixture();
  try {
    writeFileSync(f.second, '0'.repeat(64) + '  ' + archiveName + '\n');
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.reason, 'source_manifests_disagree');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('no archive argument or missing archive must fail closed, not claim retention success', () => {
  const f = fixture();
  try {
    assert.equal(run(f).exit, 1);
    rmSync(f.archive);
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.verdict, 'FAIL');
    assert.notEqual(a.report.reason, null);
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});

test('symlink in final archive path is refused without reading target bytes', () => {
  const f = fixture();
  try {
    const target = join(f.dir, 'actual.zip');
    writeFileSync(target, f.bytes);
    rmSync(f.archive);
    symlinkSync(target, f.archive);
    const a = run(f, ['--archive=' + f.archive]);
    assert.equal(a.exit, 1);
    assert.equal(a.report.verdict, 'FAIL');
  } finally { rmSync(f.dir, { recursive: true, force: true }); }
});
