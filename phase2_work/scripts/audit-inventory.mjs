import ts from 'typescript';
import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const walk = dir => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap(e => ['node_modules', 'lib', 'api'].includes(e.name) && !dir.startsWith('src') ? [] : e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.[cm]?[jt]sx?$/.test(e.name) ? [`${dir}/${e.name}`] : []) : [];
const files = [...new Set(['server.ts', ...walk('src'), ...walk('tests'), ...walk('app'), ...walk('functions/src')])].sort();
const data = new Map();
const resolve = (from, spec) => {
  if (!spec.startsWith('.')) return null;
  const p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)).replace(/\.js$/, '');
  return [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`, `${p}/index.tsx`].find(p => files.includes(p)) ?? null;
};
const literal = node => node && ts.isStringLiteralLike(node) ? node.text : null;
const unwrap = node => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) ? unwrap(node.expression) : node;
for (const file of files) {
  const text = readFileSync(file, 'utf8'); const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const entry = { file, lines: text.split('\n').length, test: /(?:^tests\/|\.(?:spec|test)\.)/.test(file), imports: [], routes: [], mounts: [], uiRoutes: [], text };
  const bindings = new Map();
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && !node.isTypeOnly && !node.importClause?.isTypeOnly) {
      const target = resolve(file, literal(node.moduleSpecifier) ?? '');
      if (target) {
        entry.imports.push(target);
        if (node.importClause?.name) bindings.set(node.importClause.name.text, target);
        const named = node.importClause?.namedBindings;
        if (named && ts.isNamedImports(named)) for (const element of named.elements) bindings.set(element.name.text, target);
      }
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) { const target = resolve(file, literal(node.arguments[0]) ?? ''); if (target) entry.imports.push(target); }
      const expression = unwrap(node.expression);
      if (ts.isPropertyAccessExpression(expression)) {
        const owner = expression.expression.getText(ast), method = expression.name.text, route = literal(node.arguments[0]);
        if (['app', 'router', 'verificationRouter'].includes(owner) && route !== null) {
          if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) entry.routes.push({ method: method.toUpperCase(), path: route, line: ast.getLineAndCharacterOfPosition(node.getStart()).line + 1, owner });
          if (method === 'use') for (const arg of node.arguments.slice(1)) {
            const name = ts.isCallExpression(arg) ? arg.expression.getText(ast) : arg.getText(ast);
            if (bindings.has(name)) entry.mounts.push({ prefix: route, file: bindings.get(name) });
          }
        }
      }
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(ast) === 'Route') {
      const attr = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === 'path');
      if (attr && ts.isJsxAttribute(attr) && literal(attr.initializer)) entry.uiRoutes.push(literal(attr.initializer));
    }
    ts.forEachChild(node, visit);
  };
  visit(ast); data.set(file, entry);
}
const reachable = new Set();
function follow(file) { if (reachable.has(file) || !data.has(file)) return; reachable.add(file); data.get(file).imports.forEach(follow); }
['src/main.tsx', 'server.ts', 'functions/src/index.ts'].forEach(follow);
const tests = [...data.values()].filter(e => e.test);
const modules = [...data.values()].filter(e => !e.test).map(e => ({ file: e.file, lines: e.lines, reachableFromEntrypoint: reachable.has(e.file), directTestImports: tests.filter(t => t.imports.includes(e.file)).map(t => t.file) }));
const apiRoutes = [];
for (const e of data.values()) {
  if (e.test) continue;
  for (const r of e.routes) {
    const mounts = r.owner === 'app' ? [{ prefix: '' }] : [...data.values()].filter(x => !x.test).flatMap(x => x.mounts.filter(m => m.file === e.file));
    for (const mount of mounts) {
      const fullPath = `${mount.prefix}${r.path === '/' ? '' : r.path}` || '/';
      apiRoutes.push({ method: r.method, path: fullPath, source: e.file, line: r.line, literalTestReferences: tests.filter(t => t.text.includes(fullPath)).map(t => t.file) });
    }
  }
}
const output = { schemaVersion: 1, warning: 'Static reachability and literal references are not runtime coverage or proof of correctness.', summary: { modules: modules.length, componentModules: modules.filter(m => m.file.startsWith('src/components/')).length, testFiles: tests.length, apiRoutes: apiRoutes.length, modulesWithDirectTestImport: modules.filter(m => m.directTestImports.length).length }, uiRoutes: [...new Set([...data.values()].flatMap(e => e.uiRoutes))].sort(), modules, apiRoutes };
mkdirSync('docs/evidence', { recursive: true });
writeFileSync('docs/evidence/component-inventory.json', JSON.stringify(output, null, 2) + '\n');
const csv = value => `"${String(value).replaceAll('"', '""')}"`;
writeFileSync('docs/evidence/component-inventory.csv', ['file,lines,reachableFromEntrypoint,directTestImports', ...modules.map(m => [m.file, m.lines, m.reachableFromEntrypoint, m.directTestImports.join(';')].map(csv).join(','))].join('\n') + '\n');
console.log(JSON.stringify(output.summary));
