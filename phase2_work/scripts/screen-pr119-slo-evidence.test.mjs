import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { evaluate, gitBlobSha, loadAuthenticatedSource, FILES } from './screen-pr119-slo-evidence.mjs';

const fixture = Object.freeze({
 policy: JSON.stringify({windowDays:30,objectives:[{name:'api-latency-p95-ms',target:300,indicator:'p95(klar_http_latency_ms)'}]}),
 exporter: `import sloPolicy from '../../ops/slo.json';\nconst API_P95_SLO_MS = sloPolicy.objectives.find(objective => objective.name === 'api-latency-p95-ms')?.target;\nconst MINUTE_MS = 60000; const cutoff = Date.now() - 15 * MINUTE_MS;\nfunction percentile(values,p) { if (!values.length) return 0; }\nif (bucket.latencyMs.length > 2000) {}\n'# TYPE klar_http_request_duration_ms gauge',\n\`klar_http_request_duration_ms{quantile="0.95"} \${p95}\`,\n\`klar_http_p95_slo_breach \${p95 > API_P95_SLO_MS ? 1 : 0}\``,
 regression: `for (const [p95,expected] of [[299,0],[300,0],[301,1],[1500,1]]) {}`, 
 gate: `Canonical P95 SLO threshold /p95 > API_P95_SLO_MS/`,
 architecture: `- P95 API latency: <300 ms`,
});
function mutate(key,from,to) {
 const fresh={...fixture,[key]:fixture[key].replace(from,to)};
 assert.notEqual(fresh[key],fixture[key],`Mutation ${key}: ${from} must take effect`);
 return evaluate(fresh);
}
test('baseline: all canonical 300ms source controls pass but production stays NO-GO',()=>{
 const r=evaluate(fixture);assert.equal(r.source_threshold_consistent,true);assert.equal(r.release_decision,'NO-GO');
 assert.equal(r.observations.declared_slo_window_days,30);
 assert.equal(r.observations.exporter_window_15_min,true);
 assert.equal(r.observations.empty_latency_window_returns_zero_p95,true);
 assert.equal(r.observations.exports_local_quantile_gauge,true);
 assert.equal(r.observations.exports_histogram_buckets,false);
 assert.equal(r.observations.policy_indicator,'p95(klar_http_latency_ms)');
 assert.equal(r.observations.exporter_emits_policy_indicator_metric,false);
 assert.equal(r.qualified_host_gates_pass_evidenced,0);
 assert.equal(r.final_independent_approvals_evidenced,0);
 assert.equal(r.network_calls,0);assert.equal(r.cloud_writes,0);
 assert(r.evidence_gaps.includes('NO_TRAFFIC_P95_ZERO_MAY_MASK_UNKNOWN'));
});
for(const [label,k,from,to,flag] of [
 ['policy drift to 1500','policy','"target":300','"target":1500','policy_target_300_ms'],
 ['duplicate objectives','policy','"objectives":[{','"objectives":[{"name":"api-latency-p95-ms","target":300},{','single_canonical_api_objective'],
 ['wrong architecture target','architecture','<300 ms','<1500 ms','architecture_target_300_ms'],
 ['removed policy import','exporter',"import sloPolicy from '../../ops/slo.json';",'// no canonical import','exporter_imports_policy'],
 ['wrong objective read','exporter',"objective.name === 'api-latency-p95-ms'","objective.name === 'other'",'exporter_reads_api_objective'],
 ['hardcoded 1500 metric','exporter','p95 > API_P95_SLO_MS ? 1 : 0','p95 > 1500 ? 1 : 0','exporter_uses_canonical_threshold'],
 ['missing 299 boundary','regression','[299,0]','[298,0]','regression_checks_299_300_301'],
 ['missing 300 boundary','regression','[300,0]','[300,1]','regression_checks_299_300_301'],
 ['missing 301 boundary','regression','[301,1]','[301,0]','regression_checks_299_300_301'],
 ['missing static gate','gate','Canonical P95 SLO threshold','Legacy P95','mandatory_static_gate_wires_regression'],
]) test(`detects ${label}`,()=>{const r=mutate(k,from,to);assert.equal(r.checks[flag],false);assert.equal(r.source_threshold_consistent,false);assert.equal(r.release_decision,'NO-GO');});
test('no traffic is not a proven healthy SLO',()=>{const r=mutate('exporter','if (!values.length) return 0;','if (!values.length) return NaN;');assert.equal(r.observations.empty_latency_window_returns_zero_p95,false);assert.equal(r.release_decision,'NO-GO');});
test('an absent local gauge does not prove fleet histogram compliance',()=>{const r=mutate('exporter',"'# TYPE klar_http_request_duration_ms gauge'","'# TYPE klar_http_request_duration_ms histogram'");assert.equal(r.observations.exports_local_quantile_gauge,false);assert.equal(r.release_decision,'NO-GO');});
test('adding buckets to fixture does not attest deployed histogram / alert delivery',()=>{const r=mutate('exporter',"'# TYPE klar_http_request_duration_ms gauge'","'# TYPE klar_http_request_duration_ms gauge', 'klar_http_request_duration_ms_bucket{le=\"300\"} 1'");assert.equal(r.observations.exports_histogram_buckets,true);assert.equal(r.release_decision,'NO-GO');assert.equal(r.observations.live_alert_delivery_verified,false);});
test('missing raw source rejects CLI before evaluation',()=>{const self=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'screen-pr119-slo-evidence.mjs');const r=spawnSync(process.execPath,[self,'--source-root','/nonexistent-pr119-checkout'],{encoding:'utf8',timeout:10000});assert.equal(r.status,2);assert.match(r.stderr,/rejected/);});
test('missing CLI root rejects with code 2',()=>{const self=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'screen-pr119-slo-evidence.mjs');const r=spawnSync(process.execPath,[self],{encoding:'utf8',timeout:10000});assert.equal(r.status,2);assert.match(r.stderr,/required_exact|usage/);});
test('wrong source blobs refuse a forged PR119 fixture',()=>{const root=mkdtempSync(path.join(os.tmpdir(),'klar-slo-bad-'));try{for(const [key,[relative]] of Object.entries(FILES)){const p=path.join(root,relative);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,fixture[key]);}assert.throws(()=>loadAuthenticatedSource(root),/source_git_blob_mismatch/);}finally{rmSync(root,{recursive:true,force:true});}});
test('Git blob SHA hashes bytes and distinguishes edits',()=>{assert.match(gitBlobSha(Buffer.from('test')),/^[a-f0-9]{40}$/);assert.notEqual(gitBlobSha('test'),gitBlobSha('test\n'));});
test('bad policy shape is not silently treated as 300ms',()=>{const r=evaluate({...fixture,policy:JSON.stringify({windowDays:30,objectives:[]})});assert.equal(r.checks.single_canonical_api_objective,false);assert.equal(r.source_threshold_consistent,false);assert.equal(r.release_decision,'NO-GO');});
