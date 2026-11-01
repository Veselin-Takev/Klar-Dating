import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {storageSourceRiskEvidence} from './check-storage-tenant-risk-markers.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'storage.rules'),'utf8');
test('actual checked-in Storage Rules preserve explicit source-only risk review',()=>{
  const evidence=storageSourceRiskEvidence(source);
  assert.equal(evidence.sha256,createHash('sha256').update(source).digest('hex'));
  assert.equal(evidence.reviewRequired,true);
  assert.equal(evidence.tenantIsolationCertified,false);
  assert.equal(evidence.livePermissionVerified,false);
  for(const marker of ['flat_verification_object_path','flat_profile_object_path',
    'authenticated_only_profile_read','verification_update_allowed']){
    assert.ok(evidence.markers.some(x=>x.id===marker&&x.lines.length>0),marker);
  }
  const run=spawnSync(process.execPath,['scripts/check-storage-tenant-risk-markers.mjs'],
    {cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(JSON.parse(run.stdout),evidence);
  assert.ok(!run.stdout.includes('allow read:'));
});
test('fail closed for invalid source; source markers do not claim effective authorization',()=>{
  assert.throws(()=>storageSourceRiskEvidence('allow read: if true;'),/invalid_storage_rules_source/);
  const synthetic="rules_version = '2';\nservice firebase.storage { match /b/{bucket}/o { match /tenants/{tenantId}/files/{id} { allow read: if false; } } }";
  const evidence=storageSourceRiskEvidence(synthetic);
  assert.equal(evidence.reviewRequired,false);
  assert.equal(evidence.tenantIsolationCertified,false);
  assert.equal(evidence.livePermissionVerified,false);
});
