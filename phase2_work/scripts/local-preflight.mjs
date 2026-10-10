import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLocalProvenance } from './verify-local-provenance.mjs';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const started = new Date().toISOString();
const report = { schemaVersion: 1, startedAt: started, status: 'FAIL', steps: [] };
const reportPath = resolve(process.env.KLAR_LOCAL_PREFLIGHT_REPORT || join(tmpdir(), 'klar-local-preflight-' + process.pid + '.json'));
function persist() {
  report.finishedAt = new Date().toISOString();
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log('Local validation evidence: ' + reportPath);
}
function run(label, command, args, options = {}) {
  const time = process.hrtime.bigint();
  console.log('\nPreflight: ' + label);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' }, ...options });
  const durationMs = Number((process.hrtime.bigint() - time) / 1000000n);
  const passed = !result.error && result.status === 0;
  report.steps.push({ label, durationMs, status: passed ? 'PASS' : 'FAIL', exitCode: result.status ?? null, signal: result.signal ?? null });
  if (result.error) console.error(result.error.message);
  if (!passed) throw new Error('Local preflight failed at ' + label);
}
try {
  report.gitSha = verifyLocalProvenance(resolve(cwd, '..'));
  if (process.versions.node !== '22.23.3') throw new Error('Use Node 22.23.3 before preflight.');
  const bun = spawnSync('bun', ['--version'], { encoding: 'utf8' });
  if (bun.status !== 0 || bun.stdout.trim() !== '1.4.2') throw new Error('Use Bun 1.4.2 before preflight.');
  const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
  if (java.status !== 0 || !/version "21[."]/.test(java.stdout + java.stderr)) throw new Error('Use Java 21 before preflight.');

  run('CI diagnostic unit tests', 'node', ['--test', 'scripts/analyze-ci-duration.test.mjs', 'scripts/analyze-vitest-duration.test.mjs', 'scripts/verify-local-provenance.test.mjs']);
  run('Dependency lock preflight', 'node', ['scripts/check-dependency-locks.mjs']);
  run('Frozen Bun installation', 'bun', ['ci']);
  run('Frozen Functions installation', 'npm', ['ci', '--prefix', 'functions', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('CI scope regression', 'node', ['--test', 'scripts/ci-scope-check.mjs']);
  run('Runtime alignment', 'node', ['scripts/check-runtime-node-alignment.mjs']);
  for (const script of ['check:enterprise', 'typecheck', 'check:functions', 'test:ci', 'build', 'test:production']) {
    run(script, 'bun', ['run', script]);
  }
  run('Browser acceptance', 'bunx', ['playwright', 'test']);
  report.status = 'PASS';
  console.log('Local preflight PASS. This is not production approval.');
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  persist();
}
