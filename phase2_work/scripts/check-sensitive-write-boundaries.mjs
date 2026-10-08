import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const trustSafety = fs.readFileSync('src/server/trustAndSafety.ts', 'utf8');

const failures = [];
const required = [
  ['rateLimit import', /import rateLimit from ['"]express-rate-limit['"]/],
  ['UID-based limiter export', /export const trustSafetyWriteLimiter\s*=\s*rateLimit\(/],
  ['15 minute window', /windowMs:\s*15\s*\*\s*60\s*\*\s*1000/],
  ['limit 20', /limit:\s*20/],
  ['UID keying', /keyGenerator:\s*\(req\)\s*=>\s*uid\(req\)\s*\|\|\s*req\.ip/],
  ['report route protected', /app\.post\("\/api\/report",\s*trustSafetyWriteLimiter,\s*handleReport\)/],
  ['block route protected', /app\.post\("\/api\/block",\s*trustSafetyWriteLimiter,\s*handleBlock\)/],
];
for (const [name, pattern] of required) {
  const source = name.includes('route') ? server : trustSafety;
  if (!pattern.test(source)) failures.push(name);
}
if (failures.length) {
  console.error(`Sensitive write boundary: FAIL — ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Sensitive write boundary: PASS');
