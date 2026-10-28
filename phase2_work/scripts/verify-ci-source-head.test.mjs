import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSourceHead } from './verify-ci-source-head.mjs';
const sha = 'a'.repeat(40);
test('accepts exact SHA', () => assert.equal(validateSourceHead(sha, sha), sha));
test('rejects merge or stale SHA', () => assert.throws(() => validateSourceHead('b'.repeat(40), sha), /mismatch/));
test('rejects missing or malformed SHA', () => { for (const x of ['', undefined, null, 'abc', 'A'.repeat(40)]) { assert.throws(() => validateSourceHead(sha, x)); assert.throws(() => validateSourceHead(x, sha)); } });
test('workflow attests source before scope decisions', () => { const w = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'); const ref = w.indexOf('          ref: ${{ github.event.pull_request.head.sha || github.sha }}'); const att = w.indexOf('      - name: Verify exact source HEAD'); const scope = w.indexOf('      - name: Determine validation scope'); assert.ok(ref >= 0 && att > ref && scope > att); });
