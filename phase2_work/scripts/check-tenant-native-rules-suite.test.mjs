import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeTenantGateFailures} from './check-tenant-native-rules-suite.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fixture={
  tests:readFileSync(resolve(root,'tests/tenantRulesBoundary.emulator.spec.ts'),'utf8'),
  vitest:readFileSync(resolve(root,'vitest.config.ts'),'utf8'),
  packageJson:JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')),
};
test('native Tenant Rules emulator suite is mandatory, with live negative and legacy proof',()=>{
  assert.deepEqual(nativeTenantGateFailures(fixture),[]);
});
for(const [name,modify] of [
  ['UID legacy claim comparison removed', x=>{x.tests=x.tests.replace('legacy root access remains UID-only','no legacy proof');}],
  ['tenant namespace default-deny removed', x=>{x.tests=x.tests.replace('current tenant-namespaced data is deny-by-default','no tenant proof');}],
  ['cross-user BOLA rejection removed', x=>{x.tests=x.tests.replace('another UID cannot read, overwrite','no cross user proof');}],
  ['same-tenant admin denial removed', x=>{x.tests=x.tests.replace('forged admin role or tenantId claim','no admin proof');}],
  ['real Rules interpreter removed', x=>{x.tests=x.tests.replaceAll('assertFails(', 'fakeAssertFails(');}],
  ['loopback emulator requirement removed', x=>{x.tests=x.tests.replaceAll('FIRESTORE_EMULATOR_HOST','PRODUCTION_FIRESTORE_HOST');}],
  ['native test excluded by config', x=>{x.vitest += "\n'**/tenantRulesBoundary.emulator.spec.ts'";}],
  ['native rules gate unwired', x=>{x.packageJson.scripts['check:enterprise']=x.packageJson.scripts['check:enterprise'].replace('npm run check:tenant-native-rules && ', '');}],
  ['Firestore emulator excluded from CI', x=>{x.packageJson.scripts['test:ci']=x.packageJson.scripts['test:ci'].replace('--only auth,firestore,storage','--only auth,storage');}],
]){
  test('fail closed for native Tenant Rules gate mutation: '+name,()=>{
    const c=structuredClone(fixture);
    modify(c);
    assert.notDeepEqual(nativeTenantGateFailures(c),[]);
  });
}
