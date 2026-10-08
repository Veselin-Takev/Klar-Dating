import fs from 'node:fs';
const source = fs.readFileSync('src/server/routes/chat.ts', 'utf8');
const failures = [];
if (!source.includes("CHAT_MESSAGE_RATE_LIMIT_COLLECTION = 'chat_message_rate_limits'")) failures.push('chat message limiter must use a durable account-scoped collection');
if (!source.includes('runTransaction')) failures.push('chat message limiter must be atomic across instances');
if (!source.includes('CHAT_MESSAGE_RATE_LIMIT_MAX = 20')) failures.push('chat message limit must remain twenty requests per minute');
if (!source.includes('sha256')) failures.push('chat message rate-limit key must not persist the raw UID');
if (!source.includes('expiresAt')) failures.push('chat message rate-limit records need TTL-compatible expiry metadata');
if (!source.includes("router.post('/messages/send', messageSendLimiter")) failures.push('message send route must use distributed limiter');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('Chat message distributed rate-limit gate: PASS');
