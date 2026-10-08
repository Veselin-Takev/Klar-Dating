import { readFile } from 'node:fs/promises';

const path = process.argv[2] ?? '';
if (!path) throw new Error('Usage: node scripts/check-container-attestations.mjs <raw-index.json>');

const raw = JSON.parse(await readFile(path, 'utf8'));
const manifests = Array.isArray(raw?.manifests) ? raw.manifests : [];
if (raw?.mediaType !== 'application/vnd.oci.image.index.v1+json') {
  throw new Error('Container registry result must be an OCI image index');
}
if (manifests.length === 0) throw new Error('Container image index contains no manifests');

const imageManifests = manifests.filter(entry => entry?.platform?.os !== 'unknown' && entry?.platform?.architecture !== 'unknown');
if (imageManifests.length === 0) throw new Error('Container image index contains no runnable image manifests');

const attestations = manifests.filter(entry =>
  entry?.annotations?.['vnd.docker.reference.type'] === 'attestation-manifest' &&
  /^sha256:[0-9a-f]{64}$/.test(entry?.annotations?.['vnd.docker.reference.digest'] ?? '')
);
if (attestations.length === 0) throw new Error('No Docker attestation manifests found in the published image index');

const references = new Set(attestations.map(entry => entry.annotations['vnd.docker.reference.digest']));
const missing = imageManifests
  .map(entry => entry.digest)
  .filter(digest => !references.has(digest));
if (missing.length) {
  throw new Error(`Missing attestation reference for image manifest(s): ${missing.join(', ')}`);
}

console.log(`Container attestation index PASS: ${imageManifests.length} image manifest(s), ${attestations.length} attestation manifest(s).`);
