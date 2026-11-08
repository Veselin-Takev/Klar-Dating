import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifySemgrepCoverage } from './check-semgrep-coverage.mjs';
const report = () => ({
  results: [],
  errors: [],
  paths: { scanned: ['../phase2_work/server.ts'] },
});
test('accepts complete first-party runtime coverage', () =>
  assert.equal(
    verifySemgrepCoverage(report(), ['phase2_work/server.ts']).missing,
    0,
  ));
test('rejects even one omitted runtime file', () =>
  assert.throws(
    () => verifySemgrepCoverage(report(), ['phase2_work/src/server/rogue.ts']),
    /Unscanned/,
  ));
test('rejects parser diagnostics despite an empty finding list', () =>
  assert.throws(
    () =>
      verifySemgrepCoverage(
        { ...report(), errors: [{ type: 'PartialParsing' }] },
        [],
      ),
    /diagnostics/,
  ));
test('rejects findings and missing target evidence', () => {
  assert.throws(() =>
    verifySemgrepCoverage({ ...report(), results: [{}] }, []),
  );
  assert.throws(() => verifySemgrepCoverage({ results: [], errors: [] }, []));
});
