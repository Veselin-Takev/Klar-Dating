import fs from 'node:fs';

const source = fs.readFileSync('src/server/passwordReset.ts', 'utf8');
const failures = [];
if (!source.includes("ACCOUNT_RATE_LIMIT_COLLECTION = 'password_reset_rate_limits'")) failures.push('password recovery must use a durable account-scoped rate-limit collection');
if (!source.includes('runTransaction')) failures.push('account-scoped rate limiting must be atomic across instances');
if (source.includes('new Map<string, number[]>')) failures.push('account-scoped recovery throttling must not rely on process-local memory');
if (!source.includes('ACCOUNT_RATE_LIMIT_MAX = 3')) failures.push('account recovery limit must remain three requests per window');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Password reset distributed rate-limit gate: PASS');
