import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Bucket } from '@google-cloud/storage';
import {
  createProfileMediaTokenRevocationPlan,
  executeProfileMediaTokenRevocation,
  type ProfileMediaTokenRevocationPlan,
} from '../src/server/platform/profileMediaTokenRevocation';
import {
  profileMediaManifestDigest,
  validateProfileMediaE2Manifest,
  type ProfileMediaE2Manifest,
} from '../src/server/platform/profileMediaE2Manifest';

function option(name: string): string | undefined {
  const prefix = name + '=';
  const inline = process.argv.slice(2).find(argument => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function flag(name: string): boolean { return process.argv.includes(name); }
function writePrivateJson(path: string, value: unknown): void {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, target);
  chmodSync(target, 0o600);
}

async function main(): Promise<void> {
  const manifestPath = option('--manifest');
  if (!manifestPath) throw new Error('An explicit staging approval manifest is required.');
  const raw = readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(raw) as ProfileMediaE2Manifest;
  const manifestDigest = profileMediaManifestDigest(raw);
  const emulator = flag('--emulator');
  const projectId = option('--project-id') ?? process.env.GCLOUD_PROJECT ?? '';
  const bucketName = option('--bucket') ?? (emulator && projectId ? projectId + '.appspot.com' : '');
  if (emulator) {
    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    if (storageHost) process.env.STORAGE_EMULATOR_HOST = storageHost.startsWith('http') ? storageHost : 'http://' + storageHost;
  }
  validateProfileMediaE2Manifest(manifest, {
    projectId, bucketName, emulator,
    execute: flag('--execute'),
    confirmStagingExecution: flag('--confirm-staging-execution'),
    manifestDigest,
  });
  if (!Array.isArray(manifest.objectCohort) || manifest.objectCohort.length === 0) {
    throw new Error('The approved manifest must contain a bounded objectCohort.');
  }

  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.FIREBASE_STORAGE_BUCKET = bucketName;
  if (emulator) {
    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST!;
    process.env.STORAGE_EMULATOR_HOST = storageHost.startsWith('http') ? storageHost : 'http://' + storageHost;
  }
  const [{ getServerFirebaseApp }, { getAppBucket }] = await Promise.all([
    import('../src/server/db'), import('../src/server/storage'),
  ]);
  const app = getServerFirebaseApp();
  if (app.options.projectId !== projectId) throw new Error('Firebase Admin resolved a project different from the approved target.');
  const bucket = getAppBucket() as Bucket;
  if (bucket.name !== bucketName) throw new Error('Storage Admin resolved a bucket different from the approved target.');
  const readMetadata = async (objectPath: string) => {
    try {
      const [metadata] = await bucket.file(objectPath).getMetadata();
      return {
        exists: true,
        generation: typeof metadata.generation === 'string' ? metadata.generation : undefined,
        metageneration: typeof metadata.metageneration === 'string' ? metadata.metageneration : undefined,
        customMetadata: metadata.metadata && typeof metadata.metadata === 'object'
          ? metadata.metadata as Record<string, string | undefined>
          : {},
      };
    } catch (error) {
      if ((error as { code?: number }).code === 404) return { exists: false };
      throw new Error('Storage metadata read failed; no details were logged.');
    }
  };
  const planFile = resolve(option('--plan-file') ?? '.klar-profile-media-token-revocation-plan.json');

  if (!flag('--execute')) {
    const plan = await createProfileMediaTokenRevocationPlan(manifest.objectCohort, readMetadata, manifestDigest);
    writePrivateJson(planFile, plan);
    console.log(JSON.stringify({
      mode: 'dry-run',
      planDigest: plan.planDigest,
      planFile: '[RESTRICTED_LOCAL_FILE]',
      summary: plan.summary,
      storageMutations: 0,
      objectDataWrites: 0,
    }, null, 2));
    return;
  }

  if (!flag('--confirm-staging-execution') || process.env.KLAR_E2_APPROVED_MANIFEST_SHA256 !== manifestDigest) {
    throw new Error('Execution confirmation or independently pinned manifest digest is missing.');
  }
  if (!existsSync(planFile)) throw new Error('A prior dry-run plan file is required before execution.');
  const plan = JSON.parse(readFileSync(planFile, 'utf8')) as ProfileMediaTokenRevocationPlan;
  if (plan.version !== 1 || plan.manifestDigest !== manifestDigest
      || plan.summary.manifestMismatches > 0 || plan.summary.missingObjects > 0) {
    throw new Error('The saved revocation plan is stale, mismatched or incomplete.');
  }
  const freshPlan = await createProfileMediaTokenRevocationPlan(manifest.objectCohort, readMetadata, manifestDigest);
  if (freshPlan.planDigest !== plan.planDigest || freshPlan.summary.manifestMismatches > 0 || freshPlan.summary.missingObjects > 0) {
    throw new Error('Object generations or token metadata changed since dry-run; create a new plan.');
  }
  const result = await executeProfileMediaTokenRevocation(plan, {
    readMetadata,
    patchCustomMetadata: async (objectPath, patch, options) => {
      try {
        await bucket.file(objectPath).setMetadata(
          { metadata: { firebaseStorageDownloadTokens: patch.firebaseStorageDownloadTokens } },
          { ifMetagenerationMatch: Number(options.ifMetagenerationMatch) },
        );
      }
    },
  });
  console.log(JSON.stringify({
    mode: 'staging-execution',
    planDigest: plan.planDigest,
    revoked: result.revoked,
    alreadyAbsent: result.alreadyAbsent,
    missing: result.missing,
    conflicts: result.conflicts,
    stopped: result.stopped,
    objectDataWrites: 0,
  }, null, 2));
  if (result.stopped) process.exitCode = 2;
}

main().catch(() => {
  console.error('Profile-media token revocation stopped safely. No URL, token, UID, object path or SDK error was logged.');
  process.exitCode = 1;
});
