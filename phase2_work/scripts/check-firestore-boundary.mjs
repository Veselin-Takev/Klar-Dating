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

function importsNativeGetFirestore(source) {
  // Type-only Firestore imports are permitted; they do not create an SDK access path.
  const directValueImport = /import\s*(?!type\b)\{[^}]*\bgetFirestore\b[^}]*\}\s*from\s*['"]firebase-admin\/firestore['"]/s;
  const namespaceImport = /import\s*(?!type\b)\*\s+as\s+\w+\s+from\s*['"]firebase-admin\/firestore['"]/;
  const defaultImport = /import\s*(?!type\b)\w+(?:\s*,\s*\{[^}]*\})?\s+from\s*['"]firebase-admin\/firestore['"]/;
  const nativeGetterCall = /\bgetFirestore\s*\(/;
  return (directValueImport.test(source) && nativeGetterCall.test(source))
    || (namespaceImport.test(source) && /\.getFirestore\s*\(/.test(source))
    || (defaultImport.test(source) && nativeGetterCall.test(source));
}

for (const file of roots.flatMap(filesUnder)) {
  if (path.resolve(file) === allowed) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (importsNativeGetFirestore(source)) violations.push(path.relative(process.cwd(), file));
}

if (violations.length) {
  throw new Error(
    'Firestore boundary failed: native Firebase Admin getFirestore access is only allowed in src/server/db.ts. Violations:\n' + violations.join('\n'),
  );
}

console.log('Firestore boundary: PASS');
