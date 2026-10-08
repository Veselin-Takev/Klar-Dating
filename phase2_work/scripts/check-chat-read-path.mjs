import fs from 'node:fs';
import path from 'node:path';

const chatPath = path.resolve('src/server/routes/chat.ts');
const source = fs.readFileSync(chatPath, 'utf8');
const marker = 'async function loadChatListAccess';
const start = source.indexOf(marker);
if (start === -1) throw new Error('Chat read-path gate failed: loader missing.');
const firstBrace = source.indexOf('{', start);
let depth = 0; let opened = false; let end = -1;
for (let i = firstBrace; i < source.length; i += 1) {
  if (source[i] === '{') { depth += 1; opened = true; }
  else if (source[i] === '}' && opened) { depth -= 1; if (depth === 0) { end = i + 1; break; } }
}
if (end === -1) throw new Error('Chat read-path gate failed: loader boundary missing.');
const loader = source.slice(start, end);
const count = (re) => loader.match(re)?.length ?? 0;
if (count(/\\bdb\\.runTransaction\\s*\\(/g) !== 1) throw new Error('Chat read-path gate failed: exactly one bounded transaction required.');
if (count(/\\btx\\.getAll\\s*\\(/g) !== 1) throw new Error('Chat read-path gate failed: exactly one tx.getAll required.');
if (count(/public_profiles.*\\.get\\s*\\(/g) !== 0) throw new Error('Chat read-path gate failed: per-entry profile reads forbidden.');
if (count(/entries\\.map\\s*\\(\\s*async\\b/g) !== 0) throw new Error('Chat read-path gate failed: async per-entry mapping forbidden.');
const routeStart = source.indexOf("router.get('/chats'");
if (routeStart === -1) throw new Error('Chat read-path gate failed: /api/chats route missing.');
if (!source.slice(routeStart, routeStart + 1800).includes('loadChatListAccess(db, snapshot, uid)')) throw new Error('Chat read-path gate failed: /api/chats must use bounded loader.');
console.log('Chat read-path boundary: PASS (bounded transaction + batched access/profile reads)');
