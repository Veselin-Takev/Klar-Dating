import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REQUIRED_STEPS, validateRun, validateJobs, verifyReleaseCi } from './check-release-ci.mjs';
const repository = 'example/klar';
const sha = 'a'.repeat(40);
const run = () => ({ id: 12, run_attempt: 2, head_sha: sha, head_branch: 'main', event: 'push', path: '.github/workflows/ci.yml', repository: { full_name: repository }, head_repository: { full_name: repository }, status: 'completed', conclusion: 'success' });
const job = () => ({ id: 44, name: 'validate', run_id: 12, run_attempt: 2, head_sha: sha, status: 'completed', conclusion: 'success', steps: REQUIRED_STEPS.map(name => ({ name, status: 'completed', conclusion: 'success' })) });
test('accepts complete exact-commit main validation', () => {
  assert.doesNotThrow(() => validateRun(run(), repository, sha));
  assert.equal(validateJobs([job()], run()).id, 44);
});
for (const [field,value] of Object.entries({ head_sha:'b'.repeat(40), head_branch:'feature', event:'pull_request', path:'.github/workflows/other.yml', conclusion:'failure', status:'in_progress', run_attempt:0, repository:{full_name:'foreign/repo'}, head_repository:{full_name:'foreign/repo'}})) {
  test(`rejects invalid run ${field}`, () => assert.throws(() => validateRun({...run(),[field]:value},repository,sha)));
}
for (const name of REQUIRED_STEPS) {
  test(`rejects skipped required step ${name}`, () => {
    const j=job(); j.steps.find(s=>s.name===name).conclusion='skipped';
    assert.throws(()=>validateJobs([j],run()));
  });
}
test('rejects missing and ambiguous jobs, steps and wrong attempts', () => {
  for(const jobs of [[],[job(),job()],[{...job(),run_attempt:1}],[{...job(),head_sha:'b'.repeat(40)}],[{...job(),steps:[]}],[{...job(),steps:[...job().steps,job().steps[0]]}]]) assert.throws(()=>validateJobs(jobs,run()));
});
function fixture({runs=[run()], jobs=[job()], changedAttempt=false, httpError=false}={}) {
  let reads=0; const requests=[];
  const fetcher=async (url,options)=>{
    requests.push(url);
    assert.equal(new URL(url).origin,'https://api.github.com');
    assert.equal(options.redirect,'error');
    assert.equal(options.headers.Authorization,'Bearer test-only');
    if(httpError) return {ok:false,status:403};
    let body;
    if(url.includes('/workflows/')) body={total_count:runs.length,workflow_runs:runs};
    else if(url.includes('/jobs?')) body={total_count:jobs.length,jobs};
    else { reads++; body={...runs.find(r=>url.endsWith('/runs/'+r.id)),...(changedAttempt&&reads>1?{run_attempt:3}:{})}; }
    return {ok:true,json:async()=>body};
  };
  return {fetcher,requests};
}
test('reads attempt-specific jobs and records only nonsecret evidence', async()=>{
  const f=fixture();const evidence=await verifyReleaseCi({repository,sha,token:'test-only',fetcher:f.fetcher});
  assert.equal(evidence.runAttempt,2);assert.equal(evidence.buildSha,sha);
  assert.ok(f.requests.some(u=>u.includes('/attempts/2/jobs?')));
  assert.ok(!JSON.stringify(evidence).includes('test-only'));
});
test('rejects absent runs, API failures and changed attempts',async()=>{
  for(const config of [{runs:[]},{httpError:true},{changedAttempt:true}]) await assert.rejects(verifyReleaseCi({repository,sha,token:'test-only',...fixture(config)}));
});
test('never falls back to older successful run',async()=>{
  const f=fixture({runs:[{...run(),id:11}, {...run(),id:13,conclusion:'failure'}]});
  await assert.rejects(verifyReleaseCi({repository,sha,token:'test-only',fetcher:f.fetcher}));
  assert.ok(f.requests.some(u=>u.endsWith('/runs/13')));
});
test('rejects invalid inputs before sending a request',async()=>{
  for(const values of [{repository:'../bad'}, {sha:'bad'}, {token:''}]) await assert.rejects(verifyReleaseCi({repository,sha,token:'test-only',...values,fetcher:()=>assert.fail('must not fetch')}));
});
test('bounded pagination fails closed on inconsistent responses',async()=>{
  await assert.rejects(verifyReleaseCi({repository,sha,token:'test-only',fetcher:async()=>({ok:true,json:async()=>({total_count:1,workflow_runs:[]})})}));
});
test('release gate runs before publication and cannot regenerate the lockfile',()=>{
  const release=readFileSync(new URL('../../.github/workflows/release.yml',import.meta.url),'utf8');
  assert.match(release,/actions: read/);
  assert.ok(release.indexOf('run: node scripts/check-release-ci.mjs') < release.indexOf('docker buildx build'));
  assert.ok(release.includes('run: node scripts/check-release-ci.mjs'));
  assert.ok(!release.includes('bun install --lockfile-only'));
  assert.ok(release.includes('git diff --exit-code -- package.json bun.lock'));
});
test('retrieves every run page before selecting newest evidence', async()=>{
  const f=fixture();const pages=[];
  const fetcher=async(url,options)=>{
    if(url.includes('/workflows/')) {
      const page=Number(new URL(url).searchParams.get('page'));pages.push(page);
      return {ok:true,json:async()=>({total_count:2,workflow_runs:[{...run(),id:page===1?11:12}]})};
    }
    return f.fetcher(url,options);
  };
  const evidence=await verifyReleaseCi({repository,sha,token:'test-only',fetcher});
  assert.deepEqual(pages,[1,2]);assert.equal(evidence.runId,12);
});
test('rejects malformed JSON and failed required steps',async()=>{
  await assert.rejects(verifyReleaseCi({repository,sha,token:'test-only',fetcher:async()=>({ok:true,json:async()=>{throw new SyntaxError('invalid');}})}));
  const j=job();j.steps[0].conclusion='failure';
  await assert.rejects(verifyReleaseCi({repository,sha,token:'test-only',...fixture({jobs:[j]})}));
});

test('CLI rejects prerelease tags before Git or network access, matching release identity policy',()=>{
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./check-release-ci.mjs',import.meta.url))],{
    env:{GITHUB_REF:'refs/tags/v1.2.3-beta'},encoding:'utf8',timeout:10000,
  });
  assert.equal(result.status,1);assert.match(result.stderr,/Release CI verification FAILED/);
});
