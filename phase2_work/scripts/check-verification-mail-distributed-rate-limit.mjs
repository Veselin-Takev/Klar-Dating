import fs from 'node:fs';

const source = fs.readFileSync('src/server/email.ts', 'utf8');
const failures = [];
if (!source.includes("VERIFICATION_RATE_LIMIT_COLLECTION = 'verification_mail_rate_limits'")) failures.push('verification mail throttling must use a durable account-scoped collection');
if (!source.includes('runTransaction')) failures.push('verification mail throttling must be atomic across instances');
if (source.includes('rateLimit({') && source.includes('verificationMailLimiter')) failures.push('verification mail limiter must not use process-local express-rate-limit MemoryStore');
if (!source.includes('VERIFICATION_RATE_LIMIT_MAX = 3')) failures.push('verification mail limit must remain three requests per window');
if (!source.includes('sha256')) failures.push('verification rate-limit key must not persist the raw UID');
if (!source.includes('expiresAt')) failures.push('verification rate-limit records must have TTL-compatible expiry metadata');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Verification mail distributed rate-limit gate: PASS');
