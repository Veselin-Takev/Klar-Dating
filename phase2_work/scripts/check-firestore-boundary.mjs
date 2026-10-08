import fs from 'node:fs';
import path from 'node:path';

const allowed = path.resolve('src/server/db.ts');
const roots = [path.resolve('src/server'), path.resolve('server.ts')];
const violations = [];

function filesUnder(target) {
  if (target.endsWith('.ts') || target.endsWith('.tsx')) return [target];
  const out = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(child));
    else if (child.endsWith('.ts') || child.endsWith('.tsx')) out.push(child);
  }
  return out;
}

for (const file of roots.flatMap(filesUnder)) {
  if (path.resolve(file) === allowed) continue;
  const source = fs.readFileSync(file, 'utf8');
  const hasNativeFirestoreModule = /['"]firebase-admin\/firestore['"]/.test(source);
  const hasNativeGetter = /\bgetFirestore\b/.test(source);
  if (hasNativeFirestoreModule && hasNativeGetter) {
    violations.push(path.relative(process.cwd(), file));
  }
}

if (violations.length) {
  throw new Error(
    'Firestore boundary failed: native getFirestore access is only allowed in src/server/db.ts. Violations:\n' + violations.join('\n'),
  );
}

console.log('Firestore boundary: PASS');
