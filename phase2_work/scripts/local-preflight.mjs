import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function run(command, args) {
  console.log(`\nPreflight: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: 'true' } });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
if (process.versions.node !== '22.23.3') throw new Error('Use Node 22.23.3 before preflight.');
const bun = spawnSync('bun', ['--version'], { encoding: 'utf8' });
if (bun.status !== 0 || bun.stdout.trim() !== '1.4.2') throw new Error('Use Bun 1.4.2 before preflight.');
const java = spawnSync('java', ['-version'], { encoding: 'utf8' });
if (java.status !== 0 || !/version "21[."]/.test(java.stdout + java.stderr)) throw new Error('Use Java 21 before preflight.');
run('node', ['scripts/check-dependency-locks.mjs']);
run('bun', ['ci']);
run('npm', ['ci', '--prefix', 'functions', '--ignore-scripts', '--no-audit', '--no-fund']);
run('node', ['--test', 'scripts/ci-scope-check.mjs']);
for (const script of ['check:enterprise', 'typecheck', 'check:functions', 'test:ci', 'build', 'test:production']) {
  run('bun', ['run', script]);
}
run('bunx', ['playwright', 'test']);
console.log('Local preflight PASS. This is not production approval.');
