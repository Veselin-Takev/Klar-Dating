/** Read-only collector. Raw policies stay in a private external evidence vault. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateExternalReportPath } from './report-path.mjs';

type Json = Record<string, any>;
type Run = (args: string[]) => Json;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function collectIam(scope: {project: string; region: string; service: string; bucket: string}, run: Run) {
  const {project, region, service, bucket} = scope;
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) || !/^[a-z]+-[a-z]+[0-9]$/.test(region)
    || !/^[a-z][a-z0-9-]{0,62}$/.test(service) || !/^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$/.test(bucket)) throw new Error('invalid_iam_scope');
  const raw: Record<string, unknown> = {};
  const capture = (key: string, args: string[]) => {
    const result = run([...args, '--format=json', '--quiet']);
    if (!result || typeof result !== 'object') throw new Error('empty_iam_capture');
    raw[key] = result;
    return result;
  };
  const serviceJson = capture('cloudRunService', ['run','services','describe',service,'--project',project,'--region',region]);
  capture('cloudRunInvokerPolicy', ['run','services','get-iam-policy',service,'--project',project,'--region',region]);
  const expectedAccount = `klar-runtime@${project}.iam.gserviceaccount.com`;
  const revisions = new Set<string>();
  for (const traffic of serviceJson.status?.traffic ?? []) {
    if (traffic.percent > 0 || traffic.tag) {
      if (!traffic.revisionName) throw new Error('unresolved_traffic_revision');
      revisions.add(traffic.revisionName);
    }
  }
  if (serviceJson.status?.latestReadyRevisionName) revisions.add(serviceJson.status.latestReadyRevisionName);
  if (!revisions.size) throw new Error('no_serving_revision_evidence');
  const identities: {revision: string; serviceAccount: string}[] = [];
  for (const revision of revisions) {
    if (!/^[a-z][a-z0-9-]{0,62}$/.test(revision)) throw new Error('invalid_revision');
    const data = capture('revision:' + revision, ['run','revisions','describe',revision,'--project',project,'--region',region]);
    if (typeof data.spec?.serviceAccountName !== 'string') throw new Error('missing_revision_identity');
    identities.push({revision, serviceAccount: data.spec.serviceAccountName});
  }
  const ancestors = capture('ancestors', ['projects','get-ancestors',project]);
  if (!Array.isArray(ancestors) || !ancestors.some(item => item.type === 'project')) throw new Error('incomplete_ancestor_inventory');
  capture('projectPolicy', ['projects','get-iam-policy',project]);
  for (const ancestor of ancestors) {
    if (ancestor.type === 'project') continue;
    if (!['folder','organization'].includes(ancestor.type) || !/^\d+$/.test(ancestor.id)) throw new Error('invalid_ancestor');
    capture(ancestor.type + ':' + ancestor.id, ancestor.type === 'folder'
      ? ['resource-manager','folders','get-iam-policy',ancestor.id]
      : ['organizations','get-iam-policy',ancestor.id]);
  }
  capture('bucketPolicy', ['storage','buckets','get-iam-policy','gs://' + bucket,'--project',project]);
  capture('bucketConfiguration', ['storage','buckets','describe','gs://' + bucket,'--project',project]);
  capture('firestoreDatabases', ['firestore','databases','list','--project',project]);
  capture('runtimeServiceAccountPolicy', ['iam','service-accounts','get-iam-policy',expectedAccount,'--project',project]);
  capture('runtimeAuthRole', ['iam','roles','describe','klarRuntimeAuth','--project',project]);
  for (const [key, policy] of Object.entries(raw)) {
    if (key.endsWith('Policy') || key.startsWith('folder:') || key.startsWith('organization:')) {
      if (!policy || typeof policy !== 'object') throw new Error('incomplete_iam_policy');
      const value = policy as Json;
      // Protobuf JSON omits an empty bindings list. Require an API etag in that case.
      if (!Array.isArray(value.bindings) && !(value.bindings === undefined && typeof value.etag === 'string' && value.etag)) throw new Error('incomplete_iam_policy');
      if ((value.bindings ?? []).some((binding: Json) => !binding || typeof binding.role !== 'string'
        || !Array.isArray(binding.members) || binding.members.some((member: unknown) => typeof member !== 'string'))) throw new Error('invalid_iam_binding');
    }
  }
  const runtimeBindings = Object.entries(raw).flatMap(([resource, value]) =>
    ((value as Json).bindings ?? []).filter((binding: Json) => binding.members.includes('serviceAccount:' + expectedAccount))
      .map((binding: Json) => ({resource, role: binding.role,
        ...(binding.condition ? {conditionSha256: digest(JSON.stringify(binding.condition))} : {})})));
  return {raw, summary: {scope, expectedAccount, identities, runtimeBindings,
    runtimeIdentityMatches: serviceJson.spec?.template?.spec?.serviceAccountName === expectedAccount
      && identities.every(identity => identity.serviceAccount === expectedAccount),
    reviewStatus: 'HUMAN_LEAST_PRIVILEGE_REVIEW_REQUIRED',
    firestorePolicySource: 'Project and ancestor allow policies; database-scoped conditions require human review.',
    limitations: ['Captured allow policies are not a complete effective-permissions attestation.',
      'Review group membership, conditional grants, deny policies, principal access boundaries, impersonation and cross-project grants separately.'],
    resources: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, {sha256: digest(JSON.stringify(value))}]))}};
}

export async function main() {
  const required = (key: string) => { const value = process.env[key]; if (!value) throw new Error('missing_scope'); return value; };
  const scope = {project: required('KLAR_PROJECT_ID'), region: required('KLAR_REGION'), service: required('KLAR_SERVICE'), bucket: required('KLAR_STORAGE_BUCKET')};
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const output = validateExternalReportPath(root, resolve(required('KLAR_IAM_PRIVATE_OUTPUT')));
  const buildSha = execFileSync('git', ['rev-parse','HEAD'], {cwd: root, encoding: 'utf8'}).trim();
  if (execFileSync('git',['status','--porcelain'], {cwd: root, encoding: 'utf8'}).trim()) throw new Error('clean_checkout_required');
  const run: Run = args => JSON.parse(execFileSync('gcloud', args, {encoding: 'utf8', timeout: 30000, maxBuffer: 8*1024*1024, stdio: ['ignore','pipe','pipe']}));
  const result = collectIam(scope, run);
  const generatedAt = new Date().toISOString();
  const privateText = JSON.stringify({schemaVersion: 1, generatedAt, buildSha, ...result}, null, 2) + '\n';
  await writeFile(output, privateText, {mode: 0o600, flag: 'wx'});
  const source = await readFile(fileURLToPath(import.meta.url), 'utf8');
  const summary = {schemaVersion: 1, status: 'LIVE_CAPTURED_REVIEW_PENDING', generatedAt, buildSha,
    collectorSha256: digest(source), privateExportSha256: digest(privateText), ...result.summary};
  // Minimized, write-once public receipt; never export full IAM policies or env values into Git.
  const publicOutput = process.env.KLAR_IAM_SUMMARY_OUTPUT;
  if (publicOutput) await writeFile(resolve(publicOutput), JSON.stringify(summary, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
  console.log(JSON.stringify({event: 'iam_capture_completed', runtimeIdentityMatches: summary.runtimeIdentityMatches, reviewStatus: summary.reviewStatus}));
  if (!summary.runtimeIdentityMatches) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch(() => { console.error(JSON.stringify({event: 'iam_capture_failed'})); process.exitCode = 1; });
}
