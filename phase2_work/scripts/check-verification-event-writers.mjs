#!/usr/bin/env node
/**
 * P0 #202: source-only inventory of literal verification_events references.
 * Fail closed when a new quoted collection-path literal appears without review.\n * Bare prose comments are not Firestore accesses; dynamically assembled paths\n * remain outside this lexical guard and require code review.
 * This does NOT establish cross-service atomicity or cover dynamic SDK paths.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = new Map([
  ['src/server/platform/verificationPurgeFirestoreFence.ts', {
    count: 1,
    signature: /ref\.parent\.id !== 'verification_events'/,
    secondSignature: /db\.runTransaction\(async tx =>/,
  }],
  ['src/server/klarCore.ts', {
    count: 1,
    signature: /tx\.create\(firestore\.collection\('verification_events'\)\.doc\(\)/,
    secondSignature: /photoPurgeFence:\s*initialVerificationEventFence\(/,
  }],
  ['src/server/datenschutz.ts', {
    count: 1,
    signature: /collection\('verification_events'\)\.where\('uid', '==', meineUid\)\.get\(\)/,
  }],
  ['src/server/trustAndSafety.ts', {
    count: 1,
    signature: /loescheAbfrage\(db\.collection\('verification_events'\)\.where\('uid', '==', meineUid\)\)/,
  }],
  ['src/server/routes/complianceStorage.ts', {
    count: 3,
    signature: /tx\.update\(ref,\s*\{\s*photoPurgeIntent:/,
    secondSignature: /tx\.update\(ref,\s*\{\s*\.\.\.auditData,/,
  }],
]);

function listSourceFiles(dir, output = []) {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    const path = dir + '/' + entry.name;
    if (entry.isDirectory()) listSourceFiles(path, output);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) {
      output.push(path);
    }
  }
  return output;
}

export function readVerificationEventSourceMap() {
  const paths = ['server.ts', ...listSourceFiles('src/server'), ...listSourceFiles('functions/src')];
  return new Map(paths.map(path => [path, readFileSync(resolve(root, path), 'utf8')]));
}

export function verificationEventWriterViolations(files) {
  const issues = [];
  for (const [path, source] of files) {
    const occurrences = [...source.matchAll(/['"`]verification_events(?:\/[^'"`]*?)?['"`]/g)].length;
    const rule = expected.get(path);
    if (!rule && occurrences) {
      issues.push('unreviewed verification_events reference: ' + path);
    } else if (rule && occurrences !== rule.count) {
      issues.push('verification_events reference count drift: ' + path + ' (' + occurrences + ' vs ' + rule.count + ')');
    } else if (rule && (!rule.signature.test(source) || (rule.secondSignature && !rule.secondSignature.test(source)))) {
      issues.push('verification_events authorized operation drift: ' + path);
    }
  }
  for (const path of expected.keys()) {
    if (!files.has(path)) issues.push('missing verification_events reviewed source: ' + path);
  }
  return issues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = verificationEventWriterViolations(readVerificationEventSourceMap());
  if (problems.length) {
    console.error('verification event writer inventory FAILED:\n' + problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('verification event literal writer inventory PASS (static only; no cross-service fencing proof)');
  }
}
