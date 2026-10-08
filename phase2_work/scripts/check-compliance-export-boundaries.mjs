import fs from 'node:fs';

const route = fs.readFileSync('src/server/routes/auditLogs.ts', 'utf8');
const platform = fs.readFileSync('src/server/platform/auditComplianceExport.ts', 'utf8');

const checks = [
  ['rate limiter import', /express-rate-limit/],
  ['compliance read limiter', /complianceReadLimiter/],
  ['compliance read 30 per 5m', /windowMs:\s*5\s*\*\s*60\s*\*\s*1000[\s\S]*?limit:\s*30/],
  ['compliance csv limiter', /complianceCsvLimiter/],
  ['compliance csv 5 per 15m', /windowMs:\s*15\s*\*\s*60\s*\*\s*1000[\s\S]*?limit:\s*5/],
  ['uid-first keying', /user.*uid.*req\.ip/],
  ['compliance read mounted limiter', /get\('\/compliance\/audit-logs',\s*complianceReadLimiter/],
  ['csv mounted limiter', /get\('\/compliance\/audit-logs\/csv',\s*complianceCsvLimiter/],
  ['csv export hard cap', /exportComplianceLogsAsCSV\(db,\s*\{\s*limit:\s*500/],
  ['finite positive bounded limit', /Number\.isSafeInteger\(parsedLimit\)[\s\S]*?Math\.min\(Math\.max\(parsedLimit,\s*1\),\s*500\)/],
  ['platform hard cap', /Number\.isSafeInteger\(requestedLimit\)[\s\S]*?Math\.min\(Math\.max\(requestedLimit,\s*1\),\s*500\)/],
];

const failed = checks.filter(([, re]) => !re.test(route + '\n' + platform));
if (failed.length) {
  console.error('Compliance export boundary: FAIL');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log('Compliance export boundary: PASS');
