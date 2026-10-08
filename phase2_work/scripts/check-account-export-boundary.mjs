import fs from 'node:fs';

const account = fs.readFileSync('src/server/routes/account.ts', 'utf8');
const data = fs.readFileSync('src/server/datenschutz.ts', 'utf8');

if (!account.includes('const accountExportLimiter = rateLimit({')) throw new Error('Missing account export limiter');
if (!/windowMs:\s*24 \* 60 \* 60 \* 1000/.test(account)) throw new Error('Account export limiter must use a 24h window');
if (!/limit:\s*2/.test(account)) throw new Error('Account export limiter must allow at most 2 requests per 24h');
if (!/router\.get\('\/account\/export', accountExportLimiter, handleExport\)/.test(account)) throw new Error('Account export limiter not mounted');
if (!/\.where\('participants', 'array-contains', meineUid\)\.limit\(CHAT_GRENZE \+ 1\)\.get\(\)/.test(data)) throw new Error('Chat export query must be bounded at database level');
if (!data.includes('const CHAT_GRENZE = 200;')) throw new Error('Chat export limit missing');

console.log('Account export resource boundary: PASS');
