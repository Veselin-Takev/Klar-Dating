import fs from 'node:fs';

const launch = fs.readFileSync('src/server/routes/launch.ts', 'utf8');
const failures = [];
const required = [
  ['src/server/routes/launch.ts', /referralGenerationLimiter/],
  ['rateLimit import', /import rateLimit from ['"]express-rate-limit['"]/],
  ['referral limiter', /const referralClaimLimiter\s*=\s*rateLimit\(/],
  ['referral 15 minute limit', /windowMs:\s*15\s*\*\s*60\s*\*\s*1000,\s*\n\s*limit:\s*10/],
  ['activation limiter', /const activationWriteLimiter\s*=\s*rateLimit\(/],
  ['activation limit 30', /const activationWriteLimiter[\s\S]*?limit:\s*30/],
  ['founding limiter', /const foundingClaimLimiter\s*=\s*rateLimit\(/],
  ['founding hourly limit 3', /const foundingClaimLimiter[\s\S]*?windowMs:\s*60\s*\*\s*60\s*\*\s*1000,[\s\S]*?limit:\s*3/],
  ['UID keying', /keyGenerator:\s*\(req\)\s*=>\s*deps\.currentUserId\(req\)\s*\?\?\s*req\.ip/],
  ['referral body cap', /router\.post\('\/referral\/claim',\s*express\.json\(\{\s*limit:\s*'8kb',\s*strict:\s*true\s*\}\),\s*referralClaimLimiter/],
  ['activation body cap', /router\.post\('\/activation',\s*express\.json\(\{\s*limit:\s*'8kb',\s*strict:\s*true\s*\}\),\s*activationWriteLimiter/],
  ['founding body cap', /router\.post\('\/launch\/founding-claim',\s*express\.json\(\{\s*limit:\s*'8kb',\s*strict:\s*true\s*\}\),\s*foundingClaimLimiter/],
];
for (const [name, pattern] of required) if (!pattern.test(launch)) failures.push(name);
if (failures.length) {
  console.error(`Launch write boundary: FAIL — ${failures.join(', ')}`);
  process.exit(1);
}
console.log('Launch write boundary: PASS');
