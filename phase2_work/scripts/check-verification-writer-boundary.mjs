import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MUTATION = /\.(?:save|delete|deleteFiles|setMetadata|createWriteStream|copy|move|rename)\s*\(/;
const STORAGE_HANDLE = /\.(?:file|getFiles)\s*\(|\b(?:getStorage|storageBucket|getAppBucket)\s*\(/;
const EXCLUDED = new Set(['node_modules', 'dist', 'coverage', '.git', '__tests__']);
const ALLOWED_MUTATION_FILES = new Set([
  'src/server/klarCore.ts',
  'src/server/routes/complianceStorage.ts',
  'src/server/routes/verificationDeletionHold.ts',
  'functions/src/retention.ts',
]);

function walk(root, relative = '') {
  const found = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED.has(entry.name)) found.push(...walk(root, path.join(relative, entry.name)));
    } else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name)
      && !/\.(?:spec|test)\.(?:ts|tsx|js|jsx)$/.test(entry.name)) {
      found.push(path.join(relative, entry.name).split(path.sep).join('/'));
    }
  }
  return found;
}

function hasOrdered(source, tokens) {
  let offset = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, offset + 1);
    if (next < 0) return false;
    offset = next;
  }
  return true;
}

function inspectVerificationWriterBoundary(sourceFiles) {
  const sources = new Map(sourceFiles);
  const violations = [];
  const add = message => violations.push(message);

  for (const [file, source] of sources) {
    const storageMutation = (/\\.file\\s*\\(/.test(source) || /\\.getFiles\\s*\\(/.test(source)) && MUTATION.test(source);
    const verificationMutation = /verification\s*\/|verificationPrefix|verificationStorage|verificationPhoto/i.test(source)
      && MUTATION.test(source);
    if ((storageMutation || verificationMutation) && !ALLOWED_MUTATION_FILES.has(file)) {
      add(file + ': unregistered Storage mutation path; bind it to the canonical Writer-Intent / Finalize / Fence contract');
    }
  }

  const writer = sources.get('src/server/klarCore.ts') ?? '';
  if (!hasOrdered(writer, [
    'bucket.file(pfad)',
    'beginVerificationDeletionWriterIntent(',
    'await file.save(bytes',
    'TRUSTED_VERIFICATION_WRITER_MARKER',
    'completeVerificationDeletionWriterIntent(',
  ])) {
    add('src/server/klarCore.ts: verification upload must reserve Writer-Intent before save and complete it only after registration writes');
  }
  if (!writer.includes('ensureVerificationDeletionFenceForUploadedObject')) {
    add('src/server/klarCore.ts: upload must use the canonical deletion fence');
  }

  const trigger = sources.get('functions/src/verificationObjectFinalized.ts') ?? '';
  if (!trigger.includes('onObjectFinalized') || !trigger.includes('retry: true')
    || !trigger.includes('/internal/verification/object-finalized')) {
    add('functions/src/verificationObjectFinalized.ts: retryable finalize registration trigger is missing or bypassed');
  }
  const registration = sources.get('src/server/platform/verificationObjectRegistration.ts') ?? '';
  if (!registration.includes('TRUSTED_VERIFICATION_WRITER_MARKER')
    || !registration.includes('ensureVerificationDeletionFenceForUploadedObject')) {
    add('src/server/platform/verificationObjectRegistration.ts: canonical finalize marker/fence registration is missing');
  }
  const finalizedRoute = sources.get('src/server/routes/verificationObjectFinalized.ts') ?? '';
  if (!finalizedRoute.includes('registerFinalizedVerificationObject')) {
    add('src/server/routes/verificationObjectFinalized.ts: finalize route must delegate to canonical registration');
  }

  const retention = sources.get('functions/src/retention.ts') ?? '';
  if (!retention.includes("mode: 'profile-only' | 'unsafe-emulator-test-only' = 'profile-only'")
    || !retention.includes("if (mode === 'profile-only') await assertNoUnfencedVerificationPhotos();")
    || !retention.includes('profiles/')
    || !retention.includes('verification_photo_p0_fencing_unverified')) {
    add('functions/src/retention.ts: account erasure must remain profile-only and hard-stop while verification objects exist');
  }
  const erasureCaller = sources.get('src/server/trustAndSafety.ts') ?? '';
  if (!/deleteAccountPhotos\s*\(\s*getAppBucket\(\)\s*,\s*meineUid\s*\)/.test(erasureCaller)
    || /deleteAccountPhotos\s*\([^;]*unsafe-emulator-test-only/.test(erasureCaller)) {
    add('src/server/trustAndSafety.ts: production account-erasure caller must not opt into verification deletion');
  }

  const purge = sources.get('src/server/routes/complianceStorage.ts') ?? '';
  if (!purge.includes("if (process.env.NODE_ENV === 'production' || !deps.getBucket)")
    || !purge.includes("return res.status(503).json({ code: 'verification_storage_purge_p0_fencing_unverified' })")
    || !purge.includes('prepareVerificationDeleteCas')) {
    add('src/server/routes/complianceStorage.ts: Default-OFF / production 503 P0 interlock and canonical fence must remain');
  }

  const hold = sources.get('src/server/routes/verificationDeletionHold.ts') ?? '';
  if (!hold.includes('beginVerificationDeletionHold')
    || !hold.includes('confirmVerificationDeletionHold')
    || !hold.includes('ifGenerationMatch')
    || !hold.includes('ifMetagenerationMatch')) {
    add('src/server/routes/verificationDeletionHold.ts: hold metadata writes must retain canonical fence and generation preconditions');
  }

  const legacyCron = sources.get('functions/src/deleteExpiredPhotos.ts') ?? '';
  if (/getFiles\s*\(|\.file\s*\(|deleteExpiredPhotoPage|verificationPrefix/.test(legacyCron)) {
    add('functions/src/deleteExpiredPhotos.ts: retired upload-age verification photo deletion must stay disabled');
  }
  return violations;
}

function runVerificationWriterBoundaryCheck(root = process.cwd()) {
  const files = [...walk(root, 'src/server'), ...walk(root, 'functions/src')];
  const sources = files.map(file => [file, readFileSync(path.join(root, file), 'utf8')]);
  const violations = inspectVerificationWriterBoundary(sources);
  assert.deepEqual(violations, [], violations.join('\n'));
  return { scannedFiles: files.length, violations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const result = runVerificationWriterBoundaryCheck();
  console.log('Verification writer boundary: PASS (' + result.scannedFiles + ' production source files scanned)');
}

export { inspectVerificationWriterBoundary, runVerificationWriterBoundaryCheck };