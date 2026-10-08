import fs from 'node:fs';

const feedback = fs.readFileSync('src/server/routes/feedback.ts', 'utf8');
const email = fs.readFileSync('src/server/email.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const required = [
  "rateLimit({",
  "windowMs: 60_000",
  "limit: 10",
  "express.json({ limit: '10kb', strict: true })",
];
const emailRequired = [
  'verificationMailLimiter',
  'VERIFICATION_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000',
  'VERIFICATION_RATE_LIMIT_MAX = 3',
  'currentUserId(req)',
];
for (const marker of [...required, ...emailRequired]) {
  if (required.includes(marker) && !feedback.includes(marker)) throw new Error(`Public feedback boundary missing: ${marker}`);
  if (emailRequired.includes(marker) && !email.includes(marker)) throw new Error(`Verification-mail abuse boundary missing: ${marker}`);
}
if (!server.includes("verificationMailLimiter")) throw new Error('Server does not mount the verification-mail limiter');
if (!server.includes("limit: '8kb'")) throw new Error('Verification-mail JSON body limit is missing');
if (!packageJson.scripts?.['check:public-write-boundaries']) throw new Error('Missing check:public-write-boundaries package script');
if (!packageJson.scripts['check:enterprise'].includes('bun run check:public-write-boundaries')) throw new Error('Enterprise gate does not include public write boundary check');
console.log('Public write boundary: PASS');
