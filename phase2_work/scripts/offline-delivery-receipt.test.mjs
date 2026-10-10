import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAcknowledgedOfflineWrite } from '../src/lib/offlineDeliveryReceipt.ts';

for (const [name, receipt] of [
  ['null', null],
  ['undefined', undefined],
  ['empty object', {}],
  ['empty array', []],
  ['numeric success', { success: 1 }],
  ['string success', { success: 'true' }],
  ['negative success', { success: false }],
  ['error only', { error: 'transient' }],
  ['true primitive', true],
]) {
  test('offline delivery acknowledgement rejects ' + name, () => {
    assert.equal(isAcknowledgedOfflineWrite(receipt), false);
  });
}

test('offline delivery acknowledges only explicit server success true', () => {
  assert.equal(isAcknowledgedOfflineWrite({ success: true, messageId: 'stored-id' }), true);
});

test('both legacy and persistent send paths require the same explicit acknowledgement', () => {
  const source = readFileSync(new URL('../src/lib/offlineQueue.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{ isAcknowledgedOfflineWrite \} from '\.\/offlineDeliveryReceipt'/);
  assert.equal((source.match(/if \(res\.ok && isAcknowledgedOfflineWrite\(/g) ?? []).length, 2);
  assert.match(source, /const errMsg = res\.ok \? 'message_acknowledgement_missing' : responseError\(res, receipt\)/);
  assert.match(source, /const error = res\.ok \? 'message_acknowledgement_missing' : responseError\(res, body\)/);
  assert.match(source, /\(!res\.ok && !retryableStatus\(res\.status\)\)/);
  assert.match(source, /if \(!res\.ok && !retryableStatus\(res\.status\)\)/);
});
