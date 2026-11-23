import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MUTATION = /\.(?:save|delete|deleteFiles|setMetadata|createWriteStream|copy|move|rename|upload|makePublic|makePrivate)\s*\(/;
const EXCLUDED = new Set(['node_modules', 'dist', 'coverage', '.git', '__tests__']);
const ALLOWED_MUTATION_FILES = new Set([
  'src/server/klarCore.ts',
  'src/server/routes/complianceStorage.ts',
  'src/server/routes/verificationDeletionHold.ts',
  'functions/src/retention.ts',
]);
const SERVER_ADAPTER = 'server.ts';

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

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function hasStorageAlias(source) {
  const patterns = [
    // Unbound Storage object, factory or method references; do not match a
    // receiver in an ordinary invocation such as "bucket.file(path)".
    /\b(?:const|let|var)\s+[$\w]+\s*=\s*(?:[$\w]+\s*\.\s*)*(?:getStorage|storage|bucket|file|save|delete|setMetadata)\b(?!\s*[.(\[])/,
    // A factory returned by getStorage() can itself be aliased.
    /\b(?:const|let|var)\s+[$\w]+\s*=\s*getStorage\s*\([^)]*\)\s*\.\s*(?:bucket|file)\b(?!\s*\()/,
    // Destructuring Storage methods bypasses receiver-based call checks.
    /\b(?:const|let|var)\s*\{[^}]*\b(?:bucket|file|save|delete|setMetadata)\b[^}]*\}\s*=\s*(?:storage|bucket|file)\b/,
    // Computed access is not part of the reviewed static API boundary.
    /\b(?:getStorage\s*\([^)]*\)|storage|bucket|file)\s*\[/,
  ];
  return patterns.some(pattern => pattern.test(source));
}

function inspectServerAdapter(source) {
  const violations = [];
  const add = message => violations.push('server.ts: ' + message);
  const counts = {
    getStorage: countMatches(source, /\bgetStorage\s*\(/g),
    bucket: countMatches(source, /\bstorage\s*\.\s*bucket\s*\(/g),
    file: countMatches(source, /\bbucket\s*\.\s*file\s*\(/g),
    getMetadata: countMatches(source, /\bfile\s*\.\s*getMetadata\s*\(/g),
    setMetadata: countMatches(source, /\bfile\s*\.\s*setMetadata\s*\(/g),
  };
  if (counts.getStorage !== 1 || counts.bucket !== 2 || counts.file !== 1
    || counts.getMetadata !== 1 || counts.setMetadata !== 1) {
    add('Storage adapter call counts differ from the single reviewed preservation-hold adapter');
  }
  if (!hasOrdered(source, [
    'createVerificationDeletionHoldRouter({',
    'getBucket: bucketName => {',
    'const storage = getStorage();',
    'const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();',
    'file: path => {',
    'const file = bucket.file(path);',
    'getMetadata: () => file.getMetadata(),',
    'setMetadata: (metadata, options) => file.setMetadata(metadata, options as never),',
  ])) {
    add('the exact getStorage/bucket.file/getMetadata/setMetadata adapter for the hold router is missing or altered');
  }

  const mutationCalls = countMatches(source, /\.(?:save|delete|deleteFiles|setMetadata|createWriteStream|copy|move|rename|upload|makePublic|makePrivate)\s*\(/g);
  if (mutationCalls !== 1 || counts.setMetadata !== 1) {
    add('unregistered Storage write/delete/metadata mutation detected; only the single allowlisted file.setMetadata adapter is permitted');
  }
  // Remove only the exact, reviewed adapter body before alias analysis. The
  // adapter's method calls are intentional; scanning its receiver tokens as
  // standalone aliases falsely classified "bucket.file(...)" as "bucket".
  // Mask only the seven exact statements in the reviewed adapter. Matching
  // individual statements keeps the source fixture small while the ordered
  // sequence + unique occurrence checks bind them to the single hold adapter.
  const allowlistedAdapterLines = [
    'getBucket: bucketName => {',
    'const storage = getStorage();',
    'const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();',
    'file: path => {',
    'const file = bucket.file(path);',
    'getMetadata: () => file.getMetadata(),',
    'setMetadata: (metadata, options) => file.setMetadata(metadata, options as never),',
  ];
  const sourceLines = source.split(/\r?\n/);
  const adapterLineCounts = allowlistedAdapterLines.map(line =>
    sourceLines.filter(sourceLine => sourceLine.trim() === line).length);
  if (adapterLineCounts.some(count => count !== 1)
    || !hasOrdered(source, allowlistedAdapterLines)) {
    add('the exact reviewed Preservation-Hold Storage adapter call sequence must occur exactly once');
  }
  const allowlistedLineSet = new Set(allowlistedAdapterLines);
  const aliasScanSource = sourceLines
    .filter(sourceLine => !allowlistedLineSet.has(sourceLine.trim()))
    .join('\n');
  if (hasStorageAlias(aliasScanSource)) {
    add('aliased Storage factory or method reference (including destructuring/computed bracket access) is not permitted outside the exact allowlisted adapter');
  }
  if (/\b(?:storage|bucket|file)\s*\.\s*(?:getFiles|deleteFiles|save|delete|createWriteStream|copy|move|rename|upload|makePublic|makePrivate)\b/.test(source)) {
    add('unregistered Storage API reference detected in server.ts');
  }
  return violations;
}

function inspectVerificationWriterBoundary(sourceFiles) {
  const sources = new Map(sourceFiles);
  const violations = [];
  const add = message => violations.push(message);

  for (const [file, source] of sources) {
    const storageMutation = /(?:\bgetStorage\s*\(|\.bucket\s*\(|\.file\s*\()/.test(source) && MUTATION.test(source);
    if (storageMutation && file !== SERVER_ADAPTER && !ALLOWED_MUTATION_FILES.has(file)) {
      add(file + ': unregistered Storage mutation path; bind it to the canonical Writer-Intent / Finalize / Fence contract');
    }
    if (file !== SERVER_ADAPTER && hasStorageAlias(source)) {
      add(file + ': aliased Storage bucket/file/mutation method reference is not supported; review and register explicitly');
    }
  }

  const server = sources.get(SERVER_ADAPTER);
  if (typeof server !== 'string') {
    add('server.ts: top-level production server adapter was not supplied to the scanner');
  } else {
    violations.push(...inspectServerAdapter(server));
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
  const files = [...walk(root, 'src/server'), ...walk(root, 'functions/src'), SERVER_ADAPTER];
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