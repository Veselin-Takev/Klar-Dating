import { readFileSync } from 'node:fs';
const manifest=JSON.parse(readFileSync('RELEASE_MANIFEST.json','utf8'));
if (manifest.releaseDate !== '2026-10-08') throw new Error('Release manifest date mismatch');
if (manifest.sourceProvenance?.baseArtifactSha256 !== 'c2c77fd139adde32ad011fe9d00d9edafa33f98a5cd8d896f8056e3f44414365') throw new Error('Base artifact provenance mismatch');
if (manifest.releaseEvidence?.status !== 'pending-dynamic-ci-and-remote-sync') throw new Error('Release evidence status must remain fail-closed');
console.log('PASS — release provenance is explicit and fail-closed');
