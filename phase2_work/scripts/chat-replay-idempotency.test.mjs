import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../src/server/messages.ts', import.meta.url), 'utf8');

test('existing message receipts are authorized before external AI safety calls', () => {
  const auth = server.indexOf('await readChatAccess(db, tx, chatId, uid, true);');
  const prior = server.indexOf('const prior = await db.transaction');
  const existing = server.indexOf('if (prior !== null)');
  const provider = server.indexOf('const safety = await assessSafetyMessage(text)');
  assert.ok(prior > -1 && auth > prior && existing > auth && provider > existing,
    'authorized idempotent receipt lookup must precede the external safety call');
  assert.match(server, /return clientMessageId \? tx\.read\(message, record\) : null/);
  assert.match(server, /prior\?\.senderId !== uid \|\| prior\?\.text !== text/);
  assert.match(server, /throw new ChatAccessError\(409, 'message_conflict'/);
  assert.match(server, /res\.json\(\{ success: true, messageId: messageId, messageHash: hash/);
});

test('new and concurrent retries still use safety gating and Firestore transactions', () => {
  const provider = server.indexOf('const safety = await assessSafetyMessage(text)');
  const writeTx = server.indexOf('await db.transaction(async tx => {', provider);
  assert.ok(provider > -1 && writeTx > provider);
  const writeBody = server.slice(writeTx);
  assert.match(writeBody, /await readChatAccess\(db, tx, chatId, uid, true\)/);
  assert.match(writeBody, /const existing = await tx\.read\(message, record\)/);
  assert.match(writeBody, /tx\.create\(message, record, \{/);
  assert.match(server, /const messageId = clientMessageId \? `\$\{uid\}_\$\{clientMessageId\}`/);
});

test('client supplied identity never overrides verified sender on retry or new write', () => {
  assert.match(server, /const uid = currentUserId\(req\)/);
  assert.match(server, /\[body\.uid, body\.ownerUid, body\.senderId\]\.some\(claim => claim !== undefined && claim !== uid\)/);
  assert.match(server, /senderId: uid/);
  assert.match(server, /const db = getServiceRepository\('auth'\)/);
});
