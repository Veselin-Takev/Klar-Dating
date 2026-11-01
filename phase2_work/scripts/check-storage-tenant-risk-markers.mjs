#!/usr/bin/env node
/** Read-only, source-level P0 #254 storage risk markers. Not a rules parser. */
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const markerDefinitions=Object.freeze([
  {id:'flat_verification_object_path',pattern:/\bmatch\s+\/verification\/\{uid\}\/\{datei\}/},
  {id:'flat_profile_object_path',pattern:/\bmatch\s+\/profiles\/\{uid\}\/\{datei\}/},
  {id:'authenticated_only_profile_read',pattern:/\ballow\s+read\s*:\s*if\s+signedIn\s*\(\s*\)\s*;/},
  {id:'verification_update_allowed',pattern:/\ballow\s+create\s*,\s*update\s*:/},
  {id:'explicit_tenant_storage_namespace',pattern:/\bmatch\s+\/tenants\/\{tenantId\}/},
]);

export function storageSourceRiskEvidence(source) {
  if(typeof source!=='string'||!source.startsWith("rules_version = '2';")||
     !source.includes('service firebase.storage')) throw new Error('invalid_storage_rules_source');
  const lines=source.split(/\r?\n/);
  const markers=markerDefinitions.map(({id,pattern})=>({
    id,lines:lines.flatMap((line,index)=>pattern.test(line)?[index+1]:[]),
  }));
  const found=id=>markers.some(x=>x.id===id && x.lines.length>0);
  return {
    schemaVersion:1, path:'storage.rules',
    sha256:createHash('sha256').update(source).digest('hex'),
    markers,
    reviewRequired:found('authenticated_only_profile_read')||
      found('flat_verification_object_path')||!found('explicit_tenant_storage_namespace'),
    tenantIsolationCertified:false, livePermissionVerified:false,
    classification:'SOURCE_ONLY_MANUAL_REVIEW',
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
    process.stdout.write(JSON.stringify(storageSourceRiskEvidence(
      readFileSync(resolve(root,'storage.rules'),'utf8')))+'\n');
  }catch{
    process.stderr.write('BLOCKED: local Storage Rules source risk evidence failed\n');
    process.exitCode=1;
  }
}
