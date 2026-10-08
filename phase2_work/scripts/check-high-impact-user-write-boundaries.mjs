import { readFileSync } from 'node:fs';

const checks = [
  ['src/server/routes/billing.ts', /checkoutCreationLimiter\s*=\s*rateLimit/, /limit:\s*5/, /keyGenerator:\s*\(req\).*currentUserId/],
  ['src/server/routes/deviceTokens.ts', /deviceTokenWriteLimiter\s*=\s*rateLimit/, /limit:\s*20/, /keyGenerator:\s*\(req\).*currentUserId/],
  ['src/server/routes/profileRecommendations.ts', /profilePublishLimiter\s*=\s*rateLimit/, /limit:\s*10/, /keyGenerator:\s*\(req\).*currentUserId/],
  ['src/server/routes/chat.ts', /(messageSendLimiter\s*=\s*rateLimit|distributedChatMessageRateLimit)/, /limit:\s*20/, /keyGenerator:\s*\(req\).*currentUserId/],
];
for (const [file, ...patterns] of checks) {
  const source = readFileSync(file, 'utf8');
  for (const pattern of patterns) {
    if (!pattern.test(source)) throw new Error(`High-impact write boundary missing in ${file}: ${pattern}`);
  }
}
const routes = [
  ['src/server/routes/billing.ts', /router\.post\('\/subscribe-klar-plus',\s*checkoutCreationLimiter/],
  ['src/server/routes/deviceTokens.ts', /router\.post\('\/device-token',\s*deviceTokenWriteLimiter/],
  ['src/server/routes/profileRecommendations.ts', /router\.post\('\/profile\/publish',\s*profilePublishLimiter/],
  ['src/server/routes/chat.ts', /router\.post\('\/messages\/send',\s*messageSendLimiter/],
];
for (const [file, pattern] of routes) {
  if (!pattern.test(readFileSync(file, 'utf8'))) throw new Error(`Limiter not mounted on ${file}`);
}
console.log('High-impact user write boundaries: PASS');
