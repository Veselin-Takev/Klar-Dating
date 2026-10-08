import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const sha = process.env.GITHUB_SHA ?? '';
const refName = process.env.GITHUB_REF_NAME ?? '';
const repository = process.env.GITHUB_REPOSITORY ?? '';
const digest = process.env.KLAR_RELEASE_DIGEST ?? '';
const sbomPath = process.env.KLAR_SBOM_PATH ?? 'release/sbom.cdx.json';

for (const [name, value, pattern] of [
  ['GITHUB_SHA', sha, /^[0-9a-f]{40}$/],
  ['GITHUB_REF_NAME', refName, /^v[0-9]+\.[0-9]+\.[0-9]+$/],
  ['GITHUB_REPOSITORY', repository, /^[^/]+\/[^/]+$/],
  ['KLAR_RELEASE_DIGEST', digest, /^sha256:[0-9a-f]{64}$/],
]) {
  if (!pattern.test(value)) throw new Error(`${name} is missing or invalid`);
}

const sbom = JSON.parse(await readFile(sbomPath, 'utf8'));
if (sbom.bomFormat !== 'CycloneDX') throw new Error('SBOM must be CycloneDX');
if (sbom.specVersion !== '1.7') throw new Error('SBOM must use CycloneDX 1.7');
if (typeof sbom.serialNumber !== 'string' || !/^urn:uuid:[0-9a-f-]{36}$/i.test(sbom.serialNumber)) {
  throw new Error('SBOM serialNumber must be a UUID URN');
}

const sbomBytes = await readFile(sbomPath);
const sbomSha256 = createHash('sha256').update(sbomBytes).digest('hex');
await mkdir('release', { recursive: true });
await writeFile('release/sbom-build-identity.json', JSON.stringify({
  schemaVersion: 1,
  repository,
  tag: refName,
  commitSha: sha,
  imageDigest: digest,
  sbom: {
    path: sbomPath,
    sha256: sbomSha256,
    serialNumber: sbom.serialNumber,
    bomFormat: sbom.bomFormat,
    specVersion: sbom.specVersion,
  },
}, null, 2) + '\n');
