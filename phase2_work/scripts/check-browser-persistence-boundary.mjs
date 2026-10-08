import fs from 'node:fs';
import path from 'node:path';

const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(file);
  }
}
walk('src');
const failures = [];
for (const file of files) {
  if (/\.(test|spec)\.(ts|tsx)$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (file !== path.join('src', 'lib', 'userScopedStorage.ts') && /sessionStorage\.(clear|getItem|setItem|removeItem)\s*\(/.test(source)) {
    failures.push(`${file}: direct sessionStorage access bypasses the centralized persistence boundary`);
  }
  if (/indexedDB\.deleteDatabase\s*\(\s*['"]klar_offline_queue_db['"]/.test(source)) {
    failures.push(`${rel}: whole offline queue database deletion is forbidden; cleanup must remain UID-scoped`);
  }
  if (/indexedDB\.deleteDatabase\s*\(\s*['"]klar-offline-db['"]/.test(source)) {
    failures.push(`${rel}: legacy offline database deletion is forbidden during user logout`);
  }
  if (/deleteObjectStore\s*\(\s*['"]pending_writes['"]/.test(source)) {
    failures.push(`${file}: offline queue migration must not destructively delete pending writes`);
  }
}
const storage = fs.readFileSync('src/lib/userScopedStorage.ts', 'utf8');
for (const required of ['klar_deletion_receipt', 'clearSessionStorageForApp', 'SESSION_KEYS']) {
  if (!storage.includes(required)) failures.push(`src/lib/userScopedStorage.ts: missing persistence invariant ${required}`);
}
const queue = fs.readFileSync('src/lib/offlineQueue.ts', 'utf8');
if (!queue.includes('indexedDB.open(DB_NAME, 3)')) failures.push('offlineQueue.ts: expected non-destructive schema version 3');
if (queue.includes('objectStore(STORE_NAME).clear()')) failures.push('offlineQueue.ts: global queue clear is forbidden');
if (queue.includes('db.deleteObjectStore(STORE_NAME)')) failures.push('offlineQueue.ts: destructive store migration is forbidden');
if (!queue.includes('createIndex(\"ownerUid\"')) failures.push('offlineQueue.ts: ownerUid index is required for scoped cleanup');
if (!queue.includes('ownerIndex.openCursor(IDBKeyRange.only(ownerUid))')) failures.push('offlineQueue.ts: scoped cleanup must use the ownerUid index cursor');
if (failures.length) {
  console.error('Browser persistence boundary gate FAILED:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Browser persistence boundary gate PASS: session state and offline IndexedDB state are scoped and migrations are non-destructive.');
