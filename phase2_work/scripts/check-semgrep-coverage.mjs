import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
export function verifySemgrepCoverage(report, expected) {
  if (
    !Array.isArray(report.results) ||
    report.results.length ||
    !Array.isArray(report.errors) ||
    report.errors.length
  )
    throw new Error('Semgrep findings or diagnostics remain');
  if (!Array.isArray(report.paths?.scanned))
    throw new Error('Semgrep target evidence missing');
  const scanned = new Set(
    report.paths.scanned.map((path) => path.replace(/^\.\.\//, '')),
  );
  const missing = expected.filter((path) => !scanned.has(path));
  if (missing.length)
    throw new Error(
      'Unscanned first-party runtime source: ' + missing.join(', '),
    );
  return {
    result: 'PASS',
    expected: expected.length,
    scanned: expected.length,
    missing: 0,
    excluded: [
      'test/spec suites and declarations',
      'vendored third-party QR generator',
      'generated/vendor dependencies and non-code documentation',
    ],
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim();
  const files = execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  const expected = files.filter(
    (path) =>
      (path.startsWith('phase2_work/src/') ||
        path.startsWith('phase2_work/functions/src/') ||
        path.startsWith('phase2_work/scripts/') ||
        path === 'phase2_work/server.ts') &&
      /\.(?:ts|tsx|js|mjs|cjs)$/.test(path) &&
      !/\.(?:test|spec)\.[^.]+$/.test(path) &&
      !path.endsWith('.d.ts') &&
      !path.includes('/vendor/'),
  );
  const report = JSON.parse(
    readFileSync(process.argv[2] ?? 'semgrep-auto.json', 'utf8'),
  );
  console.log(JSON.stringify(verifySemgrepCoverage(report, expected)));
}
