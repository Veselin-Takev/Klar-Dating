import { readFile, writeFile } from 'node:fs/promises';

const digest = process.env.KLAR_RELEASE_DIGEST ?? '';
const repository = `ghcr.io/${process.env.GITHUB_REPOSITORY_OWNER ?? ''}/klar-app`;
const tag = process.env.GITHUB_REF_NAME ?? '';
const tagInspectPath = process.env.KLAR_CONTAINER_TAG_INSPECT ?? 'release/container-tag-inspect.txt';

if (!/^[a-z0-9][a-z0-9._-]*$/.test(process.env.GITHUB_REPOSITORY_OWNER ?? '')) throw new Error('Invalid GITHUB_REPOSITORY_OWNER');
if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('GITHUB_REF_NAME must be a semantic release tag');
if (!/^sha256:[0-9a-f]{64}$/.test(digest)) throw new Error('KLAR_RELEASE_DIGEST must be an immutable sha256 digest');
const inspect = await readFile(tagInspectPath, 'utf8');
const digestMatches = [...inspect.matchAll(/Digest:\s*(sha256:[0-9a-f]{64})/g)].map(match => match[1]);
if (!digestMatches.includes(digest)) throw new Error(`Published tag ${repository}:${tag} does not resolve to release digest ${digest}`);
await writeFile('release/container-tag-binding.json', JSON.stringify({
  schemaVersion: 1,
  repository,
  tag,
  tagReference: `${repository}:${tag}`,
  immutableImage: `${repository}@${digest}`,
  imageDigest: digest,
}, null, 2) + '\n');
