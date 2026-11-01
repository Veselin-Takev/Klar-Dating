import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {storageTenantCoverageFailures} from './check-storage-tenant-emulator-coverage.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const original={
  suite:readFileSync(resolve(root,'tests/storageRules.spec.ts'),'utf8'),
  config:readFileSync(resolve(root,'vitest.config.ts'),'utf8'),
  manifest:JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')),
};
test('two real tenant-claim Storage permission scenarios remain wired into CI',()=>{
  assert.deepEqual(storageTenantCoverageFailures(original),[]);
});
for(const [name,change] of [
 ['cross tenant readable evidence removed',x=>{x.suite=x.suite.replace('assertSucceeds(otherTenant.ref(path).getMetadata())','void otherTenant.ref(path).getMetadata()');}],
 ['biometrics denial removed',x=>{x.suite=x.suite.replace('assertFails(otherTenant.ref(path).getMetadata())','void otherTenant.ref(path).getMetadata()');}],
 ['tenant B authentication removed',x=>{x.suite=x.suite.replace("tenantUser(otherUid, 'tenant-B')","tenantUser(otherUid, 'tenant-A')");}],
 ['local Storage safety removed',x=>{x.suite=x.suite.replaceAll('assertLoopbackStorageEmulator()','void 0');}],
 ['storage emulator excluded from CI',x=>{x.manifest.scripts['test:ci']=x.manifest.scripts['test:ci'].replace('--only auth,firestore,storage','--only auth,firestore');}],
 ['rules suite explicitly omitted',x=>{x.config=x.config.replace("'**/storageRules.spec.ts'", "'**/unusedStorageRules.spec.ts'");}],
])test('reject coverage regression: '+name,()=>{
 const sample=structuredClone(original);change(sample);
 assert.notDeepEqual(storageTenantCoverageFailures(sample),[]);
});
