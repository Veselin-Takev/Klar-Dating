#!/usr/bin/env node
/**
 * Read-only, SHA-bound v149/R2 and documentation provenance check.
 * Verifies committed/ref-reachable content only, not uncommitted or external assets.
 * Never reads or emits document contents.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const option = (name, fallback) => process.argv.find(x => x.startsWith('--' + name + '='))?.slice(name.length + 3) ?? fallback;
const repo = resolve(option('repo', resolve(dirname(fileURLToPath(import.meta.url)), '..')));
const reportPath = resolve(option('report', resolve(repo, 'audit-results', 'v149-documentation-provenance.json')));
const v149Ref = option('v149-ref', '0042bbff95e2092c804407fd8559aa6d8e3d37ed');
const r2Ref = option('r2-ref', '286a991e776885199bb1028d380e239821de88ac');
const docBaselineRef = option('doc-baseline-ref', 'e7907d494d9fa3e2383110893182dc252cd8c18a');
const docBranch = 'docs/ci-governance-audit-2026-10-23';
const evidencePath = 'phase2_work/docs/P0_RELEASE_EVIDENCE_TRACEABILITY_2026-10-23.md';
const expectedEvidenceSha = option('expected-evidence-sha', 'f82ea61e5baf2516000916baba2d53478c675bef');

function git(args) {
  const p = spawnSync('git', args, {
    cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
  });
  if (p.status !== 0 || p.error) throw Error('git ' + args[0] + ' failed: ' + (p.error?.message || p.stderr?.slice(0, 300)));
  return p.stdout;
}
function validRef(ref) {
  try { git(['rev-parse', '--verify', ref + '^{commit}']); return true; } catch { return false; }
}
function tree(ref) {
  const values = new Map();
  const raw = spawnSync('git', ['ls-tree', '-r', '-z', '--full-tree', ref], {
    cwd: repo, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
  });
  if (raw.status !== 0 || raw.error) throw Error('cannot inspect tree ' + ref);
  for (const record of raw.stdout.toString('utf8').split('\0')) {
    if (!record) continue;
    const t = record.indexOf('\t');
    if (t < 0) throw Error('malformed git tree');
    const [mode, type, oid] = record.slice(0, t).split(' ');
    if (type !== 'blob' && type !== 'commit') throw Error('invalid tree type');
    values.set(record.slice(t + 1), { mode, type, oid });
  }
  return values;
}
function classifyPaths(map, predicate) {
  return [...map].filter(([p]) => predicate(p)).map(([p,entry]) => ({ path: p, sha: entry.oid })).sort((a,b) => a.path.localeCompare(b.path));
}
const failures = [];
if (git(['rev-parse', '--is-shallow-repository']).trim() !== 'false') failures.push('SHALLOW_HISTORY');
const main = validRef('refs/remotes/origin/main') ? 'refs/remotes/origin/main' : 'refs/heads/main';
const documentation = validRef('refs/remotes/origin/' + docBranch)
  ? 'refs/remotes/origin/' + docBranch : 'refs/heads/' + docBranch;
for (const [name, ref] of [['MAIN_REF', main], ['DOC_REF', documentation], ['V149_REF', v149Ref], ['R2_REF', r2Ref], ['DOC_BASELINE_REF', docBaselineRef]]) {
  if (!validRef(ref)) failures.push('MISSING_' + name);
}
const empty = new Map();
const mainFiles = validRef(main) ? tree(main) : empty;
const v149Files = validRef(v149Ref) ? tree(v149Ref) : empty;
const r2Files = validRef(r2Ref) ? tree(r2Ref) : empty;
const baselineDocs = validRef(docBaselineRef) ? tree(docBaselineRef) : empty;
const branchDocs = validRef(documentation) ? tree(documentation) : empty;
const missingV149 = [...v149Files.keys()].filter(p => !mainFiles.has(p)).sort();
const missingR2 = [...r2Files.keys()].filter(p => !mainFiles.has(p)).sort();
const importantPath = p => p.startsWith('phase2_work/docs/')
  || p.startsWith('phase2_work/scripts/')
  || /^((PRODUCTION|RELEASE|GO_LIVE|FINAL_RELEASE|SECURITY|ARCHITECTURE|CODEOWNERS))/.test(p);
const missingDocumentation = [...baselineDocs.keys()].filter(p => importantPath(p) && !branchDocs.has(p)).sort();
const changedDocumentation = [...baselineDocs].filter(([p,entry]) => importantPath(p) &&
  branchDocs.has(p) && branchDocs.get(p).oid !== entry.oid).map(([p]) => p).sort();
const evidencePaths = classifyPaths(branchDocs, p => /^phase2_work\/docs\/P0_RELEASE_EVIDENCE_TRACEABILITY_[0-9-]+\.md$/.test(p));
if (!evidencePaths.length) failures.push('MISSING_P0_EVIDENCE');
if (branchDocs.get(evidencePath)?.oid !== expectedEvidenceSha) failures.push('EVIDENCE_BLOB_CHANGED_OR_MISSING');
if (baselineDocs.get(evidencePath)?.oid !== expectedEvidenceSha) failures.push('EVIDENCE_BASELINE_MISMATCH');
if (missingV149.length) failures.push('V149_PATHS_MISSING_FROM_MAIN');
if (missingR2.length) failures.push('R2_PATHS_MISSING_FROM_MAIN');
if (missingDocumentation.length) failures.push('DOCUMENTATION_PATHS_MISSING');
const docExclusive = classifyPaths(branchDocs, p => p.startsWith('phase2_work/docs/') && !mainFiles.has(p));
const report = {
  generatedAt: new Date().toISOString(),
  verdict: failures.length ? 'FAIL' : 'PASS_COMMITTED_REACHABLE_PATHS_ONLY',
  checkedRefs: {
    main: validRef(main) ? git(['rev-parse', main]).trim() : null,
    v149: validRef(v149Ref) ? git(['rev-parse', v149Ref]).trim() : null,
    r2: validRef(r2Ref) ? git(['rev-parse', r2Ref]).trim() : null,
    documentationBranch: validRef(documentation) ? git(['rev-parse', documentation]).trim() : null,
    documentationBaseline: validRef(docBaselineRef) ? git(['rev-parse', docBaselineRef]).trim() : null,
  },
  evidencePath, expectedEvidenceSha,
  failures,
  counts: {
    main: mainFiles.size, v149: v149Files.size, r2: r2Files.size,
    documentationBranch: branchDocs.size,
    baselineDocumentationPaths: [...baselineDocs.keys()].filter(importantPath).length,
    documentationOnlyPaths: docExclusive.length,
    evidenceFiles: evidencePaths.length,
  },
  missingV149, missingR2, missingDocumentation, changedDocumentation,
  evidencePaths, documentationOnlyPaths: docExclusive,
  limits: [
    'Presence does not mean the current file bytes are identical to v149; previous bytes remain in reachable Git trees.',
    'Branch-tip differences are not automatically losses; this guard fails only for missing paths or the pinned evidence blob.',
    'Remote Git cannot establish the existence of uncommitted files on developer computers.',
    'External release ZIP, Git-LFS backing storage, unreferenced commits and pre-import assets are not verified.',
  ],
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const lines = [
  '# Klar v149 / R2 Documentation Integrity',
  '',
  'Verdict: **' + report.verdict + '**',
  'Generated: ' + report.generatedAt,
  '',
  '| Control | Result |',
  '|---|---:|',
  '| v149 paths missing on main | ' + missingV149.length + ' |',
  '| R2 paths missing on main | ' + missingR2.length + ' |',
  '| Documentation / script baseline paths missing on dedicated branch | ' + missingDocumentation.length + ' |',
  '| Original P0 evidence blob matches expected SHA | ' + (branchDocs.get(evidencePath)?.oid === expectedEvidenceSha) + ' |',
  '| Documentation-only files not on main | ' + docExclusive.length + ' |',
  '| Changed (but present) documentation/script paths relative to historical doc tip | ' + changedDocumentation.length + ' |',
  '',
  'Main SHA: ' + report.checkedRefs.main,
  'v149 SHA: ' + report.checkedRefs.v149,
  'R2 SHA: ' + report.checkedRefs.r2,
  'Documentation SHA: ' + report.checkedRefs.documentationBranch,
  '',
  '## Documentation-only paths',
  ...docExclusive.map(x => '- ' + x.path + ' @ ' + x.sha),
  '',
  '## Check limitations',
  ...report.limits.map(x => '- ' + x),
  '',
].join('\n');
writeFileSync(reportPath.replace(/\.json$/, '.md'), lines);
console.log('v149 documentation provenance: ' + report.verdict);
console.log(JSON.stringify({ ...report.counts, failures, checkedRefs: report.checkedRefs }));
if (failures.length) process.exitCode = 1;
