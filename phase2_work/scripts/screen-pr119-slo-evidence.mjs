#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Source-only, read-only audit of immutable PR #119. It must never imply
// that 30-day fleet telemetry, a pager, or a human release approval exists.
export const TARGET_PR_SHA = '7fdf29010c85f16a9b38e5c93186f32e92192f3a';
export const FILES = Object.freeze({
  policy: ['ops/slo.json', '977dc2e8ef4a6702cab787c389dbe65038d8d51c'],
  exporter: ['src/server/observability.ts', 'fe7c2940fa968c7a6b981899f8d6c29b711d85a1'],
  regression: ['scripts/test-slo-policy.mjs', '6a5dbe80463524479a6e44e6a2112fc3e8feeee9'],
  gate: ['scripts/check-observability.mjs', '36e13b8125ef631bbe3a0de8b6bfa373186323b1'],
  architecture: ['docs/architecture/ENTERPRISE_TARGET.md', 'efc0c5b8c31784d6cbb499098768961ea0e5d379'],
});

export function gitBlobSha(raw) {
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

export function evaluate(source) {
  const policy = JSON.parse(source.policy);
  const list = Array.isArray(policy.objectives) ? policy.objectives.filter(o => o?.name === 'api-latency-p95-ms') : [];
  const target = list.length === 1 ? list[0]?.target : undefined;
  const obs = source.exporter;
  const tests = source.regression;
  const gate = source.gate;
  const architecture = source.architecture;
  const checks = {
    single_canonical_api_objective: list.length === 1,
    policy_target_300_ms: target === 300,
    architecture_target_300_ms: /P95 API latency:\s*<300 ms/.test(architecture),
    exporter_imports_policy: /import\s+sloPolicy\s+from\s+['"]\.\.\/\.\.\/ops\/slo\.json['"]/.test(obs),
    exporter_reads_api_objective: /sloPolicy\.objectives\.find\(objective\s*=>\s*objective\.name === 'api-latency-p95-ms'\)\?\.target/.test(obs),
    exporter_uses_canonical_threshold: /klar_http_p95_slo_breach\s+\$\{p95 > API_P95_SLO_MS \? 1 : 0\}/.test(obs),
    regression_checks_299_300_301: /\[\[299,\s*0\],\s*\[300,\s*0\],\s*\[301,\s*1\]/.test(tests),
    mandatory_static_gate_wires_regression: /Canonical P95 SLO threshold/.test(gate) && /p95 > API_P95_SLO_MS/.test(gate),
  };
  // Open gaps are explicitly marked and may NOT be represented as passing gates.
  const observations = {
    declared_slo_window_days: policy.windowDays,
    exporter_window_15_min: /(?:Date\.now\(\)|\bnow)\s*-\s*15\s*\*\s*MINUTE_MS/.test(obs),
    exporter_local_max_latency_samples_per_minute: /bucket\.latencyMs\.length\s*>\s*2000/.test(obs) ? 2000 : null,
    empty_latency_window_returns_zero_p95: /if\s*\(!values\.length\)\s*return\s+0\s*;/.test(obs),
    exports_local_quantile_gauge: /klar_http_request_duration_ms\{quantile=/.test(obs) && /TYPE klar_http_request_duration_ms gauge/.test(obs),
    exports_histogram_buckets: /klar_http_request_duration_ms_bucket/.test(obs),
    policy_indicator: list.length === 1 ? list[0]?.indicator : null,
    exporter_emits_policy_indicator_metric: /klar_http_latency_ms[\{\s`]/.test(obs),
    architecture_strict_lt_while_gate_allows_equal_target: /P95 API latency:\s*<300 ms/.test(architecture) && /\[300,\s*0\]/.test(tests),
    live_alert_delivery_verified: false,
    fleet_30_day_sli_verified: false,
    histogram_promql_and_burn_rate_verified: false,
  };
  const source_threshold_consistent = Object.values(checks).every(Boolean);
  const gaps = [];
  if (!source_threshold_consistent) gaps.push('CANONICAL_P95_SOURCE_CONTRACT_INCONSISTENT');
  if (observations.exporter_window_15_min && observations.declared_slo_window_days === 30) gaps.push('LOCAL_15_MIN_NOT_30_DAY_SLI');
  if (observations.empty_latency_window_returns_zero_p95) gaps.push('NO_TRAFFIC_P95_ZERO_MAY_MASK_UNKNOWN');
  if (observations.exports_local_quantile_gauge && !observations.exports_histogram_buckets) gaps.push('LOCAL_QUANTILE_GAUGE_NOT_AGGREGATABLE_FLEET_HISTOGRAM');
  if (observations.policy_indicator === 'p95(klar_http_latency_ms)' && !observations.exporter_emits_policy_indicator_metric) gaps.push('POLICY_INDICATOR_NOT_EMITTED_BY_THIS_EXPORTER');
  if (observations.architecture_strict_lt_while_gate_allows_equal_target) gaps.push('SRE_DECISION_NEEDED_300_MS_EQUALITY_SEMANTICS');
  gaps.push('NO_AUTHENTICATED_PRODUCTION_METRICS_OR_PAGER_EVIDENCE');
  return {
    target_commit: TARGET_PR_SHA,
    checks,
    source_threshold_consistent,
    observations,
    evidence_gaps: gaps,
    qualified_host_gates_pass_evidenced: 0,
    final_independent_approvals_evidenced: 0,
    release_decision: 'NO-GO',
    source_authentication_by_this_evaluation: false,
    network_calls: 0,
    cloud_writes: 0,
  };
}

export function loadAuthenticatedSource(root) {
  if (typeof root !== 'string' || !root.trim()) throw new Error('required_exact_pr119_source_root_missing');
  const output = {};
  for (const [name, [relative, sha]] of Object.entries(FILES)) {
    const pathname = path.join(root, relative);
    // Verify resolved and real paths before reading. Never follow symlinks.
    const rootReal = fs.realpathSync(root);
    const location = fs.realpathSync(pathname);
    if (!location.startsWith(rootReal + path.sep)) throw new Error('source_outside_checkout: ' + relative);
    if (!fs.lstatSync(pathname).isFile() || fs.lstatSync(pathname).isSymbolicLink()) throw new Error('source_not_regular_file: ' + relative);
    const raw = fs.readFileSync(pathname);
    if (gitBlobSha(raw) !== sha) throw new Error('source_git_blob_mismatch: ' + relative);
    output[name] = raw.toString('utf8');
  }
  return output;
}

const self = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (self) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== '--source-root') {
      throw new Error('usage: node screen-pr119-slo-evidence.mjs --source-root <exact-pr119-phase2_work>');
    }
    const sources = loadAuthenticatedSource(process.argv[3]);
    const report = evaluate(sources);
    report.verified_git_blob_file_count = Object.keys(FILES).length; // Does NOT attest the whole checkout or host.
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1; // Expected NO-GO even when static threshold checks pass.
  } catch (error) {
    process.stderr.write(`SLO evidence screen rejected: ${String(error instanceof Error ? error.message : error)}\n`);
    process.exitCode = 2;
  }
}
