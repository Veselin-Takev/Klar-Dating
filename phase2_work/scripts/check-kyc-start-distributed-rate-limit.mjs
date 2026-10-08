import fs from 'node:fs';

const source = fs.readFileSync('src/server/verification/diditKyc.ts', 'utf8');
const required = [
  "KYC_START_RATE_LIMIT_COLLECTION = 'kyc_start_rate_limits'",
  'KYC_START_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000',
  'KYC_START_RATE_LIMIT_MAX = 3',
  'kycStartRateLimitKey',
  'deps.db().runTransaction',
  "router.post('/start', kycStartLimiter",
  'KYC-Limit derzeit nicht verfügbar.',
];
for (const marker of required) if (!source.includes(marker)) throw new Error(`Missing distributed KYC start rate-limit control: ${marker}`);
if (/const kycStartLimiter\s*=\s*rateLimit\(/.test(source)) throw new Error('KYC start must not use a process-local express-rate-limit store');
console.log('KYC start distributed rate limit: PASS');
