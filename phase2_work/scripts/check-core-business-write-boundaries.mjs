import { readFileSync } from 'node:fs';

const server = readFileSync('server.ts', 'utf8');
const account = readFileSync('src/server/routes/account.ts', 'utf8');

const checks = [
  ['contact write limiter', /const contactWriteLimiter = rateLimit\(/],
  ['contact write 10/min', /const contactWriteLimiter = rateLimit\([\s\S]*?windowMs:\s*60 \* 1000,[\s\S]*?limit:\s*10,/],
  ['contact write UID key', /const contactWriteLimiter = rateLimit\([\s\S]*?keyGenerator:\s*\(req\) => currentUserId\(req\) \?\? req\.ip/],
  ['contact undo limiter', /const contactUndoLimiter = rateLimit\(/],
  ['contact undo 20/min', /const contactUndoLimiter = rateLimit\([\s\S]*?windowMs:\s*60 \* 1000,[\s\S]*?limit:\s*20,/],
  ['contact route protected', /app\.post\("\/api\/contact",\s*contactWriteLimiter,\s*handleKontakt\)/],
  ['contact undo route protected', /app\.post\("\/api\/contact\/undo",\s*contactUndoLimiter,\s*handleContactUndo\)/],
  ['contract mutation limiter', /const contractMutationLimiter = rateLimit\(/],
  ['contract mutation 3/hour', /const contractMutationLimiter = rateLimit\([\s\S]*?windowMs:\s*60 \* 60 \* 1000,[\s\S]*?limit:\s*3,/],
  ['contract mutation UID key', /const contractMutationLimiter = rateLimit\([\s\S]*?keyGenerator:\s*\(req\) => currentUserId\(req\) \?\? req\.ip/],
  ['cancel route protected', /app\.post\("\/api\/subscription\/cancel",\s*contractMutationLimiter,\s*handleCancel\)/],
  ['withdraw route protected', /app\.post\("\/api\/subscription\/withdraw",\s*contractMutationLimiter,\s*handleWithdraw\)/],
  ['account alter limiter', /const accountAlterLimiter = rateLimit\(/],
  ['account alter 5/hour', /const accountAlterLimiter = rateLimit\([\s\S]*?windowMs:\s*60 \* 60 \* 1000,[\s\S]*?limit:\s*5,/],
  ['account preferences limiter', /const accountPreferencesLimiter = rateLimit\(/],
  ['account preferences 30/15m', /const accountPreferencesLimiter = rateLimit\([\s\S]*?windowMs:\s*15 \* 60 \* 1000,[\s\S]*?limit:\s*30,/],
  ['account alter route protected', /router\.post\('\/account\/alter',\s*accountAlterLimiter,\s*handleAlter\)/],
  ['account preferences route protected', /router\.patch\('\/account\/preferences',\s*accountPreferencesLimiter,\s*async/],
];

const failures = checks.filter(([, pattern]) => !pattern.test(pattern.source.includes('server') ? server : account));
// Re-evaluate checks against their intended file to keep the output deterministic.
const results = checks.map(([name, pattern]) => {
  const source = /^(contact|contract|cancel|withdraw)/.test(name) ? server : /account/.test(name) ? account : server;
  return [name, pattern.test(source)];
});
const failed = results.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`Core business write boundary: FAIL (${failed.join(', ')})`);
  process.exit(1);
}
console.log('Core business write boundary: PASS');
