import fs from 'node:fs';

const source = fs.readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const tests = fs.readFileSync('tests/diditKycStateMachine.spec.ts', 'utf8');
const statusTests = fs.readFileSync('tests/diditKycStatus.spec.ts', 'utf8');
const required = [
  'RECENT_AUTH_MAX_AGE_SECONDS = 300',
  'hasRecentAuthentication(user.auth_time)',
  'transitionKycAccountStatus',
  "'Kyc Expired': 'pending'",
  "'Resubmitted': 'review'",
  "'Declined': 'pending'",
  "X-Signature-V2",
  "text({ inflate: false, type: 'application/json', limit: '256kb' })",
];
for (const marker of required) if (!source.includes(marker)) throw new Error(`Missing Didit KYC integrity control: ${marker}`);
if (source.includes('X-Signature-Simple')) throw new Error('Didit Simple signature fallback must not be enabled');
if (!tests.includes('invalid_provider_status') || !tests.includes('approved\', \'Declined')) throw new Error('KYC state-machine regression cases missing');
if (!statusTests.includes('recent_login_required')) throw new Error('KYC recent-auth integration test missing');
console.log('Didit KYC pipeline integrity: PASS');
