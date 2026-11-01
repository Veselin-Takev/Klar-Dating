import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = (path) => readFileSync(path, 'utf8');
const modal = file('src/components/BiometricsVerificationModal.tsx');
const contract = file('src/lib/kycStatusRefresh.ts');
const service = file('src/server/verification/diditKyc.ts');
const retired = file('src/server/verification-routes.ts');
const server = file('server.ts');

test('the profile refresh cannot call retired manual verification status', () => {
  assert.doesNotMatch(modal, /\/api\/verification\/status/);
  assert.match(modal, /authFetch\(KYC_STATUS_ENDPOINT/);
  assert.match(modal, /if \(!response\.ok\) throw/);
  assert.match(modal, /classifyKycRefreshStatus/);
  assert.match(modal, /result === 'approved'/);
  assert.doesNotMatch(modal, /result\.isVerified/);
  assert.match(contract, /KYC_STATUS_ENDPOINT = '\/api\/kyc\/status'/);
});

test('the mounted KYC provider serves authenticated GET status while the old route is retired', () => {
  assert.match(server, /app\.use\('\/api\/kyc', createKycRouter\(kycDependencies\)\)/);
  assert.match(server, /app\.use\("\/api\/verification", verificationRouter\)/);
  assert.match(service, /router\.get\('\/status', kycStatusReadLimiter/);
  assert.match(service, /status: account\.data\(\)\?\.status \?\? 'not_started'/);
  assert.match(retired, /'\/status'/);
  assert.match(retired, /res\.status\(410\)/);
});

test('provider statuses are strict and unknown/legacy approval flags fail closed', () => {
  assert.match(contract, /status === 'approved'/);
  for (const status of ['pending', 'review', 'not_started']) {
    assert(contract.includes("status === '" + status + "'"));
  }
  assert.match(contract, /return 'unavailable'/);
  assert.doesNotMatch(contract, /isVerified/);
});

test('modal maintains accessibility and translates pending/unavailable cases', () => {
  assert.match(modal, /useModalAccessibility/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-live="polite"/);
  assert.match(modal, /kyc\.photoPending/);
  assert.match(modal, /kyc\.statusUnavailable/);
});
