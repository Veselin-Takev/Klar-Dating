import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
      (pattern.endsWith('/') ? filePath.startsWith(pattern.slice(1)) : filePath === pattern.slice(1)));
    if (matches) owners = candidates.filter(owner => owner.startsWith('@'));
  }
  return owners;
}

export const requiredOwnership = Object.freeze({
  'phase2_work/src/server/authorization.ts': ['@klar/security'],
  'phase2_work/src/server/trustAndSafety.ts': ['@klar/security'],
  'phase2_work/src/server/routes/partnerReferrals.ts': ['@klar/security', '@klar/finance'],
  'phase2_work/src/server/partnerReferralCore.ts': ['@klar/security'],
  'phase2_work/src/server/partnerReferralService.ts': ['@klar/security', '@klar/finance'],
  'phase2_work/src/server/stripeService.ts': ['@klar/security', '@klar/finance'],
  'phase2_work/src/server/cspRuntimePolicy.ts': ['@klar/security'],
  'phase2_work/server.ts': ['@klar/security'],
  'phase2_work/firestore.rules': ['@klar/security'],
  'phase2_work/storage.rules': ['@klar/security'],
  'phase2_work/scripts/configure-retention.sh': ['@klar/security'],
  'phase2_work/scripts/check-production-release-approval.mjs': ['@klar/security'],
  'phase2_work/RELEASE_MANIFEST.json': ['@klar/security'],
  'phase2_work/docs/DATA_RETENTION.md': ['@klar/security'],
  'phase2_work/GO_LIVE_CHECKLIST.md': ['@klar/security'],
  '.github/workflows/release.yml': ['@klar/security'],
  'CODEOWNERS': ['@klar/security'],
});

export function checkCodeowners(source) {
  const failures = [];
  for (const [file, required] of Object.entries(requiredOwnership)) {
    const owners = ownersForPath(source, file);
    for (const owner of required) {
      if (!owners.includes(owner)) failures.push(file + ': missing specialized owner ' + owner);
    }
  }
  const general = ownersForPath(source, 'phase2_work/src/components/ChatView.tsx');
  if (!general.includes('@klar/engineering')) failures.push('Missing engineering default for active app');
  return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = readFileSync(resolve(root, 'CODEOWNERS'), 'utf8');
  const errors = checkCodeowners(source);
  if (errors.length) {
    console.error('CODEOWNERS path policy FAILED:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('CODEOWNERS active-path policy PASS (static paths only; GitHub team permissions and branch rules NOT VERIFIED).');
  }
}
