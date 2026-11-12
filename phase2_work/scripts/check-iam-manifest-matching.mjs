import { readFileSync } from 'node:fs';
const files = ['deploy/templates/cloud-run.json','deploy/templates/service.json'];
for (const path of files) {
  const manifest = JSON.parse(readFileSync(path,'utf8'));
  const spec = manifest.spec?.template?.spec;
  if (manifest.kind !== 'Service' || !spec || !Object.hasOwn(spec,'serviceAccountName') || spec.serviceAccountName !== null) {
    throw new Error('Source templates must expose a render-only service account slot');
  }
}
const terraform = readFileSync('../infra/iam/main.tf','utf8');
for (const marker of ['google_service_account','klar-runtime','roles/datastore.user','roles/storage.objectUser','google_project_iam_custom_role','google_secret_manager_secret_iam_member']) {
  if (!terraform.includes(marker)) throw new Error('Missing runtime IAM module control: '+marker);
}
if (/roles\/(owner|editor|iam.serviceAccountTokenCreator)/.test(terraform)) throw new Error('Broad runtime privilege is forbidden');
const renderer = readFileSync('scripts/release-manifests.mjs','utf8');
if (!renderer.includes('validateRuntimeIdentity(identity)') || !renderer.includes('manifest.spec.template.spec.serviceAccountName = serviceAccount')) throw new Error('Runtime identity enforcement missing');
console.log('IAM manifest matching PASS: Terraform/runtime identity render contract implemented; provisioning and effective grants NOT VERIFIED.');
if (process.argv.includes('--certify')) process.exitCode = 1;
