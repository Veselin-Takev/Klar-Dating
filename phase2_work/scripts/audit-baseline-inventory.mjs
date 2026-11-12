/** Read-only structural inventory. Findings are review candidates, not semantic proofs. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.KLAR_AUDIT_TYPESCRIPT || 'typescript');
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const paths = git('ls-files', '-z').split('\0').filter(Boolean).sort();
const files = [], hashes = new Map(), declarations = new Map();
for (const path of paths) {
  const bytes = readFileSync(`${root}/${path}`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const row = { path, bytes: bytes.length, sha256 };
  if (/\.(?:[cm]?[jt]sx?|json|ya?ml|rules)$/.test(path)) {
    const content = bytes.toString('utf8');
    row.todoLines = content.split('\n').flatMap((line, i) => /\b(TODO|FIXME|HACK)\b/.test(line) ? [i + 1] : []);
    row.testFile = /(?:test|spec)\.[cm]?[jt]sx?$/.test(path);
    if (/\.[cm]?[jt]sx?$/.test(path)) {
      const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
      row.explicitAny = []; row.zodImport = false; row.imports = [];
      function visit(node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword) row.explicitAny.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          row.imports.push(node.moduleSpecifier.text);
          if (node.moduleSpecifier.text === 'zod') row.zodImport = true;
        }
        if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
          const name = node.name.text;
          declarations.set(name, [...(declarations.get(name) || []), path]);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    hashes.set(sha256, [...(hashes.get(sha256) || []), path]);
  }
  files.push(row);
}
const summary = {
  trackedFiles: files.length,
  testFiles: files.filter(f => f.testFile).length,
  explicitAnyNodes: files.reduce((n, f) => n + (f.explicitAny?.length || 0), 0),
  activeExplicitAnyNodes: files.filter(f => f.path.startsWith('phase2_work/')).reduce((n, f) => n + (f.explicitAny?.length || 0), 0),
  todoLines: files.reduce((n, f) => n + (f.todoLines?.length || 0), 0),
  zodImportFiles: files.filter(f => f.zodImport).length,
};
const result = { schemaVersion: 1, sourceCommit: git('rev-parse', 'HEAD'), typescriptVersion: ts.version,
  scope: 'All tracked files hashed; JS/TS AST inventory; no reachability, implicit-any or complete runtime validation proof.',
  summary, duplicateContentGroups: [...hashes.values()].filter(g => g.length > 1),
  repeatedTypeNames: [...declarations].filter(([, p]) => p.length > 1).map(([name, paths]) => ({name, paths})), files };
if (!process.argv[2]) throw new Error('Supply output JSON path');
writeFileSync(process.argv[2], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(summary));
