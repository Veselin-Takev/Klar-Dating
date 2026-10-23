#!/usr/bin/env node
/** Read-only screening of immutable Enterprise host evidence. This never issues GO. */
import { createHash } from 'node:crypto';
import { closeSync, constants, createReadStream, existsSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_GATES = Object.freeze([
  'npm run check:enterprise',
  'node scripts/check-secrets.mjs',
  'node scripts/check-auth-boundary.mjs',
  'node scripts/check-public-firestore-rules.mjs',
  'node scripts/check-ai-pii-sanitizer.mjs',
  'node scripts/check-art17-deletion-audit.mjs 0',
  'npm audit --audit-level=high',
  'npx gitleaks detect --source . --no-git',
  'npx semgrep --config=auto --error',
  'npm run typecheck',
  'npm run test:pure',
  'npm run test:rules',
  'npx playwright test',
  'npm run build',
  'npx eslint . --max-warnings=0',
]);

const APPROVALS = Object.freeze([
  ['security', 'Security'],
  ['dpo-legal', 'Datenschutz/Legal'],
  ['operations-sre', 'Operations/SRE'],
  ['release-owner', 'Release Owner'],
]);
const HEX_SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

// Open the file descriptor with O_NOFOLLOW so a file replaced by an attacker
// between directory inspection and opening cannot redirect reads outside results/.
function openRegularNoFollow(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isFile()) throw new Error('not a regular file: ' + basename(path));
    return fd;
  } catch (err) {
    closeSync(fd);
    throw err;
  }
}

function readSmall(path, max = 2_000_000) {
  const fd = openRegularNoFollow(path);
  try {
    const size = fstatSync(fd).size;
    if (size > max) throw new Error('not a bounded file: ' + basename(path));
    return readFileSync(fd, 'utf8');
  } finally { closeSync(fd); }
}

function canonicalLines(s) { return s.replace(/\r\n/g, '\n').trimEnd().split('\n'); }

function parseManifest(value) {
  const out = new Map();
  for (const line of canonicalLines(value)) {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9][A-Za-z0-9._-]{0,127})$/.exec(line);
    if (!match) throw new Error('malformed or noncanonical SHA256SUMS entry');
    const [, hash, file] = match;
    if (!HEX_SHA.test(hash) || !FILE_NAME.test(file) || file === 'SHA256SUMS' || out.has(file)) {
      throw new Error('duplicate, invalid or self-referential SHA256SUMS entry');
    }
    out.set(file, hash);
  }
  if (out.size === 0) throw new Error('empty SHA256SUMS');
  return out;
}

async function hashFile(path) {
  const fd = openRegularNoFollow(path);
  const digest = createHash('sha256');
  // autoClose:true owns the descriptor after streaming, including read errors.
  for await (const chunk of createReadStream(path, { fd, autoClose: true })) digest.update(chunk);
  return digest.digest('hex');
}

export async function screenEvidence(dir, expectedSha) {
  if (!COMMIT.test(expectedSha)) throw new Error('Expected immutable full 40-digit commit SHA required');
  const root = resolve(dir);
  const errors = [];
  const error = (message) => errors.push(message);
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    return { expected_commit: expectedSha, release_decision: 'NO-GO', technical_evidence_pass: false, errors: ['evidence directory missing'], approvals_identity_verified: false };
  }
  let hashes;
  try { hashes = parseManifest(readSmall(join(root, 'SHA256SUMS'))); }
  catch (e) { error('SHA256SUMS: ' + e.message); hashes = new Map(); }

  const files = readdirSync(root, { withFileTypes: true });
  // No symlinks or directories: they could conceal un-hashed evidence or allow host-side redirection.
  for (const entry of files) {
    if (/^gate-[0-9]{2}\.(?:log|exit-code)$/.test(entry.name) && (Number(entry.name.slice(5, 7)) < 1 || Number(entry.name.slice(5, 7)) > REQUIRED_GATES.length)) error('unexpected numbered gate artifact: ' + entry.name);
    if (!entry.isFile()) error('non-regular or nested entry: ' + entry.name);
    else if (entry.name !== 'SHA256SUMS' && !hashes.has(entry.name)) error('file omitted from SHA256SUMS: ' + entry.name);
  }
  for (const [name, hash] of hashes) {
    const path = join(root, name);
    try {
      if (!lstatSync(path).isFile()) throw new Error('not a regular file');
      const actual = await hashFile(path);
      if (actual !== hash) error('SHA256 mismatch: ' + name);
    } catch (e) { error('unverifiable file ' + name + ': ' + e.message); }
  }
  const read = (name) => {
    if (!hashes.has(name)) { error('required file missing from SHA256SUMS: ' + name); return null; }
    try { return readSmall(join(root, name)); }
    catch (e) { error('cannot read ' + name + ': ' + e.message); return null; }
  };
  // Reject contradictory duplicate identity lines; extra host diagnostics may
  // remain in host-preflight.txt without weakening the identity boundary.
  const requireUniqueFact = (body, filename, key, expectedValue) => {
    const prefix = `${key}=`;
    const matches = canonicalLines(body).filter((line) => line.startsWith(prefix));
    if (matches.length !== 1 || matches[0] !== `${prefix}${expectedValue}`) {
      error(`${filename} must have exactly one ${prefix}${expectedValue}`);
    }
  };
  const baseline = read('baseline.txt');
  if (baseline !== null) {
    requireUniqueFact(baseline, 'baseline.txt', 'commit', expectedSha);
    requireUniqueFact(baseline, 'baseline.txt', 'node', 'v22.23.3');
    requireUniqueFact(baseline, 'baseline.txt', 'bun', '1.4.2');
  }
  const host = read('host-preflight.txt');
  if (host !== null) {
    requireUniqueFact(host, 'host-preflight.txt', 'target_sha', expectedSha);
  }
  const toolchain = read('container-toolchain.log');
  if (toolchain !== null && canonicalLines(toolchain).slice(0, 2).join('\n') !== 'v22.23.3\n1.4.2') {
    error('container runtime mismatch');
  }
  for (const name of ['install.exit-code', 'docker-build.exit-code', 'docker-run.exit-code', 'container-toolchain.exit-code']) {
    const code = read(name);
    if (code !== null && code.trim() !== '0') error('nonzero prerequisite: ' + name);
  }
  for (const name of ['install.log', 'docker-build.log', 'docker-run.log', 'runner.stdout.log', 'runner.stderr.log', 'host.stdout.log', 'host.stderr.log']) read(name);
  const tsv = read('gates.tsv');
  if (tsv !== null) {
    const lines = canonicalLines(tsv);
    if (lines.shift() !== 'number\tcommand\texit_code\tstatus\tlog_sha256') error('unexpected gates.tsv header');
    if (lines.length !== REQUIRED_GATES.length) error('gates.tsv must contain exactly 15 rows');
    for (let i = 0; i < REQUIRED_GATES.length; i++) {
      const id = String(i + 1).padStart(2, '0');
      const row = lines[i]?.split('\t') || [];
      const logName = `gate-${id}.log`;
      const exitName = `gate-${id}.exit-code`;
      if (row.length !== 5 || row[0] !== id || row[1] !== REQUIRED_GATES[i] || row[2] !== '0' || row[3] !== 'PASS' || !HEX_SHA.test(row[4] || '')) {
        error('gate row invalid or non-PASS: ' + id);
      }
      const exit = read(exitName);
      if (exit !== null && exit.trim() !== '0') error('gate exit file nonzero: ' + id);
      if (!hashes.has(logName)) error('gate log missing: ' + id);
      else if (row[4] !== hashes.get(logName)) error('gate log hash differs from manifest: ' + id);
    }
  }
  // Independent approvals are produced AFTER the sealed technical host run.
  // Receipts, if supplied inside the bundle, must be hash-validated and structurally
  // sound; they are optional for technical screening and NEVER confer GO.
  const approvalReceiptChecks = [];
  for (const [suffix, role] of APPROVALS) {
    const name = `approval-${suffix}.json`;
    const txt = hashes.has(name) ? read(name) : null;
    let present = false;
    if (txt !== null) {
      try {
        const d = JSON.parse(txt);
        present = d.role === role && d.commit === expectedSha && d.decision === 'APPROVED' &&
          typeof d.approver === 'string' && d.approver.trim().length > 0 &&
          typeof d.evidence_url === 'string' && /^https:\/\//.test(d.evidence_url) &&
          typeof d.signed_at === 'string' && !Number.isNaN(Date.parse(d.signed_at));
        if (!present) error('approval receipt structurally invalid: ' + role);
      } catch { error('approval receipt invalid JSON: ' + role); }
    }
    approvalReceiptChecks.push({ role, receipt_present: present, identity_verified: false });
  }
  return {
    expected_commit: expectedSha,
    release_decision: 'NO-GO',
    technical_evidence_pass: errors.length === 0,
    approvals_identity_verified: false,
    approval_receipts: approvalReceiptChecks,
    errors,
    disclaimer: 'Technical evidence can be screened before independent approvals. Approval receipts may arrive in a separate, independently sealed and authenticated bundle. Automated hashes and self-asserted receipts do not prove origin or reviewer identity. Human release decision is always required.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf('--dir');
  const shaIdx = args.indexOf('--commit');
  if (dirIdx < 0 || shaIdx < 0 || !args[dirIdx + 1] || !args[shaIdx + 1]) {
    console.error('Usage: node scripts/verify-host-gate-evidence.mjs --dir /read-only/results --commit <40-digit-sha>');
    process.exitCode = 2;
  } else {
    try {
      const report = await screenEvidence(args[dirIdx + 1], args[shaIdx + 1]);
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.technical_evidence_pass ? 0 : 1;
    } catch (e) {
      console.error(JSON.stringify({ release_decision: 'NO-GO', errors: [String(e.message)] }));
      process.exitCode = 1;
    }
  }
}
