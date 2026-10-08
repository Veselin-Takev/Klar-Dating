import { readFileSync } from 'node:fs';
const source = readFileSync('src/server/routes/account.ts', 'utf8');
for (const pattern of [
  /accountDeleteLimiter\s*=\s*async/, 
  /account_deletion_rate_limits/, 
  /crypto\.createHash\('sha256'\)/,
  /runTransaction\(async tx/,
  /count\s*>=\s*3/,
  /status\(429\)/,
  /status\(503\)/,
  /router\.post\('\/account\/delete',\s*accountDeleteLimiter/,
]) if (!pattern.test(source)) throw new Error(`Distributed account deletion rate limit missing: ${pattern}`);
if (/accountDeleteLimiter\s*=\s*rateLimit\(/.test(source)) throw new Error('Account deletion still uses process-local rateLimit');
console.log('Account deletion distributed rate limit: PASS');
