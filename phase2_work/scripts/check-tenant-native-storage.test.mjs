import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeStorageTenantGateFailures} from './check-tenant-native-storage.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const inputs={
  testSource:readFileSync(resolve(root,'tests/tenantStorageBoundary.emulator.spec.ts'),'utf8'),
  vitest:readFileSync(resolve(root,'vitest.config.ts'),'utf8'),
  packageJson:JSON.parse(readFileSync(resolve(root,'package.json'),'utf8')),
};
test('native Tenant Storage Rules negatives are mandatory alongside Firestore Rules and retention',()=>{
  assert.deepEqual(nativeStorageTenantGateFailures(inputs),[]);
});
for(const [label,mutate] of [
  ['metadata cross-tenant read omitted',x=>{x.testSource=x.testSource.replace("assertSucceeds(storage(other, 'tenant-beta').ref(path).getMetadata())","void storage(other, 'tenant-beta').ref(path).getMetadata()");}],
  ['biometric owner metadata denial omitted',x=>{x.testSource=x.testSource.replace("assertFails(storage(owner, 'tenant-alpha').ref(path).getMetadata())","void storage(owner, 'tenant-alpha').ref(path).getMetadata()");}],
  ['guest read test omitted',x=>{x.testSource=x.testSource.replace('anonymous signed-in guest can read legacy profile media','guest scenario no longer checked');}],
  ['guest anonymous claim omitted',x=>{x.testSource=x.testSource.replace("sign_in_provider: 'anonymous'", "sign_in_provider: 'password'");}],
  ['guest download evidence omitted',x=>{x.testSource=x.testSource.replace('assertSucceeds(guest.ref(path).getDownloadURL())', 'void guest.ref(path).getDownloadURL()');}],
  ['guest metadata evidence omitted',x=>{x.testSource=x.testSource.replace('assertSucceeds(guest.ref(path).getMetadata())', 'void guest.ref(path).getMetadata()');}],
  ['guest write denial omitted',x=>{x.testSource=x.testSource.replace('assertFails(Promise.resolve(guest.ref(path)', 'assertSucceeds(Promise.resolve(guest.ref(path)');}],
  ['guest delete denial omitted',x=>{x.testSource=x.testSource.replace('assertFails(guest.ref(path).delete())', 'assertSucceeds(guest.ref(path).delete())');}],
  ['legacy cross-tenant media exposure hidden',x=>{x.testSource=x.testSource.replace('legacy public profile photo remains readable across different tenant claims','hidden source gap');}],
  ['biometric photo restriction not tested',x=>{x.testSource=x.testSource.replace('biometric verification image cannot be read','not tested');}],
  ['tenant namespace default-deny test removed',x=>{x.testSource=x.testSource.replace('new tenant-prefixed profile object is inaccessible','not tested');}],
  ['loopback emulator omitted',x=>{x.testSource=x.testSource.replaceAll('FIREBASE_STORAGE_EMULATOR_HOST','PRODUCTION_STORAGE_ENDPOINT');}],
  ['rules evaluator missing',x=>{x.testSource=x.testSource.replaceAll('initializeTestEnvironment','mockRulesEvaluator');}],
  ['native test excluded from Vitest',x=>{x.vitest+="\n'**/tenantStorageBoundary.emulator.spec.ts'";}],
  ['Storage emulator removed from CI',x=>{x.packageJson.scripts['test:ci']=x.packageJson.scripts['test:ci'].replace('--only auth,firestore,storage','--only auth,firestore');}],
  ['new source check omitted from enterprise',x=>{x.packageJson.scripts['check:enterprise']=x.packageJson.scripts['check:enterprise'].replace('npm run check:tenant-native-storage && ','');}],
]){
  test('rejects tenant Storage test gap: '+label,()=>{
    const c=structuredClone(inputs);mutate(c);
    assert.notDeepEqual(nativeStorageTenantGateFailures(c),[]);
  });
}
