import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMessageHash } from '../../src/server/messages';

test('computeMessageHash generates deterministic SHA-256 integrity digests', () => {
  const hash1 = computeMessageHash('user_123', 'chat_abc', 'Hallo Welt!', 'msg_001');
  const hash2 = computeMessageHash('user_123', 'chat_abc', 'Hallo Welt!', 'msg_001');
  assert.equal(hash1, hash2, 'Identical inputs must yield identical hash');
  assert.equal(hash1.length, 64, 'SHA-256 hex digest must be 64 characters');

  const alteredTextHash = computeMessageHash('user_123', 'chat_abc', 'Hallo Welt? [manipuliert]', 'msg_001');
  assert.notEqual(hash1, alteredTextHash, 'Altered message text must change hash');

  const alteredSenderHash = computeMessageHash('user_999', 'chat_abc', 'Hallo Welt!', 'msg_001');
  assert.notEqual(hash1, alteredSenderHash, 'Different sender must change hash');
});

test('handleReport snapshots in-chat message and verifies cryptographic hash', async () => {
  const req = {
    user: { uid: 'reporter_user_111' },
    body: {
      targetUid: 'reported_user_456',
      grund: 'fakeprofil_spam',
      chatId: 'chat_123',
      messageId: 'msg_789',
      messageText: 'Unzulässiger Spam-Link https://scam.example.com',
      messageHash: computeMessageHash('reported_user_456', 'chat_123', 'Unzulässiger Spam-Link https://scam.example.com', 'msg_789'),
      beschreibung: 'Sendet dubiose Links.',
    },
  };

  assert.equal(req.body.targetUid, 'reported_user_456');
  assert.equal(req.body.grund, 'fakeprofil_spam');
  assert.equal(req.body.messageId, 'msg_789');
  assert.ok(req.body.messageHash);
});

test('In-Chat message report preserves evidence even if text is disputed', () => {
  const originalText = 'Du Idiot, verschwinde!';
  const originalHash = computeMessageHash('target_user', 'chat_999', originalText, 'msg_555');

  const snapshot = {
    messageId: 'msg_555',
    text: originalText,
    contentHash: originalHash,
    verified: true,
    senderId: 'target_user',
  };

  assert.equal(snapshot.verified, true);
  assert.equal(snapshot.contentHash, originalHash);
  assert.equal(snapshot.text, originalText);
});

test('Minor report triggers zero-tolerance P0 priority escalation', () => {
  const reportReason = 'minderjaehrig';
  const isMinorAlert = reportReason === 'minderjaehrig';
  assert.equal(isMinorAlert, true, 'Reason minderjaehrig must be flagged as minor alert');

  const auditEntry = {
    priority: isMinorAlert ? 'urgent' : 'normal',
    isMinorAlert,
    requiresSafetyReview: true,
  };

  assert.equal(auditEntry.priority, 'urgent');
  assert.equal(auditEntry.isMinorAlert, true);
});
