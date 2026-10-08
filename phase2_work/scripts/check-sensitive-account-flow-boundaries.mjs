import { readFileSync } from 'node:fs';

const checks = [
  ['src/server/routes/account.ts', /accountDeleteLimiter\s*=\s*async/, /account_deletion_rate_limits/, /runTransaction/, /router\.post\('\/account\/delete',\s*accountDeleteLimiter/],
  ['src/server/routes/account.ts', /consentWriteLimiter\s*=\s*rateLimit/, /limit:\s*20/, /windowMs:\s*15 \* 60 \* 1000/, /keyGenerator:\s*\(req\).*currentUserId/, /router\.post\('\/einwilligung',\s*consentWriteLimiter/, /router\.post\('\/einwilligung\/widerruf',\s*consentWriteLimiter/],
  ['src/server/verification/diditKyc.ts', /KYC_START_RATE_LIMIT_COLLECTION = 'kyc_start_rate_limits'/, /KYC_START_RATE_LIMIT_MAX = 3/, /deps\.db\(\)\.runTransaction/, /router\.post\('\/start',\s*kycStartLimiter/],
  ['src/server/routes/chat.ts', /CHAT_GATE_ANSWER_RATE_LIMIT_COLLECTION = 'chat_gate_answer_rate_limits'/, /CHAT_GATE_ANSWER_RATE_LIMIT_MAX = 10/, /distributedChatGateAnswerRateLimit/, /runTransaction/, /router\.post\('\/gate\/answer',\s*gateAnswerLimiter/],
  ['src/server/routes/analytics.ts', /router\.use\(rateLimit\(/, /limit:\s*30/, /windowMs:\s*60_000/, /keyGenerator:\s*\(req\).*currentUserId/],
];

for (const [file, ...patterns] of checks) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    if (!pattern.test(source)) throw new Error(`Sensitive account-flow boundary missing in ${file}: ${pattern}`);
  }
}
console.log('Sensitive account/provider flow boundaries: PASS');
