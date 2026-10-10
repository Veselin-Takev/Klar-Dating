import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLocalProvenance } from './verify-local-provenance.mjs';
const sha = 'a'.repeat(40);
const git = (cmd, args) => args[0] === 'rev-parse' ? ` ${sha}\n` : '\n';
test('accept clean checkout with exact SHA', () => assert.equal(verifyLocalProvenance('/repo', git), sha));
test('reject dirty checkout', () => assert.throws(() => verifyLocalProvenance('/repo', (cmd, args) => args[0] === 'rev-parse' ? sha : ' M src/App.tsx'), /clean checkout/));
test('reject malformed SHA', () => assert.throws(() => verifyLocalProvenance('/repo', () => 'bad'), /Invalid Git/));
test('propagate Git failures', () => assert.throws(() => verifyLocalProvenance('/repo', () => { throw Error('not a repository'); }), /not a repository/));
