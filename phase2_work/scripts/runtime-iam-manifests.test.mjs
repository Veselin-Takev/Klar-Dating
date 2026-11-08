import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderReleaseManifests, validateRuntimeIdentity } from './release-manifests.mjs';
const projectId = 'synthetic-klar-project';
const serviceAccount = `klar-runtime@${projectId}.iam.gserviceaccount.com`;
test('rendered deployment artifacts bind only the approved dedicated runtime identity', () => {
  const directory = mkdtempSync(join(tmpdir(), 'klar-iam-render-'));
  try {
    const owner = process.env.GITHUB_REPOSITORY_OWNER || 'veselin8606-source';
    const files = renderReleaseManifests(`ghcr.io/${owner}/klar-app@sha256:${'a'.repeat(64)}`, directory, process.cwd(), {projectId, serviceAccount});
    for (const path of files) assert.equal(JSON.parse(readFileSync(path, 'utf8')).spec.template.spec.serviceAccountName,serviceAccount);
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
for (const identity of [{}, {projectId}, {projectId,serviceAccount:'default'}, {projectId,serviceAccount:'123-compute@developer.gserviceaccount.com'}, {projectId,serviceAccount:'klar-runtime@other-project.iam.gserviceaccount.com'}]) {
  test('rejects unapproved runtime identity '+JSON.stringify(identity), () => assert.throws(() => validateRuntimeIdentity(identity)));
}
