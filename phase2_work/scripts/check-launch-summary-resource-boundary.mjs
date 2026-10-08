import fs from 'node:fs';

const file = fs.readFileSync('src/server/routes/launch.ts', 'utf8');
const required = [
  "const launchSummaryReadLimiter = rateLimit({",
  "windowMs: 60 * 1000",
  "limit: 30",
  "keyGenerator: (req) => deps.currentUserId(req) ?? req.ip ?? 'unknown'",
  "router.get('/launch/summary', launchSummaryReadLimiter, async (req, res) =>",
];
for (const needle of required) {
  if (!file.includes(needle)) throw new Error(`Missing launch summary boundary: ${needle}`);
}
console.log('Launch summary resource boundary: PASS');
