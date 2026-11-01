#!/usr/bin/env node
/**
 * Static wiring check for tenant Storage Emulator negatives. Only job logs can
 * prove actual execution; source checks cannot certify real deployed Rules.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export function nativeStorageTenantGateFailures({testSource,vitest,packageJson}) {
  const missing=[];
  for(const [id,needed] of [
    ['source_file',testSource.includes('initializeTestEnvironment')],
    ['storage_rule_file',testSource.includes("readFileSync('storage.rules'")],
    ['loopback_emulator',testSource.includes('FIREBASE_STORAGE_EMULATOR_HOST') &&
      testSource.includes('describe.skipIf(!emulatorOnly)')],
    ['legacy_media_cross_tenant_evidence',testSource.includes('legacy public profile photo remains readable across different tenant claims')],
    ['write_owner_fence',testSource.includes('cross-tenant outsider cannot overwrite or delete')],
    ['biometric_denial',testSource.includes('biometric verification image cannot be read')],
    ['future_tenant_default_deny',testSource.includes('new tenant-prefixed profile object is inaccessible')],
    ['real_client_rules_assertions',testSource.includes('assertFails(') && testSource.includes('assertSucceeds(')],
    ['synthetic_only_project',testSource.includes("projectId: 'demo-klar'")],
    ['not_vitest_excluded',!vitest.includes("'**/tenantStorageBoundary.emulator.spec.ts'") &&
      !vitest.includes('"**/tenantStorageBoundary.emulator.spec.ts"')],
    ['ci_storage_emulator',/emulators:exec[\s\S]*--only auth,firestore,storage/.test(packageJson.scripts?.['test:ci']||'')],
    ['enterprise_gate', (packageJson.scripts?.['check:enterprise']||'').split(/\s*&&\s*/).includes('npm run check:tenant-native-storage')],
  ]) if(!needed)missing.push(id);
  return missing;
}
const path=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===path){
  try {
    const root=resolve(dirname(path),'..');
    const testSource=readFileSync(resolve(root,'tests/tenantStorageBoundary.emulator.spec.ts'),'utf8');
    const vitest=readFileSync(resolve(root,'vitest.config.ts'),'utf8');
    const packageJson=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
    const failures=nativeStorageTenantGateFailures({testSource,vitest,packageJson});
    if(failures.length){
      process.stderr.write('BLOCKED: native tenant storage evidence gate: '+failures.join(', ')+'\n');
      process.exitCode=1;
    }else process.stdout.write('PASS: tenant Storage Rules negative evidence wired to emulator CI\n');
  }catch{
    process.stderr.write('BLOCKED: tenant Storage Rules evidence sources unavailable\n');
    process.exitCode=1;
  }
}
