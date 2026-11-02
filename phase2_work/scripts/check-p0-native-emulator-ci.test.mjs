import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeP0CIFailures } from './check-p0-native-emulator-ci.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'tests/tenantStorageBoundary.emulator.spec.ts',
  'tests/tenantRulesBoundary.emulator.spec.ts',
  'tests/verificationPurgeWorkFirestore.emulator.spec.ts',
];
const fixture = {
  suites: Object.fromEntries(paths.map(p => [p, readFileSync(resolve(root, p), 'utf8')])),
  vitest: readFileSync(resolve(root, 'vitest.config.ts'), 'utf8'),
  manifest: JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')),
};
const clone = () => structuredClone(fixture);

test('all three real P0 emulator suites fail closed if CI lacks emulators', () => {
  assert.deepEqual(nativeP0CIFailures(fixture), []);
});

for (const path of paths) {
  for (const [name, before, after] of [
    ['silent CI skip restored',
      'describe.skipIf(!emulatorOnly && !ciRequiresEmulator)',
      'describe.skipIf(!emulatorOnly)'],
    ['CI detection disabled',
      "const ciRequiresEmulator = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';",
      'const ciRequiresEmulator = false;'],
  ]) {
    test(path + ' rejects ' + name, () => {
      const changed = clone();
      assert.ok(changed.suites[path].includes(before), 'mutation fixture must exist');
      changed.suites[path] = changed.suites[path].replace(before, after);
      assert.ok(nativeP0CIFailures(changed).length > 0);
    });
  }
  test(path + ' rejects loss of fail-closed SDK preflight', () => {
    const changed = clone();
    const before = path.includes('verificationPurgeWork')
      ? "if (!emulatorOnly) throw new Error('retention_firestore_emulator_loopback_required');"
      : path.includes('tenantStorage')
        ? "if (!emulatorOnly || !match) throw new Error('tenant_storage_loopback_required');"
        : "if (!emulatorOnly || !match) throw new Error('firebase_rules_loopback_emulator_required');";
    assert.ok(changed.suites[path].includes(before), 'mutation fixture must exist');
    changed.suites[path] = changed.suites[path].replace(before, 'void 0;');
    assert.ok(nativeP0CIFailures(changed).length > 0);
  });
  test(path + ' rejects a Vitest exclusion', () => {
    const changed = clone();
    changed.vitest += "\n'**/" + path + "'\n";
    assert.ok(nativeP0CIFailures(changed).some(x => x.endsWith('_vitest_excluded')));
  });
}
test('fails closed if real >300-record native retention census is removed', () => {
  const changed = clone();
  const path = 'tests/verificationPurgeWorkFirestore.emulator.spec.ts';
  const source = changed.suites[path];
  const marker = 'read-only census handles 350 real emulator records';
  assert.ok(source.includes(marker), 'required live-emulator test title must be present');
  changed.suites[path] = source.replace(marker, 'removed native census test');
  assert.ok(nativeP0CIFailures(changed).includes('retention_native_census_over300_missing'));
});

test('fails closed if the native 350-record audit omits noncanonical owner/path violations', () => {
  const changed = clone();
  const path = 'tests/verificationPurgeWorkFirestore.emulator.spec.ts';
  const expected = 'invalidOwnerOrPath: 4';
  assert.ok(changed.suites[path].includes(expected));
  changed.suites[path] = changed.suites[path].replace(expected, 'invalidOwnerOrPath: 0');
  assert.ok(nativeP0CIFailures(changed).includes('retention_native_census_over300_missing'));
});

test('rejects removal of native hold-type ambiguity count from 350-record census', () => {
  const changed = clone();
  const path = 'tests/verificationPurgeWorkFirestore.emulator.spec.ts';
  const expected = 'invalidHoldIndicators: 4';
  assert.ok(changed.suites[path].includes(expected));
  changed.suites[path] = changed.suites[path].replace(expected, 'invalidHoldIndicators: 0');
  assert.ok(nativeP0CIFailures(changed).includes('retention_native_census_over300_missing'));
});

test('fails closed if real census does not verify complete 350-record inventory', () => {
  const changed = clone();
  const path = 'tests/verificationPurgeWorkFirestore.emulator.spec.ts';
  const original = 'scanned: 350';
  assert.ok(changed.suites[path].includes(original));
  changed.suites[path] = changed.suites[path].replace(original, 'scanned: 0');
  assert.ok(nativeP0CIFailures(changed).includes('retention_native_census_over300_missing'));
});

for (const [name, change] of [
  ['Firebase Storage emulator omitted', m => { m.scripts['test:ci'] =
    m.scripts['test:ci'].replace('--only auth,firestore,storage', '--only auth,firestore'); }],
  ['demo project omitted', m => { m.scripts['test:ci'] =
    m.scripts['test:ci'].replace('--project demo-klar', '--project default'); }],
  ['source gate removed from mandatory enterprise CI', m => { m.scripts['check:enterprise'] =
    m.scripts['check:enterprise'].replace('npm run check:p0-native-emulator-ci && ', ''); }],
  ['negative tests removed from source command', m => { m.scripts['check:p0-native-emulator-ci'] =
    m.scripts['check:p0-native-emulator-ci'].replace(' && node --test scripts/check-p0-native-emulator-ci.test.mjs', ''); }],
  ['real missing-emulator regression removed', m => { m.scripts['check:p0-native-emulator-ci'] =
    m.scripts['check:p0-native-emulator-ci'].replace(' && node --test scripts/check-p0-native-emulator-runtime.test.mjs', ''); }],
]) test('reject CI regression: ' + name, () => {
  const changed = clone();
  change(changed.manifest);
  assert.ok(nativeP0CIFailures(changed).length > 0);
});
