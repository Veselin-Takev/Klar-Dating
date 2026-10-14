import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('RELEASE_MANIFEST.json', 'utf8'));
const failures = [];
if (manifest.releaseDate !== '2026-10-08') failures.push('Historical release manifest date mismatch');
if (manifest.sourceProvenance?.baseArtifactSha256 !== 'c2c77fd139adde32ad011fe9d00d9edafa33f98a5cd8d896f8056e3f44414365') failures.push('Historical base artifact provenance mismatch');
if (manifest.releaseEvidence?.status !== 'pending-dynamic-ci-and-remote-sync') failures.push('Release evidence must remain pending until separately verified');
if (manifest.releaseGovernance?.decision !== 'NO-GO' || manifest.releaseGovernance?.productionApproved !== false) {
  failures.push('Historical candidate must not assert production approval');
}
if (manifest.releaseGovernance?.candidateVerified !== false || manifest.releaseGovernance?.fullPreflight !== 'BLOCKED') {
  failures.push('Historical candidate must preserve unverified, blocked preflight state');
}
if (failures.length) {
  console.error('Release provenance policy FAILED:');
  for (const failure of failures) console.error('- ' + failure);
  process.exitCode = 1;
} else {
  console.log('PASS — historical candidate provenance consistent; production remains NO-GO (not a live release attestation)');
}
