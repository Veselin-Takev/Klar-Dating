import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'server.ts'];
const forbidden = [
  /localStorage\.(?:setItem|removeItem)\(\s*['"]klar_auth_token['"]/, 
  /sessionStorage\.(?:setItem|removeItem)\(\s*['"]klar_auth_token['"]/, 
  /localStorage\.getItem\(\s*['"]klar_auth_token['"]/, 
  /sessionStorage\.getItem\(\s*['"]klar_auth_token['"]/, 
];
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
const failures = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const pattern of forbidden) if (pattern.test(source)) failures.push(`${file}: forbidden client token storage/access`);
}
if (failures.length) {
  console.error('Auth token storage gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Auth token storage gate PASS: Firebase session is the sole client credential authority; raw ID tokens are not persisted in web storage.');
