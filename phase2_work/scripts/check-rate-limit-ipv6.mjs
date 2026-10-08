import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

const files = globSync(['src/**/*.ts','src/**/*.tsx','server.ts','functions/src/**/*.ts'], {
  cwd: process.cwd(), nodir: true, ignore: ['node_modules/**','dist/**']
});
const unsafe = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  if (!/rateLimit\s*\(/.test(source)) continue;

  const keyGenerators = [...source.matchAll(/keyGenerator\s*:\s*(?:\([^)]*\)|[^=\n]+)\s*=>\s*([^,\n}]+)/g)];
  for (const match of keyGenerators) {
    const expression = match[1];
    if (/req\.ip/.test(expression) && !/ipKeyGenerator\s*\(\s*req\.ip/.test(expression)) {
      unsafe.push(file);
      break;
    }
  }
}
if (unsafe.length) {
  console.error('IPv6-unsafe rate-limit key generators:', [...new Set(unsafe)].join(', '));
  process.exit(1);
}
console.log('PASS — IPv6-safe rate-limit key generators verified across ' + files.length + ' TypeScript/server files');
