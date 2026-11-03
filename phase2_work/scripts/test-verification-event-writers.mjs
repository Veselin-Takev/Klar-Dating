import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readVerificationEventSourceMap, verificationEventWriterViolations,
} from './check-verification-event-writers.mjs';

const baseline = readVerificationEventSourceMap();
const mutate = (path, transform) => {
  const copy = new Map(baseline);
  copy.set(path, transform(copy.get(path) ?? ''));
  return verificationEventWriterViolations(copy);
};

test('reviewed production verification_events references are explicitly inventoried', () => {
  assert.deepEqual(verificationEventWriterViolations(baseline), []);
});

test('new production writer file must trigger fail-closed review', () => {
  assert.match(
    mutate('src/server/routes/unreviewedRetention.ts', () =>
      "db.collection('verification_events').doc(id).update({ status: 'pending' });",
    ).join('\n'),
    /unreviewed verification_events reference/,
  );
});

test('extra verification event operation in an existing approved source must trigger review', () => {
  assert.match(
    mutate('src/server/klarCore.ts', value =>
      value + "\nfirestore.collection('verification_events').doc(id).delete();",
    ).join('\n'),
    /reference count drift/,
  );
});

test('removing an approved creation operation is detected', () => {
  assert.match(
    mutate('src/server/klarCore.ts', value =>
      value.replace('tx.create(firestore.collection', 'tx.update(firestore.collection'),
    ).join('\n'),
    /authorized operation drift/,
  );
});

test('removing a reviewed source is detected', () => {
  const copy = new Map(baseline);
  copy.delete('src/server/trustAndSafety.ts');
  assert.match(verificationEventWriterViolations(copy).join('\n'), /missing verification_events reviewed source/);
});
