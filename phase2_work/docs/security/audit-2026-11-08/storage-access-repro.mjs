import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(resolve('package.json'));
const {initializeTestEnvironment,assertFails,assertSucceeds}=require('@firebase/rules-unit-testing');
for(const name of ['FIREBASE_STORAGE_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST']) {
  assert.match(process.env[name]||'',/^127\.0\.0\.1:\d+$/, 'loopback emulators required');
}
const [sh,sp]=process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
const [fh,fp]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
const env=await initializeTestEnvironment({projectId:'demo-klar',
  storage:{host:sh,port:Number(sp),rules:readFileSync('storage.rules','utf8')},
  firestore:{host:fh,port:Number(fp),rules:readFileSync('firestore.rules','utf8')}});
const owner='audit-owner-'+crypto.randomUUID();
const path=`profiles/${owner}/synthetic.jpg`;
const store=(uid,provider='password',extra={})=>env.authenticatedContext(uid,{firebase:{sign_in_provider:provider,...extra}}).storage('gs://demo-klar.appspot.com');
const image=new Uint8Array([0xff,0xd8,0xff,0xe0]);
try {
  await assertSucceeds(store(owner).ref(path).put(image,{contentType:'image/jpeg'}));
  await assertFails(env.unauthenticatedContext().storage('gs://demo-klar.appspot.com').ref(path).getDownloadURL());
  await assertFails(store('foreign','password',{tenant:'tenant-a'}).ref(path).getDownloadURL());
  await assertSucceeds(store('audit-guest','anonymous').ref(path).getDownloadURL());
  await env.withSecurityRulesDisabled(async context=>{
    await context.firestore().doc('tenants/default/users/audit-minor').set({isAdult:false});
    await context.firestore().doc(`tenants/default/account_deletions/${owner}`).set({status:'pending'});
  });
  await assertSucceeds(store('audit-minor').ref(path).getDownloadURL());
  await assertSucceeds(store(owner).ref(`verification/${owner}/after-deletion-request.jpg`).put(image,{contentType:'image/jpeg'}));
  console.log(JSON.stringify({result:'SECURITY_GAPS_REPRODUCED',project:'demo-klar',
    anonymousProfileRead:'ALLOWED',underageProfileRead:'ALLOWED',
    verificationUploadAfterDeletionTombstone:'ALLOWED',
    unauthenticatedRead:'DENIED',foreignTenantRead:'DENIED',
    productionAccessed:false},null,2));
} finally { await env.cleanup(); }
