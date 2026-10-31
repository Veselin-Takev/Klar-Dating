import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { technicalOwner } from './codeowners-review-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// The policy below deliberately uses only literal repository-root paths,
// directory prefixes and the '*' default. GitHub validates the full syntax.
export function ownersForPath(source, filePath) {
  assert(typeof filePath === 'string' && !filePath.startsWith('/') && !filePath.includes('..'), 'Invalid repository-relative path');
  let owners = [];
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...candidates] = line.split(/\s+/);
    if (!candidates.length) continue;
    const matches = pattern === '*' || (pattern.startsWith('/') &&
      (filePath === pattern.slice(1) || filePath.startsWith(pattern.slice(1).replace(/\/$/, '') + '/')));
    if (matches) owners = candidates.filter(owner => owner.startsWith('@'));
  }
  return owners;
}

export const requiredOwnership = Object.freeze({
  'phase2_work/src/server/authorization.ts': [technicalOwner],
  'phase2_work/src/server/trustAndSafety.ts': [technicalOwner],
  'phase2_work/src/server/routes/partnerReferrals.ts': [technicalOwner],
  'phase2_work/src/server/partnerReferralCore.ts': [technicalOwner],
  'phase2_work/src/server/partnerReferralService.ts': [technicalOwner],
  'phase2_work/src/server/stripeService.ts': [technicalOwner],
  'phase2_work/src/server/cspRuntimePolicy.ts': [technicalOwner],
  'phase2_work/server.ts': [technicalOwner],
  'phase2_work/firestore.rules': [technicalOwner],
  'phase2_work/storage.rules': [technicalOwner],
  'phase2_work/scripts/configure-retention.sh': [technicalOwner],
  'phase2_work/scripts/check-production-release-approval.mjs': [technicalOwner],
  'phase2_work/RELEASE_MANIFEST.json': [technicalOwner],
  'phase2_work/docs/DATA_RETENTION.md': [technicalOwner],
  'phase2_work/GO_LIVE_CHECKLIST.md': [technicalOwner],
  '.github/workflows/release.yml': [technicalOwner],
  'CODEOWNERS': [technicalOwner],
  'phase2_work/scripts/check-codeowners.mjs': [technicalOwner],
  'phase2_work/scripts/test-codeowners.mjs': [technicalOwner],
  'phase2_work/scripts/codeowners-review-policy.mjs': [technicalOwner],
  'phase2_work/scripts/check-codeowners-owner.mjs': [technicalOwner],
  // Explicit retention, Didit KYC and bearer-URL implementation boundaries.
  'phase2_work/src/server/routes/complianceStorage.ts': [technicalOwner],
  'phase2_work/src/server/platform/storageRetentionEngine.ts': [technicalOwner],
  'phase2_work/src/server/platform/verificationPurgeScan.ts': [technicalOwner],
  'phase2_work/src/server/verification/diditKyc.ts': [technicalOwner],
  'phase2_work/functions/src/purgeVerificationStorage.ts': [technicalOwner],
  'phase2_work/functions/src/purgeCompletion.ts': [technicalOwner],
  'phase2_work/functions/src/deleteExpiredPhotos.ts': [technicalOwner],
  'phase2_work/functions/src/retention.ts': [technicalOwner],
  'phase2_work/src/lib/klar.ts': [technicalOwner],
  'phase2_work/src/lib/api.ts': [technicalOwner],
  'phase2_work/scripts/check-compliance-storage-purge.mjs': [technicalOwner],
  'phase2_work/scripts/check-retention-config.mjs': [technicalOwner],
  'GO_LIVE_CHECKLIST.md': [technicalOwner],
});

export function checkCodeowners(source) {
  const failures = [];
  // Require a real repository-wide technical owner default. A file-specific
  // ChatView assignment must not substitute ownership of unrelated code.
  if (!source.split(/\r?\n/).some(raw => {
    const [pattern, ...owners] = raw.trim().split(/\s+/);
    return pattern === '*' && owners.includes(technicalOwner);
  })) failures.push('Missing CODEOWNERS repository-wide technical owner default');
  // GitHub honors glob patterns and the LAST matching line wins. Our
  // deterministic matcher supports only '/', exact paths and the default '*'.
  // Any other glob could override an explicit protected-path rule:
  // fail closed rather than pretending the recorded ownership is sufficient.
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    if (pattern !== '*' && (!pattern.startsWith('/') || /[*?\[\]\\]/.test(pattern))) {
      failures.push(`Line ${index + 1}: unsupported CODEOWNERS pattern: ${pattern}`);
    }
    if (owners.some(owner => owner !== technicalOwner)) failures.push(`Line ${index + 1}: unverified technical owner`);
    if (!owners.length || !owners.every(owner => /^@[A-Za-z0-9][A-Za-z0-9-]*(?:\/[A-Za-z0-9][A-Za-z0-9-]*)?$/.test(owner))) {
      failures.push(`Line ${index + 1}: invalid or missing CODEOWNERS reviewer identity`);
    }
  }
  for (const [file, required] of Object.entries(requiredOwnership)) {
    const owners = ownersForPath(source, file);
    const expectedPattern = file === '.github/workflows/release.yml' ? '/.github/workflows/' : '/' + file;
    const matchingPatterns = source.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split(/\s+/)[0])
      .filter(pattern => pattern === '*' || (pattern.startsWith('/') &&
        (file === pattern.slice(1) || file.startsWith(pattern.slice(1).replace(/\/$/, '') + '/'))));
    if (matchingPatterns.at(-1) !== expectedPattern) failures.push(file + ': missing or overridden explicit protected-path rule');
    for (const owner of required) {
      if (!owners.includes(owner)) failures.push(file + ': missing technical owner ' + owner);
    }
  }
  const general = ownersForPath(source, 'phase2_work/src/components/ChatView.tsx');
  if (!general.includes(technicalOwner)) failures.push('Missing technical owner default for active app');
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(resolve(root, 'CODEOWNERS'), 'utf8');
  const errors = checkCodeowners(source);
  if (errors.length) {
    console.error('CODEOWNERS path policy FAILED:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('CODEOWNERS technical ownership PASS; independent specialist approval is a separate production gate.');
  }
}
