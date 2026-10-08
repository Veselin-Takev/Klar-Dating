import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'server.ts'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const failures = [];

function filesUnder(target) {
  if (!fs.existsSync(target)) return [];
  const stat = fs.statSync(target);
  if (stat.isFile()) return [target];
  const result = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) result.push(...filesUnder(full));
    else if (extensions.has(path.extname(entry.name))) result.push(full);
  }
  return result;
}

for (const file of roots.flatMap(filesUnder)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/^\s*\/\/\s*@ts-(ignore|expect-error)\b/.test(line) || /^\s*\/\*\s*@ts-(ignore|expect-error)\b/.test(line)) {
      failures.push(`${file}:${index + 1}: @ts-ignore/@ts-expect-error is not permitted.`);
    }
  });

  const header = lines.slice(0, 5).join('\n');
  if (/^\s*\/\/\s*@ts-nocheck\b/m.test(header) || /^\s*\/\*\s*@ts-nocheck\b/m.test(header)) {
    failures.push(`${file}: @ts-nocheck is not permitted.`);
  }
}

if (failures.length) {
  console.error(`TypeScript suppression gate FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('TypeScript suppression gate PASS: no executable @ts-ignore, @ts-expect-error or @ts-nocheck directives detected.');
