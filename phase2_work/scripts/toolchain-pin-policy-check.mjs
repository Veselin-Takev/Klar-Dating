import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkWorkflowToolchain, APPROVED_SETUP_NODE, APPROVED_SETUP_BUN } from './toolchainPinPolicy.mjs';

const valid = `jobs:
  validate:
    steps:
      - uses: actions/setup-node@${APPROVED_SETUP_NODE} # pinned
        with:
          node-version: '22.23.3'
      - uses: oven-sh/setup-bun@${APPROVED_SETUP_BUN}
        with:
          bun-version: '1.4.4'
`;

test('accepts exact active immutable action pins', () => {
  assert.deepEqual(checkWorkflowToolchain(valid, 'ci.yml'), []);
});
test('rejects old/unsupported active setup-node despite approved pin in comment', () => {
  const tampered = valid.replace(`- uses: actions/setup-node@${APPROVED_SETUP_NODE}`, '- uses: actions/setup-node@v7');
  assert.ok(checkWorkflowToolchain(`# actions/setup-node@${APPROVED_SETUP_NODE}\n${tampered}`, 'ci.yml').some(x => x.includes('actions/setup-node')));
});
test('rejects extra setup-node step with unapproved pin', () => {
  assert.ok(checkWorkflowToolchain(valid + '\n      - uses: actions/setup-node@v7\n', 'ci.yml').some(x => x.includes('actions/setup-node')));
});
test('rejects commented-out Bun pin', () => {
  const tampered = valid.replace(`      - uses: oven-sh/setup-bun@${APPROVED_SETUP_BUN}
        with:
          bun-version: '1.4.4'`, `# - uses: oven-sh/setup-bun@${APPROVED_SETUP_BUN}
        with:
          bun-version: '1.4.4'`);
  assert.ok(checkWorkflowToolchain(tampered, 'ci.yml').some(x => x.includes('setup-bun')));
});
test('rejects wrong active Node version', () => {
  assert.ok(checkWorkflowToolchain(valid.replace("node-version: '22.23.3'", "node-version: '26.11.1'"), 'ci.yml').some(x => x.includes('Node')));
});

test('rejects mixed, missing or mutable Bun versions despite an approved comment', () => {
  for (const altered of [valid.replace("bun-version: '1.4.4'", "bun-version: '1.4.2'"), valid.replace("bun-version: '1.4.4'", "bun-version: latest"), valid.replace("bun-version: '1.4.4'", "# bun-version: '1.4.4'"), valid + "\n          bun-version: '1.4.2'\n"]) {
    assert.ok(checkWorkflowToolchain(altered, 'ci.yml').some(x => x.includes('Bun 1.4.4')));
  }
});
