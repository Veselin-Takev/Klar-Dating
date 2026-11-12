import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const application = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repository = resolve(application, '..');

function fixture(work) {
  const directory = mkdtempSync(join(tmpdir(), 'klar-iam-wrapper-'));
  const root = join(directory, 'repo'), vault = join(directory, 'vault'), bin = join(directory, 'bin');
  for (const path of [root, vault, bin, join(root, 'scripts'), join(root, 'phase2_work/scripts'), join(root, 'docs/security')]) mkdirSync(path, {recursive: true, mode: 0o700});
  for (const path of ['scripts/collect-live-iam-evidence.sh', 'phase2_work/scripts/export-live-iam-evidence.ts', 'phase2_work/scripts/report-path.mjs', 'phase2_work/scripts/finalize-iam-bundle.mjs'])
    copyFileSync(resolve(repository, path), join(root, path));
  writeFileSync(join(root, 'phase2_work/package.json'), '{"type":"module"}\n');
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  writeFileSync(join(root, 'docs/security/live-iam-evidence.json'), '{"status":"UNVERIFIED"}\n');
  symlinkSync(resolve(application, 'node_modules'), join(root, 'phase2_work/node_modules'), 'dir');
  const fake = `#!/usr/bin/env node
const a=process.argv.slice(2), fs=require('node:fs');
fs.appendFileSync(process.env.FIXTURE_CALLS,JSON.stringify(a)+'\\n');
if(a.includes(process.env.FIXTURE_FAIL_AT || '__never__')){console.error('sensitive fixture diagnostic');process.exit(1);}
const account='klar-runtime@synthetic-klar.iam.gserviceaccount.com';
let result={};
if(a[0]==='config'){console.log(process.env.FIXTURE_IMPERSONATION || '(unset)');process.exit(0);}
if(a[0]==='auth'){
  const expected=process.env.GCP_COLLECTOR_SERVICE_ACCOUNT;
  if(process.env.FIXTURE_IMPERSONATION ? process.env.CLOUDSDK_AUTH_IMPERSONATE_SERVICE_ACCOUNT!==expected : process.env.CLOUDSDK_CORE_ACCOUNT!==expected)process.exit(1);
  console.log('synthetic-token-not-a-real-credential');process.exit(0);
}
if(a[0]==='version') result={'Google Cloud SDK':'synthetic-fixture-not-live'};
else if(a[1]==='get-ancestors') result=[{type:'project',id:'123'},{type:'folder',id:'456'},{type:'organization',id:'789'}];
else if(a.includes('get-iam-policy')) result={bindings:[{role:'roles/datastore.user',members:['serviceAccount:'+account]}]};
else if(a[1]==='services') result={spec:{template:{spec:{serviceAccountName:account}}},status:{traffic:[{revisionName:'klar-backend-001',percent:100}]}};
else if(a[1]==='revisions') result={spec:{serviceAccountName:process.env.FIXTURE_WRONG_RUNTIME ? 'wrong@synthetic-klar.iam.gserviceaccount.com' : account}};
else if(a[0]==='firestore') result=[{name:'projects/synthetic-klar/databases/(default)'}];
console.log(JSON.stringify(result));
`;
  writeFileSync(join(bin, 'gcloud'), fake, {mode: 0o700});
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','pipe']}).trim();
  git(['init']); git(['add','.']); git(['-c','user.name=Synthetic Fixture','-c','user.email=fixture@example.invalid','commit','-m','synthetic collector fixture']);
  const env = {...process.env, PATH: bin + ':' + process.env.PATH,
    GCP_PROJECT_ID: 'synthetic-klar', GCP_REGION: 'europe-west3', STORAGE_BUCKET_NAME: 'synthetic-klar.example',
    CLOUD_RUN_SERVICE: 'klar-backend', GCP_COLLECTOR_SERVICE_ACCOUNT: 'klar-collector@synthetic-klar.iam.gserviceaccount.com',
    GCP_EXPECTED_BUILD_SHA: git(['rev-parse','HEAD']), GCP_EVIDENCE_DIRECTORY: vault, FIXTURE_CALLS: join(directory,'calls.jsonl')};
  for (const key of ['KLAR_PROJECT_ID','KLAR_REGION','KLAR_SERVICE','KLAR_STORAGE_BUCKET','FIXTURE_FAIL_AT','FIXTURE_IMPERSONATION','FIXTURE_WRONG_RUNTIME']) delete env[key];
  const run = () => spawnSync('bash', [join(root,'scripts/collect-live-iam-evidence.sh')], {cwd: root, env, encoding: 'utf8', timeout: 30000});
  try { work({root, vault, env, run, calls: () => {try{return readFileSync(env.FIXTURE_CALLS,'utf8');}catch{return '';}}}); }
  finally { rmSync(directory, {recursive: true, force: true}); }
}

test('publishes a complete private bundle with verified hashes and pending sign-off, without changing Git evidence', () => fixture(({root,vault,run,calls}) => {
  const result=run(); assert.equal(result.status,0,result.stderr);
  assert(!result.stdout.includes('synthetic-token')); assert(!result.stdout.includes('sensitive'));
  const bundles=readdirSync(vault); assert.equal(bundles.length,1); assert.match(bundles[0],/^iam-/);
  const path=join(vault,bundles[0]);
  const manifest=JSON.parse(readFileSync(join(path,'HANDOVER_MANIFEST.json'),'utf8'));
  assert.equal(manifest.infrastructureVerification,'LIVE_CAPTURED_HUMAN_REVIEW_REQUIRED');
  assert.equal(manifest.productionApproved,false); assert.equal(manifest.prDraft,true);
  assert.equal(manifest.technicalSignOff,'PENDING');
  for(const name of ['iam-private.json','live-iam-evidence.json','HANDOVER_MANIFEST.json']) assert.equal(statSync(join(path,name)).mode & 0o777,0o600);
  assert.equal(readFileSync(join(root,'docs/security/live-iam-evidence.json'),'utf8'),'{"status":"UNVERIFIED"}\n');
  const commands=calls().trim().split('\n').map(line=>JSON.parse(line));
  assert(commands.some(a=>a.includes('organizations')));
  assert(!commands.some(a=>a.some(word=>['add-iam-policy-binding','set-iam-policy','deploy','login'].includes(word))));
  assert(commands.filter(a=>a.includes('get-iam-policy')).length>=5);
}));
test('denied provider reads publish no partial bundle and do not expose provider diagnostics', () => fixture(({vault,env,run}) => {
  env.FIXTURE_FAIL_AT='buckets'; const result=run();
  assert.notEqual(result.status,0); assert.match(result.stderr,/capture_failed_no_bundle_published/);
  assert(!result.stderr.includes('sensitive')); assert.deepEqual(readdirSync(vault),[]);
}));
test('wrong runtime identity prevents bundle publication', () => fixture(({vault,env,run}) => {
  env.FIXTURE_WRONG_RUNTIME='true'; assert.notEqual(run().status,0); assert.deepEqual(readdirSync(vault),[]);
}));
test('missing region fails before authentication', () => fixture(({env,run,calls}) => {
  delete env.GCP_REGION; assert.match(run().stderr,/missing_GCP_REGION/); assert.equal(calls(),'');
}));
test('conflicting scope alias fails before authentication', () => fixture(({env,run,calls}) => {
  env.KLAR_PROJECT_ID='foreign-project'; assert.match(run().stderr,/project_alias_conflict/); assert.equal(calls(),'');
}));
test('unreviewed checkout SHA fails before authentication', () => fixture(({env,run,calls}) => {
  env.GCP_EXPECTED_BUILD_SHA='0'.repeat(40); assert.match(run().stderr,/checkout_sha_mismatch/); assert.equal(calls(),'');
}));
test('dirty checkout fails before authentication', () => fixture(({root,run,calls}) => {
  writeFileSync(join(root,'untracked'),'dirty'); assert.match(run().stderr,/clean_checkout_required/); assert.equal(calls(),'');
}));
test('evidence path resolving inside repository is rejected', () => fixture(({root,env,run,calls}) => {
  env.GCP_EVIDENCE_DIRECTORY=join(root,'docs/security'); assert.match(run().stderr,/evidence_must_be_outside_repository/); assert.equal(calls(),'');
}));
test('unexpected impersonation target is rejected and staging is cleaned', () => fixture(({vault,env,run,calls}) => {
  env.FIXTURE_IMPERSONATION='other-collector@synthetic-klar.iam.gserviceaccount.com';
  assert.match(run().stderr,/impersonation_target_mismatch/);
  assert(!calls().includes('print-access-token')); assert.deepEqual(readdirSync(vault),[]);
}));
test('matching impersonation target is pinned and can collect without changing the source profile', () => fixture(({env,run}) => {
  env.FIXTURE_IMPERSONATION=env.GCP_COLLECTOR_SERVICE_ACCOUNT; assert.equal(run().status,0);
}));
test('unavailable credentials abort before resource reads and publish no bundle', () => fixture(({vault,env,run,calls}) => {
  env.FIXTURE_FAIL_AT='auth'; const result=run();
  assert.match(result.stderr,/credential_binding_unavailable/); assert(!result.stderr.includes('sensitive'));
  assert(!calls().includes('get-ancestors')); assert.deepEqual(readdirSync(vault),[]);
}));
test('a shared evidence directory is rejected before authentication', () => fixture(({vault,run,calls}) => {
  chmodSync(vault,0o755); assert.match(run().stderr,/private_evidence_directory_required/); assert.equal(calls(),'');
}));
test('subsequent captures preserve prior bundles instead of overwriting evidence', () => fixture(({vault,run}) => {
  assert.equal(run().status,0); const first=readdirSync(vault)[0];
  const original=readFileSync(join(vault,first,'HANDOVER_MANIFEST.json'),'utf8');
  assert.equal(run().status,0); assert.equal(readdirSync(vault).length,2);
  assert.equal(readFileSync(join(vault,first,'HANDOVER_MANIFEST.json'),'utf8'),original);
}));
