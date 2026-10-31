
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO='Veselin-Takev/Klar-Dating';
const RULESET=25756841;
export function validateMainRuleset(v) {
  if (!v || v.id!==RULESET || v.source!==REPO || v.source_type!=='Repository' ||
      v.enforcement!=='active' || !Array.isArray(v.bypass_actors) ||
      v.bypass_actors.length!==0 || !Array.isArray(v.rules) ||
      !Array.isArray(v.conditions?.ref_name?.include) ||
      !v.conditions.ref_name.include.includes('refs/heads/main') ||
      !Array.isArray(v.conditions.ref_name.exclude) ||
      v.conditions.ref_name.exclude.includes('refs/heads/main')) throw Error('ruleset_identity_invalid');
  const p=v.rules.find(r=>r.type==='pull_request')?.parameters;
  const c=v.rules.find(r=>r.type==='required_status_checks')?.parameters;
  if(!v.rules.some(r=>r.type==='deletion') || !v.rules.some(r=>r.type==='non_fast_forward') ||
     !p || !Number.isSafeInteger(p.required_approving_review_count) ||
     p.required_approving_review_count<1 || p.require_code_owner_review!==true ||
     p.dismiss_stale_reviews_on_push!==true || p.require_last_push_approval!==true ||
     p.required_review_thread_resolution!==true || !c ||
     c.strict_required_status_checks_policy!==true || c.do_not_enforce_on_create!==false ||
     !Array.isArray(c.required_status_checks) ||
     !c.required_status_checks.some(x=>x.context==='validate' && Number.isSafeInteger(x.integration_id) && x.integration_id>0))
    throw Error('ruleset_review_requirement_missing');
  return {schemaVersion:1, repository:REPO, rulesetId:RULESET, requiredApprovals:p.required_approving_review_count, codeOwners:true, strictCi:true};
}
export async function verifyLiveMainRuleset({repository,sha,token,fetcher=fetch}) {
  if(repository!==REPO || typeof sha!=='string' || !/^[a-f0-9]{40}$/.test(sha) ||
     typeof token!=='string' || !token) throw Error('ruleset_missing_inputs');
  const response=await fetcher('https://api.github.com/repos/'+REPO+'/rulesets/'+RULESET,{
    method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10'}
  });
  if(response?.status!==200 || !response.body) throw Error('ruleset_http_failed');
  const reader=response.body.getReader();const bytes=new Uint8Array(65536);let used=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;
    if(!(value instanceof Uint8Array) || value.byteLength>bytes.length-used)throw Error('ruleset_response_oversized');
    bytes.set(value,used);used+=value.byteLength;}}
  catch(e){await reader.cancel().catch(()=>{});throw e;} finally{reader.releaseLock();}
  let json;try{json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));}
  catch{throw Error('ruleset_json_invalid');}
  return {...validateMainRuleset(json), checkedCommit:sha,checkedAt:new Date().toISOString()};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    if(!/^refs\/tags\/v[0-9]+\.[0-9]+\.[0-9]+$/.test(process.env.GITHUB_REF??''))throw Error('release_tag_required');
    const evidence=await verifyLiveMainRuleset({repository:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA,token:process.env.GITHUB_TOKEN});
    mkdirSync('release',{recursive:true});writeFileSync('release/github-main-ruleset-evidence.json',JSON.stringify(evidence,null,2)+'\n',{mode:0o600});
    console.log('Main Ruleset configuration PASS (not human approval).');
  }catch{console.error('Main Ruleset governance FAIL: independent review or strict CI missing.');process.exitCode=1;}
}
