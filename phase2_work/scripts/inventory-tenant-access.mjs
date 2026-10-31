#!/usr/bin/env node
/**
 * Read-only, deterministic source inventory for P0 #254.
 * This is a candidate finder, NOT a complete authorization or Art.-17 audit.
 * No cloud API calls, secrets, file content or document data are emitted.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.firebase', 'test-results', 'playwright-report']);
const sourceTypes = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const checks = [
  ['admin_firestore', /\b(?:getFirestore|getDb|admin\.firestore|firebase-admin\/firestore)\b/],
  ['firestore_client', /\b(?:collection|collectionGroup|doc|getDoc|getDocs|onSnapshot|query|runTransaction|writeBatch)\s*\(/],
  ['storage_access', /\b(?:getStorage|ref|getDownloadURL|uploadBytes|deleteObject|bucket)\s*\(/],
  ['user_sensitive_path', /(?:users|chats|messages|subscriptions|verification_events|referrals|payments|tenants)\s*\//],
  ['database_mutation', /\b(?:setDoc|addDoc|updateDoc|deleteDoc|create|update|delete)\s*\(/],
];
const rows = [];
const fail = message => { throw new Error('inventory_failed: ' + message); };
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.isSymbolicLink()) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) walk(full);
      continue;
    }
    if (!entry.isFile() || !sourceTypes.has(extname(entry.name))) continue;
    const data = readFileSync(full, 'utf8');
    const lines = data.split(/\r?\n/);
    const categories = new Set();
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      for (const [category, pattern] of checks) {
        if (pattern.test(lines[i])) {
          categories.add(category);
          hits.push({ line: i + 1, category });
        }
      }
    }
    if (hits.length) rows.push({
      path: relative(root, full).replaceAll('\\', '/'),
      sha256: createHash('sha256').update(data).digest('hex'),
      categories: [...categories].sort(),
      hits,
    });
  }
}
try {
  const sourceDir = join(root, 'src');
  const functionsDir = join(root, 'functions', 'src');
  if (!statSync(sourceDir).isDirectory() || !statSync(functionsDir).isDirectory()) fail('required source roots absent');
  walk(sourceDir);
  walk(functionsDir);
  // The app's root Express entrypoint contains live routes and must not be omitted.
  const entrypoint = join(root, 'server.ts');
  if (!statSync(entrypoint).isFile()) fail('server.ts entrypoint absent');
  const entryData = readFileSync(entrypoint, 'utf8');
  const entryHits = [];
  const entryCategories = new Set();
  entryData.split(/\r?\n/).forEach((line, i) => {
    for (const [category, pattern] of checks) {
      if (pattern.test(line)) {
        entryCategories.add(category);
        entryHits.push({ line: i + 1, category });
      }
    }
  });
  rows.push({
    path: 'server.ts',
    sha256: createHash('sha256').update(entryData).digest('hex'),
    categories: [...entryCategories].sort(),
    hits: entryHits,
  });
  rows.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  process.stdout.write(JSON.stringify({
    schema_version: 1,
    scope: ['src', 'functions/src', 'server.ts'],
    note: 'Static candidate inventory only: dynamic paths, imports, rules, hidden dependencies and data ownership require independent review.',
    files: rows,
  }, null, 2) + '\n');
} catch (err) {
  process.stderr.write(String(err instanceof Error ? err.message : err) + '\n');
  process.exitCode = 1;
}
