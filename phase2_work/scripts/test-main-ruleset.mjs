
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateMainRuleset, verifyLiveMainRuleset } from './check-main-ruleset.mjs';

const repo='Veselin-Takev/Klar-Dating', sha='a'.repeat(40), token='test-token-never-sent';
const fixture=()=>({
 id:25756841,source:repo,source_type:'Repository',enforcement:'active',
 conditions:{ref_name:{include:['refs/heads/main'],exclude:[]}},bypass_actors:[],
 rules:[
 {type:'deletion'},{type:'non_fast_forward'},
 {type:'pull_request',parameters:{required_approving_review_count:2,require_code_owner_review:true,
    dismiss_stale_reviews_on_push:true,require_last_push_approval:true,required_review_thread_resolution:true}},
 {type:'required_status_checks',parameters:{strict_required_status_checks_policy:true,do_not_enforce_on_create:false,
    required_status_checks:[{context:'validate',integration_id:15368}]}}
]});
test('strict synthetic policy passes structural gate only',()=>assert.equal(validateMainRuleset(fixture()).requiredApprovals,2));
const mutationCases=[
 ['disabled',x=>x.enforcement='disabled'],['wrong ID',x=>x.id=1],['wrong repository',x=>x.source='other/repo'],
 ['missing main branch',x=>x.conditions.ref_name.include=[]],
 ['excluded main',x=>x.conditions.ref_name.exclude=['refs/heads/main']],
 ['missing exclusion list',x=>delete x.conditions.ref_name.exclude],
 ['bypass',x=>x.bypass_actors.push({actor_id:1})],
 ['zero approvals',x=>x.rules[2].parameters.required_approving_review_count=0],
 ['no owner review',x=>x.rules[2].parameters.require_code_owner_review=false],
 ['stale review',x=>x.rules[2].parameters.dismiss_stale_reviews_on_push=false],
 ['self review on latest push',x=>x.rules[2].parameters.require_last_push_approval=false],
 ['unresolved threads',x=>x.rules[2].parameters.required_review_thread_resolution=false],
 ['missing PR rule',x=>x.rules.splice(2,1)],
 ['non-strict CI',x=>x.rules[3].parameters.strict_required_status_checks_policy=false],
 ['missing validate',x=>x.rules[3].parameters.required_status_checks=[]],
 ['untrusted check',x=>x.rules[3].parameters.required_status_checks[0].integration_id=null],
 ['bypass new branch',x=>x.rules[3].parameters.do_not_enforce_on_create=true],
 ['missing deletion protection',x=>x.rules.shift()],
 ['missing force-push protection',x=>x.rules.splice(1,1)]
];
for(const [label,mutate] of mutationCases){
 test('deny '+label,()=>{const x=fixture();mutate(x);assert.throws(()=>validateMainRuleset(x));});
}
test('malformed structures never pass',()=>{for(const x of [null,{},[],{...fixture(),rules:{}},{...fixture(),bypass_actors:null}])assert.throws(()=>validateMainRuleset(x));});
test('fixed read-only endpoint, no redirects, no token in evidence',async()=>{
 const result=await verifyLiveMainRuleset({repository:repo,sha,token,fetcher:async(url,options)=>{
   assert.equal(url,'https://api.github.com/repos/'+repo+'/rulesets/25756841');
   assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   return new Response(JSON.stringify(fixture()),{status:200});
 }});
 assert.equal(result.checkedCommit,sha);assert.equal(result.requiredApprovals,2);
 assert(!JSON.stringify(result).includes(token));
});
test('bad inputs never reach GitHub',async()=>{
 for(const patch of [{repository:'other/repo'},{sha:'bad'},{token:''}]){
  await assert.rejects(verifyLiveMainRuleset({repository:repo,sha,token,...patch,fetcher:()=>assert.fail('No fetch allowed')}));
 }
});
test('HTTP errors, invalid JSON, missing body, oversize response and permissive policy rejected',async()=>{
 const permissive=fixture();permissive.rules[2].parameters.required_approving_review_count=0;
 for(const make of [
  ()=>new Response('x',{status:403}),()=>new Response('x',{status:503}),
  ()=>new Response('bad JSON',{status:200}),()=>new Response(null,{status:200}),
  ()=>new Response('x'.repeat(65537),{status:200}),
  ()=>new Response(JSON.stringify(permissive),{status:200})
 ]){
   await assert.rejects(verifyLiveMainRuleset({repository:repo,sha,token,fetcher:async()=>make()}));
 }
});
test('release policy guard executes before publish; CI executes offline tests',()=>{
 const release=readFileSync(new URL('../../.github/workflows/release.yml',import.meta.url),'utf8');
 const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8');
 assert(release.indexOf('run: node scripts/check-main-ruleset.mjs')>=0);
 assert(release.indexOf('run: node scripts/check-main-ruleset.mjs')<release.indexOf('docker buildx build'));
 assert(ci.includes('run: node --test scripts/test-main-ruleset.mjs'));
});
