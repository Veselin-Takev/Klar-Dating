import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = ['server.ts', 'src/core/auth/authMiddleware.ts'];
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (text.includes('x-firebase-token')) throw new Error(`${file}: legacy x-firebase-token credential path must remain removed`);
  if (!text.includes('/^Bearer\\s+[^\\s]+$/')) throw new Error(`${file}: strict Bearer credential grammar missing`);
}
const health = fs.readFileSync(path.join(root, 'src/server/routes/health.ts'), 'utf8');
if (!health.includes("timingSafeEqual")) throw new Error('metrics token comparison must be constant-time');
if (!health.includes('configuredBytes.length === suppliedBytes.length')) throw new Error('metrics token length must be checked before timingSafeEqual');
console.log('PASS: auth credential boundary uses strict Authorization Bearer only and constant-time metrics token comparison.');
