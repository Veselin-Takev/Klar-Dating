import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding:'utf8'}).trim();
const files = execFileSync('git', ['ls-files', '-z'], {cwd:root, encoding:'utf8'}).split('\0').filter(path =>
  /^(phase2_work\/src\/server\/|phase2_work\/functions\/src\/|phase2_work\/server\.ts)/.test(path)
  && /\.ts$/.test(path) && !/\.(test|spec)\.ts$/.test(path));
const legacy = {};
for (const path of files) {
  if (path.endsWith('/TenantAwareFirestoreRepository.ts')) continue;
  const source = readFileSync(root + '/' + path, 'utf8');
  if (/\.collection(?:Group)?\s*\(|\.doc\s*\(|\bgetFirestore\s*\(|\bgetDb\s*\(/.test(source)) {
    legacy[path] = createHash('sha256').update(source).digest('hex');
  }
}
const manifest = root + '/phase2_work/docs/security/LEGACY_ADMIN_ACCESS.json';
if (process.argv.includes('--inventory')) {
  writeFileSync(manifest, JSON.stringify({scope:'Unmigrated legacy access; not approved tenant isolation',files:legacy},null,2)+'\n');
} else {
  const expected = JSON.parse(readFileSync(manifest,'utf8')).files;
  if (JSON.stringify(legacy) !== JSON.stringify(expected)) throw new Error('Admin SDK legacy source drift: explicit migration/security review required');
  console.log(`Legacy Admin SDK drift guard PASS; ${Object.keys(legacy).length} files still require migration. This is NOT tenant certification.`);
}
if (process.argv.includes('--certify') && Object.keys(legacy).length) {
  console.error('BLOCKED: unscoped Admin SDK consumers remain');
  process.exitCode = 1;
}
