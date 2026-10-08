import fs from 'node:fs';

const source = fs.readFileSync('src/server/routes/launch.ts', 'utf8');
const limiter = /const activationSummaryReadLimiter = rateLimit\(\{[\s\S]*?windowMs:\s*60 \* 1000,[\s\S]*?limit:\s*30,[\s\S]*?keyGenerator:\s*\(req\)\s*=>\s*deps\.currentUserId\(req\)\s*\?\?\s*req\.ip\s*\?\?\s*'unknown',[\s\S]*?\}\);/;
if (!limiter.test(source)) throw new Error('Activation summary limiter is missing or has an unexpected configuration.');
if (!source.includes("router.get('/activation/summary', activationSummaryReadLimiter, async (req, res) =>")) {
  throw new Error('Activation summary route is not protected by its limiter.');
}
if (!source.includes(".collection('activation_events').where('uid', '==', uid).limit(100)")) {
  throw new Error('Activation summary query lost its server-side 100-record bound.');
}
console.log('Activation summary resource boundary: PASS');
