import fs from 'node:fs';

const file = fs.readFileSync('src/server/routes/chat.ts', 'utf8');
const required = [
  "const chatListReadLimiter = rateLimit({",
  "windowMs: 60 * 1000",
  "limit: 20",
  "const chatDetailReadLimiter = rateLimit({",
  "limit: 60",
  "keyGenerator: (req) => currentUserId(req) ?? req.ip ?? 'unknown'",
  "router.get('/chats', chatListReadLimiter",
  "router.get('/chats/:chatId', chatDetailReadLimiter",
];
for (const needle of required) {
  if (!file.includes(needle)) throw new Error(`Missing chat read boundary: ${needle}`);
}
console.log('Chat read resource boundary: PASS');

const chatSource = file;
if (!chatSource.includes('const markReadLimiter = rateLimit({')) throw new Error('Missing mark-read limiter');
if (!/router\.post\('\/messages\/mark-read',\s*markReadLimiter,\s*async \(req, res\) =>/.test(chatSource)) throw new Error('Mark-read limiter not mounted');
if (!/limit:\s*30/.test(chatSource)) throw new Error('Mark-read limit must be 30/min');
console.log('Chat mark-read resource boundary: PASS');
