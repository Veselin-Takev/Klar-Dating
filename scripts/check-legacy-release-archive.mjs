#!/usr/bin/env node
/**
 * VES-10: verify a user-supplied historical ZIP against BOTH immutable source
 * checksum manifests without extracting it or uploading the archive anywhere.
 * A manifests-only pass is explicitly NOT evidence of archive existence.
 */
import { createHash } from 'node:crypto';
import { open, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => process.argv.find(x => x.startsWith('--' + name + '='))?.slice(name.length + 3);
const root = resolve(arg('repo') ?? repo);
const manifestRoot = resolve(root, 'Klar_Enterprise_Final_15.09.2026.SHA256SUMS');
const manifestPhase = resolve(root, 'phase2_work/Klar_Enterprise_Final_15.09.2026.SHA256SUMS');
const reportPath = resolve(arg('report') ?? resolve(root, 'audit-results/ves10-release-archive.json'));
const archive = arg('archive');
const manifestsOnly = process.argv.includes('--manifests-only');
const wantedArchiveName = 'Klar_Enterprise_Final_15.09.2026.zip';
// Independently pinned to the historical Git-reviewed manifest, not inferred
// from two simultaneously modified input files.
const historicalExpectedSha256 = '36b2a3ac3953cecc0bbfecbf7ca7f7cc2dd0e39f118820a51591bcce97725aac';

function manifestValue(contents) {
  const entries = contents.split(/\r?\n/).filter(x => x.trim());
  if (entries.length !== 1) throw Error('invalid_manifest_entry_count');
  const line = /^([a-fA-F0-9]{64})[ \t]+\*?(\S+)$/.exec(entries[0]);
  const target = line?.[2].replace(/\\/g, '/');
  if (!line || (target !== '/mnt/data/' + wantedArchiveName && target !== wantedArchiveName)) {
    throw Error('invalid_manifest_format_or_filename');
  }
  return line[1].toLowerCase();
}
/**
 * Pure function exported for offline fixtures. The command-line invocation
 * always uses the fixed historical digest; this optional expected parameter
 * is NOT exposed as a user-supplied release override.
 */
export function verifyManifestPair(first, second, expected = historicalExpectedSha256) {
  const m1 = manifestValue(first);
  const m2 = manifestValue(second);
  if (m1 !== m2) throw Error('source_manifests_disagree');
  if (m1 !== expected) throw Error('historical_release_digest_changed');
  return m1;
}
export async function digestArchive(path) {
  // O_NOFOLLOW rejects a symlink in the final path component; never extract
  // or execute archive content. The caller must verify the source/provenance
  // independently before counting this as an authentic historical release.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile()) throw Error('archive_not_regular_file');
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      hash.update(chunk);
      bytes += chunk.length;
    }
    const after = await handle.stat();
    if (before.size !== bytes || after.size !== bytes || before.mtimeMs !== after.mtimeMs) {
      throw Error('archive_changed_during_read');
    }
    return { sha256: hash.digest('hex'), sizeBytes: bytes };
  } finally {
    await handle.close();
  }
}

async function main() {
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    archiveName: wantedArchiveName,
    manifestPaths: [
      'Klar_Enterprise_Final_15.09.2026.SHA256SUMS',
      'phase2_work/Klar_Enterprise_Final_15.09.2026.SHA256SUMS',
    ],
    manifestConsistency: false,
    expectedSha256: null,
    archiveSha256: null,
    archiveSizeBytes: null,
    verdict: 'UNVERIFIED',
    reason: 'archive_not_provided',
    limitations: [
      'A matching digest proves content equality to versioned manifests, not the original historical custody or authorship.',
      'Never copy a sensitive archive into public Git, print raw contents or replace old manifest digests.',
      'This does not authorize a production release or a destructive cloud operation.',
    ],
  };
  try {
    const m1 = verifyManifestPair(
      await readFile(manifestRoot, 'utf8'),
      await readFile(manifestPhase, 'utf8'),
    );
    result.manifestConsistency = true;
    result.expectedSha256 = m1;
    if (manifestsOnly && !archive) {
      result.verdict = 'MANIFESTS_CONSISTENT_ARCHIVE_UNVERIFIED';
    } else if (!archive || manifestsOnly) {
      throw Error('archive_argument_required_or_conflicts_with_manifests_only');
    } else {
      if (basename(archive) !== wantedArchiveName) throw Error('archive_filename_mismatch');
      const verified = await digestArchive(resolve(archive));
      result.archiveSha256 = verified.sha256;
      result.archiveSizeBytes = verified.sizeBytes;
      if (verified.sha256 !== m1) throw Error('archive_sha256_mismatch');
      result.verdict = 'ARCHIVE_BYTES_MATCH_MANIFESTS_CUSTODY_UNVERIFIED';
      result.reason = null;
    }
  } catch (error) {
    result.verdict = 'FAIL';
    const allowed = new Set([
      'invalid_manifest_entry_count', 'invalid_manifest_format_or_filename',
      'source_manifests_disagree', 'historical_release_digest_changed',
      'archive_argument_required_or_conflicts_with_manifests_only',
      'archive_filename_mismatch', 'archive_not_regular_file',
      'archive_changed_during_read', 'archive_sha256_mismatch',
    ]);
    result.reason = allowed.has(error?.message) ? error.message : 'archive_or_manifest_unavailable';
  }
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(result, null, 2) + '\n');
  console.log('VES-10 archive audit: ' + result.verdict);
  if (result.verdict === 'FAIL') process.exitCode = 1;
}
// Imported test fixtures may exercise pure helpers, but the release CLI never
// accepts a runtime override for the immutable historical checksum.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
