import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const sha = process.env.GITHUB_SHA ?? '';
const refName = process.env.GITHUB_REF_NAME ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const digest = process.env.KLAR_RELEASE_DIGEST ?? '';
const runId = process.env.GITHUB_RUN_ID ?? '';

const checks = [
  ['GITHUB_SHA', sha, /^[0-9a-f]{40}$/],
  ['GITHUB_REF_NAME', refName, /^v[0-9]+\.[0-9]+\.[0-9]+$/],
  ['GITHUB_REPOSITORY', repository, /^[^/]+\/[^/]+$/],
  ['KLAR_RELEASE_DIGEST', digest, /^sha256:[0-9a-f]{64}$/],
  ['GITHUB_RUN_ID', runId, /^[0-9]+$/],
];
for (const [name, value, pattern] of checks) {
  if (!pattern.test(value)) throw new Error(`${name} is missing or invalid`);
}

async function gitRevParse(revision) {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--verify', revision], { encoding: 'utf8' });
  return stdout.trim();
}

const headSha = await gitRevParse('HEAD');
if (headSha !== sha) {
  throw new Error(`Checked-out HEAD ${headSha} does not match GITHUB_SHA ${sha}`);
}

const tagSha = await gitRevParse(`refs/tags/${refName}^{commit}`);
if (tagSha !== sha) {
  throw new Error(`Release tag ${refName} resolves to ${tagSha}, not GITHUB_SHA ${sha}`);
}

await mkdir('release', { recursive: true });
await writeFile('release/build-identity.json', JSON.stringify({
  schemaVersion: 2,
  repository,
  tag: refName,
  commitSha: sha,
  tagCommitSha: tagSha,
  headCommitSha: headSha,
  workflowRunId: runId,
  imageDigest: digest,
}, null, 2) + '\n');
