import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const queue = readFileSync(new URL('../src/lib/offlineQueue.ts', import.meta.url), 'utf8');
const syncBanner = readFileSync(new URL('../src/components/SyncBanner.tsx', import.meta.url), 'utf8');
const auth = readFileSync(new URL('../src/lib/AuthContext.tsx', import.meta.url), 'utf8');
const send = readFileSync(new URL('../src/server/messages.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('protected API obtains and verifies Firebase identity before mounting chat router', () => {
  assert.match(server, /verifyIdToken\(idToken, true\)/);
  assert.match(server, /req\.user = decodedToken/);
  assert.ok(server.indexOf('req.user = decodedToken') < server.indexOf("app.use('/api', createChatRouter())"));
  assert.match(send, /const uid = currentUserId\(req\)/);
});

test('sender claims in offline message body cannot disagree with verified token', () => {
  assert.match(send, /\[body\.uid, body\.ownerUid, body\.senderId\]\.some\(claim => claim !== undefined && claim !== uid\)/);
  assert.match(send, /code: 'sender_mismatch'/);
  assert.match(send, /const prior = await db\.runTransaction\(async \(tx: Transaction\) => \{/);
  assert.match(send, /await readChatAccess\(db, tx, chatId, uid, true\)/);
  assert.match(send, /await readChatAccess\(db, tx, chatId, uid, true\)/);
  assert.match(send, /senderId: uid/);
});

test('offline replay cancels before every send and after network awaits', () => {
  assert.match(queue, /signal\?: AbortSignal/);
  assert.match(queue, /isCurrentUser\?: \(\) => boolean/);
  assert.match(queue, /if \(!mayReplay\(\)\) break/);
  assert.ok((queue.match(/if \(!mayReplay\(\)\) break;/g) ?? []).length >= 4);
  assert.match(queue, /signal: options\.signal/);
});

test('auth changes and logout initiation cancel offline replay and errors are handled', () => {
  assert.match(auth, /window\.dispatchEvent\(new Event\(OFFLINE_REPLAY_CANCEL_EVENT\)\)/);
  assert.ok(auth.indexOf('window.dispatchEvent(new Event(OFFLINE_REPLAY_CANCEL_EVENT))') < auth.indexOf("await authFetch('/api/auth/logout'"));
  assert.match(syncBanner, /window\.addEventListener\(OFFLINE_REPLAY_CANCEL_EVENT, cancelReplay\)/);
  assert.match(syncBanner, /pausedUid = auth\.currentUser\?\.uid \?\? null/);
  assert.match(syncBanner, /active\.controller\.abort\(\)/);
  assert.match(syncBanner, /isCurrentUser: isCurrent/);
  assert.match(syncBanner, /if \(isCurrent\(\)\) setSyncError\(true\)/);
});
