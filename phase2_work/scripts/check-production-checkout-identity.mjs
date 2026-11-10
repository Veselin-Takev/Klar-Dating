/**
 * CLI gate for manually invoked Cloud Run deploy/promote scripts.
 * The release-go-evidence validator checks receipts bound to GITHUB_SHA.
 * Without also verifying the source checkout, a caller could execute
 * modified/unapproved shell code under a previously approved SHA.
 *
 * This protects the tracked checkout, NOT the authorization of a cloud IAM
 * principal or the image digest's signed build provenance.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const declared = process.env.GITHUB_SHA;
const validSha = /^[a-f0-9]{40}$/;
if (!validSha.test(declared ?? '')) {
  console.error('Production checkout identity FAILED: GITHUB_SHA must be an exact full commit SHA.');
  process.exit(2);
}

let actual;
try {
  actual = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: checkout, encoding: 'utf8', timeout: 10000, maxBuffer: 4096,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
} catch {
  console.error('Production checkout identity FAILED: Git HEAD cannot be verified.');
  process.exit(2);
}
if (!validSha.test(actual) || actual !== declared) {
  console.error('Production checkout identity FAILED: checked-out HEAD differs from approved GITHUB_SHA.');
  process.exit(2);
}

// Reject staged and unstaged tracked changes. Git's default diff scope
// includes the whole repository even when invoked from phase2_work.
// Confirmed independently with a changed root .github/workflows file.
// Untracked build outputs (release/, dist/) are not treated as source.
const diff = spawnSync('git', ['diff', '--quiet', 'HEAD', '--'], {
  cwd: checkout, timeout: 10000, encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 4096,
});
if (diff.error || diff.status !== 0) {
  console.error('Production checkout identity FAILED: tracked checkout differs from the approved commit or Git diff failed.');
  process.exit(2);
}

console.log('Production checkout identity PASS: approved exact HEAD and clean tracked source.');
