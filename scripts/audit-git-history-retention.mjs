#!/usr/bin/env node
/**
 * Read-only, reproducible Git file-retention audit.
 * Scope: Git objects reachable from the locally fetched refs and HEAD.
 * This cannot prove that uncommitted, force-pushed-away, Git-LFS, or
 * pre-repository local archives still exist.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const cliOption = (name) => process.argv.find(value => value.startsWith('--' + name + '='))?.slice(name.length + 3);
const defaultRepo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(cliOption('repo') ?? defaultRepo);
const reportPath = resolve(cliOption('report') ?? resolve(repo, 'audit-results', 'git-history-retention.json'));
const maxBuffer = 128 * 1024 * 1024;

function gitResult(args, input) {
  const result = spawnSync('git', args, {
    cwd: repo,
    input,
    encoding: null,
    maxBuffer,
    timeout: 240_000,
  });
  if (result.error || result.status !== 0) {
    const description = (result.stderr ?? Buffer.from('')).toString('utf8').slice(0, 500);
    throw Error('git ' + args[0] + ' failed: ' + (result.error?.message ?? description));
  }
  return result.stdout;
}
const gitText = (...args) => gitResult(args).toString('utf8');
function hasRef(name) {
  const r = spawnSync('git', ['show-ref', '--verify', '--quiet', name], { cwd: repo });
  return r.status === 0;
}
function treeEntries(ref) {
  const records = gitResult(['ls-tree', '-r', '-z', '--full-tree', ref]).toString('utf8').split('\0');
  const map = new Map();
  for (const record of records) {
    if (!record) continue;
    const tab = record.indexOf('\t');
    if (tab < 0) throw Error('malformed git ls-tree record');
    const [mode, type, oid] = record.slice(0, tab).split(' ');
    const path = record.slice(tab + 1);
    if (!/^[a-f0-9]{40,64}$/.test(oid) || !path) throw Error('invalid git tree entry');
    if (type !== 'blob' && type !== 'commit') throw Error('unexpected tree entry type');
    map.set(path, { mode, type, oid });
  }
  return map;
}
function sorted(values) { return [...values].sort((a, b) => a.localeCompare(b, 'en')); }

if (gitText('rev-parse', '--is-shallow-repository').trim() !== 'false') {
  throw Error('INCOMPLETE: shallow Git checkout, fetch the full history first');
}
const refNames = gitText('for-each-ref', '--format=%(refname)', 'refs/remotes/origin', 'refs/heads', 'refs/tags')
  .split('\n').filter(x => x && !x.endsWith('/HEAD'));
const mainRef = hasRef('refs/remotes/origin/main') ? 'refs/remotes/origin/main' : 'refs/heads/main';
if (!hasRef(mainRef)) throw Error('INCOMPLETE: the main branch reference is unavailable');
const main = treeEntries(mainRef);
const head = treeEntries('HEAD');

const presentAtAnyTip = new Set();
const gitlinks = new Set();
for (const ref of new Set([...refNames, 'HEAD'])) {
  const entries = treeEntries(ref);
  for (const [path, entry] of entries) {
    presentAtAnyTip.add(path);
    if (entry.type === 'commit') gitlinks.add(path);
  }
}
const historicalNames = gitResult(['log', '--all', 'HEAD', '--no-renames', '--pretty=format:', '--name-only', '-z'])
  .toString('utf8').split('\0').map(name => name.replace(/^[\r\n]+/, '')).filter(Boolean);
const historicalPaths = new Set(historicalNames);
for (const path of presentAtAnyTip) historicalPaths.add(path);

const missingFromMain = sorted([...historicalPaths].filter(path => !main.has(path)));
const historicOnly = sorted([...historicalPaths].filter(path => !presentAtAnyTip.has(path)));

const objectLines = gitText('rev-list', '--objects', '--missing=print', '--all', 'HEAD').trim().split('\n').filter(Boolean);
const missingObjects = objectLines.filter(line => line.startsWith('?')).map(line => line.slice(1).split(' ')[0]);
const objectIds = [...new Set(objectLines.filter(line => !line.startsWith('?')).map(line => line.slice(0, 40)))];
const objectStats = { commit: 0, tree: 0, blob: 0, tag: 0, missing: 0 };
const input = Buffer.from(objectIds.join('\n') + '\n');
const typeLines = gitResult(['cat-file', '--batch-check=%(objecttype)'], input).toString('utf8').trim().split('\n');
for (const type of typeLines) {
  if (Object.hasOwn(objectStats, type)) objectStats[type]++;
  else objectStats.missing++;
}
const check = spawnSync('git', ['fsck', '--full', '--no-reflogs'], {
  cwd: repo, encoding: 'utf8', maxBuffer, timeout: 240_000,
});
const fsckOk = check.status === 0 && !check.error;

const checksumRefs = [];
for (const path of main.keys()) {
  if (!/\.SHA256SUMS$/i.test(path)) continue;
  const payload = gitText('show', mainRef + ':' + path);
  for (const line of payload.split(/\r?\n/)) {
    const m = /^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (!m) continue;
    const referenced = m[2].replace(/\\/g, '/');
    if (!/\.(zip|7z|tar(?:\.gz)?|rar|tgz)$/i.test(referenced)) continue;
    const file = basename(referenced);
    const tracked = [...historicalPaths].some(p => p === file || p.endsWith('/' + file));
    checksumRefs.push({
      checksumFile: path,
      archiveName: file,
      archiveEverTrackedInReachableGitHistory: tracked,
      checksumSha256: m[1].toLowerCase(),
    });
  }
}
const roots = gitText('rev-list', '--max-parents=0', '--all', 'HEAD').split('\n').filter(Boolean);
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'All locally reachable HEAD, branch and tag refs; immutable Git objects, not uncommitted/external assets',
  verdict: !fsckOk || missingObjects.length || objectStats.missing
    ? 'GIT_INTEGRITY_FAILED'
    : 'REACHABLE_GIT_HISTORY_INTACT_WITH_EXTERNAL_LIMITATIONS',
  repositoryMainSha: gitText('rev-parse', mainRef).trim(),
  checkoutSha: gitText('rev-parse', 'HEAD').trim(),
  initialRootCommits: roots.map(sha => ({ sha, authorDate: gitText('show', '-s', '--format=%aI', sha).trim() })),
  references: {
    remoteBranches: refNames.filter(x => x.startsWith('refs/remotes/origin/')).length,
    localBranches: refNames.filter(x => x.startsWith('refs/heads/')).length,
    tags: refNames.filter(x => x.startsWith('refs/tags/')).length,
  },
  summary: {
    mainTrackedPaths: main.size,
    mainTrackedBlobs: [...main.values()].filter(v => v.type === 'blob').length,
    checkoutTrackedPaths: head.size,
    uniqueHistoricalPaths: historicalPaths.size,
    historicalPathsAbsentFromMain: missingFromMain.length,
    historicalPathsAbsentFromAllFetchedTips: historicOnly.length,
    reachableGitObjects: objectIds.length,
    missingGitObjects: missingObjects.length,
    fsckPassed: fsckOk,
    gitlinkPaths: gitlinks.size,
    externalArchiveChecksumReferences: checksumRefs.filter(x => !x.archiveEverTrackedInReachableGitHistory).length,
  },
  objectTypes: objectStats,
  missingGitObjects: missingObjects,
  gitlinkPaths: sorted(gitlinks),
  referencedReleaseArchives: checksumRefs,
  pathsAbsentFromMain: missingFromMain,
  pathsOnlyInHistoricalCommits: historicOnly,
  mainInventory: sorted(main.keys()).map(path => ({ path, ...main.get(path) })),
  historicalPathInventory: sorted(historicalPaths),
  limits: [
    'Paths absent from main may be intentionally removed or renamed, not lost.',
    'This proves integrity only for Git objects reachable through currently fetched refs and HEAD.',
    'Files from before the first available Git commit cannot be proved by this repository.',
    'Locally uncommitted, ignored, force-pushed/unreachable or garbage-collected files are out of scope.',
    'External ZIP/backup archives, expiring Actions artifacts and Git LFS backing objects require independent evidence.',
  ],
};
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
const md = [
  '# Klar Git File Retention Audit',
  '',
  'Generated: ' + report.generatedAt,
  '',
  '**Verdict:** ' + report.verdict,
  '',
  '| Metric | Value |',
  '|---|---:|',
  '| Current main tracked files | ' + report.summary.mainTrackedPaths + ' |',
  '| Current audit checkout files | ' + report.summary.checkoutTrackedPaths + ' |',
  '| Ever-tracked unique file paths in reachable Git history | ' + report.summary.uniqueHistoricalPaths + ' |',
  '| Previously tracked paths absent from main | ' + report.summary.historicalPathsAbsentFromMain + ' |',
  '| Paths absent from every current ref tip, but available in history | ' + report.summary.historicalPathsAbsentFromAllFetchedTips + ' |',
  '| Remote branches audited | ' + report.references.remoteBranches + ' |',
  '| Tags audited | ' + report.references.tags + ' |',
  '| Reachable Git objects | ' + report.summary.reachableGitObjects + ' |',
  '| Missing reachable Git objects | ' + report.summary.missingGitObjects + ' |',
  '| git fsck passed | ' + report.summary.fsckPassed + ' |',
  '| External archive references without tracked Git payload | ' + report.summary.externalArchiveChecksumReferences + ' |',
  '',
  '## Roots',
  ...report.initialRootCommits.map(x => '- ' + x.authorDate + ' : ' + x.sha),
  '',
  '## External release evidence',
  ...report.referencedReleaseArchives.map(x => '- ' + x.archiveName + ': referenced by ' + x.checksumFile + '; tracked in reachable history=' + x.archiveEverTrackedInReachableGitHistory),
  '',
  '## Historical-only path examples (not necessarily a loss)',
  ...historicOnly.slice(0, 35).map(path => '- ' + path.replace(/\r?\n/g, ' ')),
  '',
  '## Assurance boundary',
  ...report.limits.map(x => '- ' + x),
  '',
  'The companion JSON contains full path inventories and Git object proof counts. No file contents, secrets or user records are written to this report.',
].join('\n') + '\n';
const markdownPath = reportPath.endsWith('.json') ? reportPath.slice(0, -5) + '.md' : reportPath + '.md';
writeFileSync(markdownPath, md);
console.log('Git retention audit: ' + report.verdict);
console.log(JSON.stringify({ ...report.summary, refs: report.references, initialRootCommits: report.initialRootCommits }));
if (!fsckOk || missingObjects.length || objectStats.missing) process.exitCode = 1;
