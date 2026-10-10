import test from 'node:test';
import assert from 'node:assert/strict';
import { assertExpectedReleaseSha } from './expected-sha.mjs';
const sha='a'.repeat(40);
test('accepts exact release commit',()=>assert.doesNotThrow(()=>assertExpectedReleaseSha(sha,sha)));
test('rejects missing expected commit',()=>assert.throws(()=>assertExpectedReleaseSha(sha,undefined),/KLAR_EXPECTED_SHA/));
test('rejects abbreviated expected commit',()=>assert.throws(()=>assertExpectedReleaseSha(sha,sha.slice(0,12)),/40-character/));
test('rejects uppercase expected commit',()=>assert.throws(()=>assertExpectedReleaseSha(sha,'A'.repeat(40)),/lowercase/));
test('rejects wrong clean commit',()=>assert.throws(()=>assertExpectedReleaseSha(sha,'b'.repeat(40)),/does not match/));
