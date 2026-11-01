#!/usr/bin/env node
/** Source-only safety gate, not a substitute for executed native Emulator tests. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function nativeTenantGateFailures({ tests, vitest, packageJson }) {
  const fail=[];
  const checks=[
    ['native_rules_test_missing', tests.includes('describe.skipIf(!emulatorOnly && !ciRequiresEmulator)')],
    ['missing_legacy_uid_tenant_claim_proof', tests.includes('legacy root access remains UID-only')],
    ['missing_tenant_namespace_default_deny', tests.includes('current tenant-namespaced data is deny-by-default')],
    ['missing_cross_user_idor_denial', tests.includes('another UID cannot read, overwrite')],
    ['missing_admin_claim_denial', tests.includes('forged admin role or tenantId claim')],
    ['missing_unauthenticated_denial', tests.includes('unauthenticated users cannot access')],
    ['missing_real_firebase_rules_evaluator', tests.includes('initializeTestEnvironment') &&
      tests.includes('assertFails(') && tests.includes('assertSucceeds(')],
    ['missing_loopback_demo_project_guard', tests.includes("projectId: 'demo-klar'") &&
      tests.includes('FIRESTORE_EMULATOR_HOST') && tests.includes('emulatorOnly')],
    ['vitest_excludes_native_tenant_test', !vitest.includes("'**/tenantRulesBoundary.emulator.spec.ts'") &&
      !vitest.includes('"**/tenantRulesBoundary.emulator.spec.ts"')],
    ['ci_does_not_start_firestore_emulator', /emulators:exec[\s\S]*--only auth,firestore,storage/.test(packageJson.scripts?.['test:ci']??'')],
  ];
  for(const [name,passes] of checks) if(!passes)fail.push(name);
  const enterprise=packageJson.scripts?.['check:enterprise']??'';
  if(!enterprise.split(/\s*&&\s*/).includes('npm run check:tenant-native-rules'))
    fail.push('native_tenant_rules_gate_not_in_enterprise');
  return fail;
}

const here=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===here){
  try {
    const root=resolve(dirname(here),'..');
    const tests=readFileSync(resolve(root,'tests/tenantRulesBoundary.emulator.spec.ts'),'utf8');
    const vitest=readFileSync(resolve(root,'vitest.config.ts'),'utf8');
    const packageJson=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
    const failures=nativeTenantGateFailures({tests,vitest,packageJson});
    if(failures.length){
      process.stderr.write('BLOCKED: native Tenant Rules evidence gate: '+failures.join(', ')+'\n');
      process.exitCode=1;
    } else process.stdout.write('PASS: native Tenant Rules negatives are wired into Firestore-emulator CI\n');
  } catch {
    process.stderr.write('BLOCKED: native Tenant Rules evidence files not found\n');
    process.exitCode=1;
  }
}
