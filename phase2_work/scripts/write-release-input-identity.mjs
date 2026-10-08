import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sha = process.env.GITHUB_SHA ?? '';
const refName = process.env.GITHUB_REF_NAME ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const runId = process.env.GITHUB_RUN_ID ?? '';
const sourceArchive = process.env.KLAR_SOURCE_ARCHIVE ?? 'release/klar-' + refName + '.tar.gz';

for (const [name, value, pattern] of [
  ['GITHUB_SHA', sha, /^[0-9a-f]{40}$/],
  ['GITHUB_REF_NAME', refName, /^v[0-9]+\.[0-9]+\.[0-9]+$/],
  ['GITHUB_REPOSITORY', repository, /^[^/]+\/[^/]+$/],
  ['GITHUB_RUN_ID', runId, /^[0-9]+$/],
]) {
  if (!pattern.test(value)) throw new Error(`${name} is missing or invalid`);
}

async function revParse(revision) {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--verify', revision], { encoding: 'utf8' });
  return stdout.trim();
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

const headSha = await revParse('HEAD');
const tagSha = await revParse(`refs/tags/${refName}^{commit}`);
if (headSha !== sha) throw new Error(`Checked-out HEAD ${headSha} does not match GITHUB_SHA ${sha}`);
if (tagSha !== sha) throw new Error(`Release tag ${refName} resolves to ${tagSha}, not ${sha}`);

const inputs = [
  'package.json',
  'bun.lock',
  'Dockerfile',
  'functions/package.json',
  'functions/package-lock.json',
];
const hashes = {};
for (const path of inputs) hashes[path] = await sha256(path);
const archiveSha = await sha256(sourceArchive);

await mkdir('release', { recursive: true });
await writeFile('release/release-input-identity.json', JSON.stringify({
  schemaVersion: 1,
  repository,
  tag: refName,
  commitSha: sha,
  tagCommitSha: tagSha,
  headCommitSha: headSha,
  workflowRunId: runId,
  sourceArchive: { path: sourceArchive, sha256: archiveSha },
  inputs: hashes,
}, null, 2) + '\n');
