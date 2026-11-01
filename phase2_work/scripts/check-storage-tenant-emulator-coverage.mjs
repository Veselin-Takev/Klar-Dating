#!/usr/bin/env node
// Fail closed if executable, emulator-backed P0 #254 Storage policy regressions
// are removed or silently excluded from CI. Source coverage is NOT run proof.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export function storageTenantCoverageFailures({suite,config,manifest}) {
  const errors=[];
  const required=[
    "P0 #254: cross-tenant signed-in profile metadata is CURRENTLY readable",
    "P0 #254: cross-tenant clients and owner cannot read biometric verification photos",
    "assertLoopbackStorageEmulator()",
    "tenantUser(ownerUid, 'tenant-A')",
    "tenantUser(otherUid, 'tenant-B')",
    "assertSucceeds(otherTenant.ref(path).getMetadata())",
    "assertFails(otherTenant.ref(path).getMetadata())",
    "assertFails(otherTenant.ref(path).delete())",
    "finally {",
  ];
  if(typeof suite!=='string'||required.some(x=>!suite.includes(x)))errors.push('native_storage_tenant_policy_suite_missing');
  if(typeof config!=='string'||!config.includes('process.env.FIREBASE_STORAGE_EMULATOR_HOST')||
      !config.includes("'**/storageRules.spec.ts'")) errors.push('vitest_storage_emulator_guard_missing');
  if(!manifest?.scripts || !manifest.scripts['test:ci']?.includes('--only auth,firestore,storage') ||
      !manifest.scripts['test:ci']?.includes('npm test'))errors.push('storage_emulator_ci_missing');
  return errors;
}
const here=fileURLToPath(import.meta.url);
if(process.argv[1]&&resolve(process.argv[1])===here){
  try{
    const root=resolve(dirname(here),'..');
    const source=readFileSync(resolve(root,'tests/storageRules.spec.ts'),'utf8');
    const config=readFileSync(resolve(root,'vitest.config.ts'),'utf8');
    const manifest=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
    const failures=storageTenantCoverageFailures({suite:source,config,manifest});
    if(failures.length) { process.stderr.write('BLOCKED: '+failures.join(', ')+'\n');process.exitCode=1;}
    else process.stdout.write('PASS: P0 #254 native Storage Emulator policy tests wired to CI\n');
  }catch {process.stderr.write('BLOCKED: unable to verify Storage tenant emulator coverage\n');process.exitCode=1;}
}
