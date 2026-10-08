import fs from 'node:fs';
import path from 'node:path';

const roots = ['src'];
const failures = [];
const files = [];
function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) { files.push(target); return; }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
    walk(path.join(target, entry.name));
  }
}
for (const root of roots) walk(root);
for (const file of files) {
  if (file.includes(`${path.sep}server${path.sep}`) || file.endsWith('userScopedStorage.ts')) continue;
  if (/\.(test|spec)\.(ts|tsx)$/.test(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (/(?:window\.)?localStorage\b/.test(source)) {
    failures.push(`${file}: direct localStorage access bypasses the UID-scoped storage boundary`);
  }
  if (/localStorage\.clear\s*\(/.test(source)) {
    failures.push(`${file}: localStorage.clear() is forbidden because it can erase unrelated account/app state`);
  }
  if (/klarStorage\.clear\s*\(/.test(source)) {
    failures.push(`${file}: klarStorage.clear() is forbidden; cleanup must name the authenticated UID explicitly`);
  }
}
const utility = fs.readFileSync('src/lib/userScopedStorage.ts', 'utf8');
for (const required of ['klar:user:${uid}:', 'GLOBAL_KEYS', 'clearUserStorageForUid']) {
  if (!utility.includes(required)) failures.push(`src/lib/userScopedStorage.ts: missing required boundary invariant ${required}`);
}
if (failures.length) {
  console.error('User storage boundary gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('User storage boundary gate PASS: runtime browser state uses the centralized UID-scoped boundary; logout never clears the entire origin.');
