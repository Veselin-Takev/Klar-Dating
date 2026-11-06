#!/usr/bin/env node
/**
 * VES-5: lexical inventory of the verified legacy biometric Storage paths and
 * Admin-SDK file.delete invocations in runtime server/Functions sources.
 *
 * This guards source drift; NOT a proof of IAM, external writers, Firestore/GCS
 * atomicity, dynamic path construction, nor a grant of production approval.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readVerificationEventSourceMap } from './check-verification-event-writers.mjs';

const expected = new Map([
  ['src/server/platform/verificationPurgeFirestoreFence.ts', {
    // Owner-path validation only; this helper does NOT touch Cloud Storage.
    // Owner prefix is checked twice: startsWith and non-empty suffix length.
    paths: 2, deletes: 0,
    signature: /data\.storagePath\.startsWith\('verification\/' \+ data\.uid/,
    second: /tx\.update\(ref, \{ photoPurgeFence: next, photoPurgeIntent: intent \}\)/,
    third: /!isVerificationArtifactExpired\(decidedAt, now\)/,
    fourth: /permitId: next\.permitId, fenceEpoch: next\.epoch/,
    fifth: /assertNoPriorPurgeIntent\(data\)/,
    sixth: /data\.photoPurged !== false/,
    seventh: /Object\.prototype\.hasOwnProperty\.call\(data, 'photoPurgeIntent'\)/,
    decisionHoldGuardCalls: 2,
  }],
  ['src/server/klarCore.ts', {
    paths: 2, deletes: 0,
    signature: /pfad\.startsWith\(\`verification\/\$\{meine\}\//,
  }],
  ['src/server/routes/complianceStorage.ts', {
    paths: 1, deletes: 1,
    signature: /await file\.delete\(\{ ifGenerationMatch: generation \}\)/,
    second: /const VERIFICATION_PHOTO_PURGE_P0_LIVE_RELEASE_APPROVED = false;/,
    third: /await beforeDelete\(\)/,
  }],
  ['functions/src/retention.ts', {
    paths: 1, deletes: 1,
    signature: /for \(const prefix of \[\`verification\/\$\{uid\}\//,
    second: /await file\.delete\(\{ ifGenerationMatch: metadata\.generation \}\)/,
    third: /metadata\.temporaryHold \|\| metadata\.eventBasedHold/,
  }],
]);

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}
export function verificationStorageWriterViolations(sources) {
  const problems = [];
  for (const [path, source] of sources) {
    // Only literal object-prefix strings, not descriptions such as
    // '/verification/{uid}', legacy route names or bare prose comments.
    // New dynamic prefixes still require explicit architectural review.
    const paths = count(source, /['"\`]verification\//g);
    const deletes = count(source, /\b(?:file|photo)\.delete\s*\(/g);
    const rule = expected.get(path);
    if (!rule && (paths || deletes)) {
      problems.push('unreviewed verification storage path or delete call: ' + path);
    } else if (rule && (paths !== rule.paths || deletes !== rule.deletes)) {
      problems.push('verification storage writer inventory drift: ' + path
        + ' (paths=' + paths + ', deletes=' + deletes + ')');
    } else if (rule && (!rule.signature.test(source)
        || (rule.second && !rule.second.test(source))
        || (rule.third && !rule.third.test(source))
        || (rule.fourth && !rule.fourth.test(source))
        || (rule.fifth && !rule.fifth.test(source))
        || (rule.sixth && !rule.sixth.test(source))
        || (rule.seventh && !rule.seventh.test(source))
        || (rule.decisionHoldGuardCalls && count(source,
          /assertWriterHasNoUnreconciledPurgeState\(data\);/g)
            !== rule.decisionHoldGuardCalls))) {
      problems.push('verification storage boundary signature drift: ' + path);
    }
  }
  for (const path of expected.keys()) {
    if (!sources.has(path)) problems.push('missing reviewed verification storage source: ' + path);
  }
  // Art.17 deletion is a distinct authorized Storage writer; a single import
  // must remain the owner of its explicit legacy photo cleanup call.
  const erasure = sources.get('src/server/trustAndSafety.ts');
  if (!erasure || !erasure.includes('await deleteAccountPhotos(getAppBucket(), meineUid)')
      || !erasure.includes("db.collection('verification_events').where('uid', '==', meineUid)")) {
    problems.push('Art17 owner/storage-delete coordination drift');
  }
  return problems;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const violations = verificationStorageWriterViolations(readVerificationEventSourceMap());
  if (violations.length) {
    console.error('Verification Storage writer inventory FAILED:\n' + violations.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Verification Storage writer inventory PASS (static-only; P0 Firestore/GCS race remains open)');
  }
}
