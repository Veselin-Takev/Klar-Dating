import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const violations = [];
const adminMountPattern = /app\.use\(\s*['"]\/api\/admin['"]([\s\S]*?)\);/g;
let match;
while ((match = adminMountPattern.exec(source))) {
  const block = match[0];
  if (!/requireAuth\b/.test(block)) violations.push(block.split('\n').slice(0, 6).join('\n'));
  if (!/requireRole\(/.test(block)) violations.push(block.split('\n').slice(0, 6).join('\n'));
}
if (violations.length) {
  console.error('FAIL: /api/admin mount without explicit auth/role boundary');
  for (const violation of violations) console.error(violation);
  process.exit(1);
}
console.log('PASS: /api/admin mounts have explicit requireAuth + requireRole boundaries.');
