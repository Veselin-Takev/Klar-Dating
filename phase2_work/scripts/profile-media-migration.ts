import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import {
  applyProfileMediaMigrationBatch,
  createProfileMediaMigrationPlan,
  profileMediaAliasSnapshotHash,
  type ProfileMediaMigrationAction,
  type ProfileMediaMigrationCheckpoint,
  type ProfileMediaMigrationPlan,
  type ProfileMediaMigrationRecord,
} from '../src/server/platform/profileMediaMigration';
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
function readJson<T>(path: string): { raw: string; value: T } {
  const raw = readFileSync(path, 'utf8');
  return { raw, value: JSON.parse(raw) as T };
}
function writePrivateJson(path: string, value: unknown): void {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = target + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, target);
  chmodSync(target, 0o600);
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function currentUpdateMatches(data: Record<string, unknown>, updates: Record<string, unknown>): boolean {
  return Object.entries(updates).every(([key, value]) => isDeepStrictEqual(data[key], value));
}

async function main(): Promise<void> {
  const manifestPath = option('--manifest');
  if (!manifestPath) throw new Error('An explicit staging approval manifest is required.');
  const { raw, value: manifest } = readJson<ProfileMediaE2Manifest>(manifestPath);
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
  if (!Array.isArray(manifest.profileCohort) || manifest.profileCohort.length === 0) {
    throw new Error('The approved manifest must contain a bounded profileCohort.');
  }

  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.FIREBASE_STORAGE_BUCKET = bucketName;
  if (emulator) {
    const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST!;
    process.env.STORAGE_EMULATOR_HOST = storageHost.startsWith('http') ? storageHost : 'http://' + storageHost;
  }

  const [{ getDb, getServerFirebaseApp }, { getAppBucket }] = await Promise.all([
    import('../src/server/db'),
    import('../src/server/storage'),
  ]);
  const app = getServerFirebaseApp();
  if (app.options.projectId !== projectId) throw new Error('Firebase Admin resolved a project different from the approved target.');
  const db = getDb() as Firestore;
  const bucket = getAppBucket() as Bucket;
  if (bucket.name !== bucketName) throw new Error('Storage Admin resolved a bucket different from the approved target.');
  const records: ProfileMediaMigrationRecord[] = [];
  for (const item of manifest.profileCohort) {
    const snapshot = await db.collection(item.collection).doc(item.uid).get();
    if (!snapshot.exists) throw new Error('An approved profile cohort document is missing; execution is refused.');
    records.push({ collection: item.collection, uid: item.uid, data: snapshot.data() as Record<string, unknown> });
  }
  const inspect = async (objectPath: string) => {
    try {
      const [metadata] = await bucket.file(objectPath).getMetadata();
      return {
        exists: true,
        generation: typeof metadata.generation === 'string' ? metadata.generation : undefined,
        metageneration: typeof metadata.metageneration === 'string' ? metadata.metageneration : undefined,
        contentType: metadata.contentType,
        size: Number(metadata.size),
      };
    } catch (error) {
      if ((error as { code?: number }).code === 404) return { exists: false };
      throw new Error('Storage metadata inspection failed; no details were logged.');
    }
  };

  const planFile = resolve(option('--plan-file') ?? '.klar-profile-media-migration-plan.json');
  if (!flag('--execute')) {
    const plan = await createProfileMediaMigrationPlan(records, inspect, manifestDigest, bucketName);
    writePrivateJson(planFile, plan);
    console.log(JSON.stringify({
      mode: 'dry-run',
      planDigest: plan.planDigest,
      planFile: '[RESTRICTED_LOCAL_FILE]',
      summary: plan.summary,
      databaseWrites: 0,
      storageMutations: 0,
    }, null, 2));
    return;
  }

  if (!flag('--confirm-staging-execution') || process.env.KLAR_E2_APPROVED_MANIFEST_SHA256 !== manifestDigest) {
    throw new Error('Execution confirmation or independently pinned manifest digest is missing.');
  }
  if (!existsSync(planFile)) throw new Error('A prior dry-run plan file is required before execution.');
  const plan = JSON.parse(readFileSync(planFile, 'utf8')) as ProfileMediaMigrationPlan;
  if (plan.version !== 1 || plan.manifestDigest !== manifestDigest
      || plan.planDigest !== digest(JSON.stringify({ version: 1, manifestDigest, summary: plan.summary, actions: plan.actions }))) {
    throw new Error('The saved migration plan does not match the approved manifest or integrity digest.');
  }
  const freshPlan = await createProfileMediaMigrationPlan(records, inspect, manifestDigest, bucketName);
  if (freshPlan.planDigest !== plan.planDigest || freshPlan.summary.unresolvedProfiles > 0) {
    throw new Error('The source records or object generations changed since dry-run; create a new plan.');
  }
  if (plan.summary.unresolvedProfiles > 0) throw new Error('The plan contains unresolved profiles; execution is refused.');

  const checkpointFile = resolve(option('--checkpoint-file') ?? '.klar-profile-media-migration-checkpoint.json');
  let checkpoint: ProfileMediaMigrationCheckpoint | undefined;
  if (existsSync(checkpointFile)) {
    if (!flag('--resume')) throw new Error('A checkpoint already exists; use --resume with the same plan or create a new checkpoint path.');
    checkpoint = JSON.parse(readFileSync(checkpointFile, 'utf8')) as ProfileMediaMigrationCheckpoint;
  }
  const batchSize = Number(option('--batch-size') ?? '25');
  const maxBatches = Number(option('--max-batches') ?? '1');

  const result = await applyProfileMediaMigrationBatch(plan, {
    compareAndSet: async (action: ProfileMediaMigrationAction) => {
      for (const objectVersion of action.objectVersions) {
        const current = await inspect(objectVersion.objectPath);
        if (!current.exists || current.generation !== objectVersion.generation
            || current.metageneration !== objectVersion.metageneration) return 'conflict';
      }
      const reference = db.collection(action.collection).doc(action.uid);
      return db.runTransaction(async transaction => {
        const latest = await transaction.get(reference);
        if (!latest.exists) return 'conflict';
        const data = latest.data() as Record<string, unknown>;
        if (currentUpdateMatches(data, action.updates)) return 'already-applied';
        if (profileMediaAliasSnapshotHash(data) !== action.expectedAliasSnapshotHash) return 'conflict';
        transaction.update(reference, action.updates as never);
        return 'updated';
      });
    },
  }, {
    checkpoint,
    batchSize,
    maxBatches,
    onCheckpoint: current => writePrivateJson(checkpointFile, current),
  });
  console.log(JSON.stringify({
    mode: 'staging-execution',
    planDigest: plan.planDigest,
    checkpointFile: '[RESTRICTED_LOCAL_FILE]',
    processedThisRun: result.processedThisRun,
    updated: result.checkpoint.updated,
    alreadyApplied: result.checkpoint.alreadyApplied,
    conflicts: result.conflicts,
    nextIndex: result.checkpoint.nextIndex,
    complete: result.complete,
    stoppedOnConflict: result.stoppedOnConflict,
  }, null, 2));
  if (result.stoppedOnConflict) process.exitCode = 2;
}

main().catch(() => {
  console.error('Profile-media migration stopped safely. No URL, token, UID, object path or SDK error was logged.');
  process.exitCode = 1;
});
