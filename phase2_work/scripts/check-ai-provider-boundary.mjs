import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowlisted = new Set(['src/server/aiBudget.ts']);
const scanRoots = ['src', 'functions', 'server.ts'];
const files = [];

function walk(target) {
  const absolute = path.join(root, target);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    if (/\.(ts|tsx|mts|cts)$/.test(absolute)) files.push(path.relative(root, absolute));
    return;
  }
  for (const entry of fs.readdirSync(absolute)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'lib') continue;
    walk(path.join(target, entry));
  }
}
for (const target of scanRoots) walk(target);

const failures = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (/new\s+GoogleGenAI\s*\(/.test(source) && !allowlisted.has(file)) {
    failures.push(`${file}: direct GoogleGenAI construction must stay behind src/server/aiBudget.ts`);
  }
}

for (const file of ['src/server/translation.ts', 'src/services/geminiCacheService.ts']) {
  if (fs.existsSync(path.join(root, file))) failures.push(`${file}: retired legacy AI provider module still exists`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('AI provider boundary: PASS');
