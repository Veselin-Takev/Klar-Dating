import fs from 'node:fs';

const critical = [
  'src/server/routes/account.ts',
  'src/server/routes/billing.ts',
  'src/server/routes/deviceTokens.ts',
  'src/server/routes/launch.ts',
  'src/server/trustAndSafety.ts',
];
const violations = [];
for (const file of critical) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('distributedRateLimit')) violations.push(file + ': missing distributedRateLimit');
  if (source.includes('rateLimit({')) violations.push(file + ': local rateLimit remains');
}
if (violations.length) throw new Error('Critical rate-limit distribution boundary failed:\n' + violations.join('\n'));
console.log('Critical rate-limit distribution boundary: PASS');
