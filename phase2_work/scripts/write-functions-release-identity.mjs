import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const sha = process.env.GITHUB_SHA ?? '';
const refName = process.env.GITHUB_REF_NAME ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const runId = process.env.GITHUB_RUN_ID ?? '';

for (const [name, value, pattern] of [
  ['GITHUB_SHA', sha, /^[0-9a-f]{40}$/],
  ['GITHUB_REF_NAME', refName, /^v[0-9]+\.[0-9]+\.[0-9]+$/],
  ['GITHUB_REPOSITORY', repository, /^[^/]+\/[^/]+$/],
  ['GITHUB_RUN_ID', runId, /^[0-9]+$/],
]) {
  if (!pattern.test(value)) throw new Error(`${name} is missing or invalid`);
}

async function gitRevParse(revision) {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--verify', revision], { encoding: 'utf8' });
  return stdout.trim();
}

async function hashFile(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

async function hashTree(root) {
  const entries = [];
  async function walk(directory) {
    const items = await readdir(directory, { withFileTypes: true });
    items.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of items) {
      const path = join(directory, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile()) {
        const bytes = await readFile(path);
        entries.push([relative(root, path).replaceAll('\\', '/'), bytes]);
      }
    }
  }
  await walk(root);
  if (entries.length === 0) throw new Error(`No build output found under ${root}`);
  const digest = createHash('sha256');
  for (const [name, bytes] of entries) {
    digest.update(name, 'utf8');
    digest.update('\0', 'utf8');
    digest.update(bytes);
    digest.update('\0', 'utf8');
  }
  return { sha256: digest.digest('hex'), files: entries.length };
}

const headSha = await gitRevParse('HEAD');
if (headSha !== sha) throw new Error(`Checked-out HEAD ${headSha} does not match GITHUB_SHA ${sha}`);
const tagSha = await gitRevParse(`refs/tags/${refName}^{commit}`);
if (tagSha !== sha) throw new Error(`Release tag ${refName} resolves to ${tagSha}, not GITHUB_SHA ${sha}`);

const functionsRoot = resolve('functions');
const packageJson = await stat(join(functionsRoot, 'package.json'));
const packageLock = await stat(join(functionsRoot, 'package-lock.json'));
if (!packageJson.isFile() || !packageLock.isFile()) throw new Error('Functions package manifest and lockfile are required');
const build = await hashTree(resolve(functionsRoot, 'lib'));
const lockSha = await hashFile(join(functionsRoot, 'package-lock.json'));
const packageSha = await hashFile(join(functionsRoot, 'package.json'));

await mkdir('release', { recursive: true });
await writeFile('release/functions-build-identity.json', JSON.stringify({
  schemaVersion: 1,
  repository,
  tag: refName,
  commitSha: sha,
  tagCommitSha: tagSha,
  headCommitSha: headSha,
  workflowRunId: runId,
  packageJsonSha256: packageSha,
  packageLockSha256: lockSha,
  compiledOutputSha256: build.sha256,
  compiledOutputFiles: build.files,
}, null, 2) + '\n');
