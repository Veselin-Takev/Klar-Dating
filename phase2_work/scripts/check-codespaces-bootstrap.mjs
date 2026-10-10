import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = path => readFileSync(resolve(repositoryRoot, path), 'utf8');
const configuration = JSON.parse(read('.devcontainer/devcontainer.json'));
const script = read('phase2_work/scripts/setup-codespace.sh');
// Comments are documentation, not executable pin evidence.
const executableScript = script.split('\n').filter(line => !/^\s*#/.test(line)).join('\n');
const failures = [];
const syntax = spawnSync('bash', ['-n', resolve(repositoryRoot, 'phase2_work/scripts/setup-codespace.sh')], { encoding: 'utf8' });
if (syntax.error || syntax.status !== 0) failures.push('Codespaces bootstrap Bash syntax failed: ' + (syntax.stderr || syntax.error?.message || 'unknown error'));

if (configuration.postCreateCommand !== 'bash phase2_work/scripts/setup-codespace.sh') {
  failures.push('Root Codespaces postCreateCommand must invoke the pinned bootstrap.');
}
if (configuration.features?.['ghcr.io/devcontainers/features/java:1']?.version !== '21') {
  failures.push('The root devcontainer must install Java 21.');
}
for (const [pattern, label] of [
  [/\bnvm install 22\.23\.3\b/, 'Node 22.23.3 installation'],
  [/\bnvm alias default 22\.23\.3\b/, 'Node 22.23.3 default persistence'],
  [/\bnvm use 22\.23\.3\b/, 'Node 22.23.3 activation'],
  [/\bbun@1\.4\.2\b/, 'Bun 1.4.2 installation'],
  [/\bbun ci\b/, 'frozen Bun root install'],
  [/\bnpm ci --prefix functions\b/, 'frozen Functions install'],
  [/\bcheck-dependency-locks\.mjs\b/, 'lockfile policy validation'],
]) {
  if (!pattern.test(executableScript)) failures.push('Missing Codespaces bootstrap invariant: ' + label);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Codespaces bootstrap invariants PASS.');
}
