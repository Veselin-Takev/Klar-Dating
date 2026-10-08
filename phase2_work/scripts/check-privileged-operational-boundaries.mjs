import fs from 'node:fs';

const audit = fs.readFileSync('src/server/routes/auditLogs.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const failures = [];

const checks = [
  [audit.includes('const adminAuditReadLimiter = rateLimit({'), 'admin audit limiter exists'],
  [audit.includes('windowMs: 5 * 60 * 1000') && audit.includes('limit: 20'), 'admin audit limiter is 20/5m'],
  [audit.includes("router.get('/audit-logs', adminAuditReadLimiter"), 'admin audit route is throttled'],
  [audit.includes("user?.uid ?? req.ip ?? 'unknown'"), 'admin audit limiter is UID-first'],
  [server.includes('const adminHealthCheckLimiter = rateLimit({'), 'admin health limiter exists'],
  [server.includes('windowMs: 5 * 60 * 1000') && server.includes('limit: 6'), 'admin health limiter is 6/5m'],
  [server.includes("app.get('/api/admin/health-check', requireAuth, requireRole('admin', 'trust_safety', 'super_admin'), adminHealthCheckLimiter"), 'admin health route is throttled'],
  [server.includes("keyGenerator: (req) => currentUserId(req) ?? req.ip ?? 'unknown'"), 'admin health limiter is UID-first'],
  [server.includes("listUsers(1)"), 'health check still explicitly exercises bounded auth probe'],
];
for (const [ok, label] of checks) if (!ok) failures.push(label);
if (failures.length) {
  console.error('Privileged operational boundaries: FAIL');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
console.log('Privileged operational boundaries: PASS');
