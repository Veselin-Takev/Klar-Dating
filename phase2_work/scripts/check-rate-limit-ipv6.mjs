import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
const files = globSync(['src/**/*.ts','src/**/*.tsx','server.ts','functions/src/**/*.ts'], { cwd: process.cwd(), nodir: true, ignore: ['node_modules/**','dist/**'] });
const bad=[];
for (const file of files) {
  const s=readFileSync(file,'utf8');
  if (!/rateLimit\s*\(/.test(s)) continue;
  const unsafe=[...s.matchAll(/keyGenerator\s*:\s*\([^)]*\)\s*=>[^\n]*req\.ip(?![^\n]*ipKeyGenerator)/g)];
  if (unsafe.length) bad.push(file);
}
if (bad.length) { console.error('IPv6-unsafe rate-limit key generators:', bad.join(', ')); process.exit(1); }
console.log('PASS — ' + files.length + ' TypeScript/server files scanned');
