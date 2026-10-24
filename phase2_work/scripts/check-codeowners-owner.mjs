// Compatibility entry point for the old PR #82 guard; use the complete policy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkCodeowners } from './check-codeowners.mjs';
const source = readFileSync(new URL('../../CODEOWNERS', import.meta.url), 'utf8');
assert.deepEqual(checkCodeowners(source), [], 'Technical CODEOWNERS path policy failed');
console.log('PASS: technical ownership only; independent release approvals remain separate');
