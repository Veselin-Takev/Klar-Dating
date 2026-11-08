import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, join } from 'node:path';
import ts from 'typescript';
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();
const infrastructure = [
  'phase2_work/functions/src/firestoreRepository/TenantAwareFirestoreRepository.ts',
  'phase2_work/functions/src/firestoreRepository/nativeDatabase.ts',
  'phase2_work/src/server/firestoreRepository/nativeDatabase.ts',
  'phase2_work/src/server/db.ts',
];
const reviewedPath = join(
  root,
  'phase2_work/docs/security/ADMIN_INFRASTRUCTURE.json',
);
const reviewed = existsSync(reviewedPath)
  ? JSON.parse(readFileSync(reviewedPath, 'utf8')).files
  : {};
function walk(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory()
      ? walk(child)
      : /\.(?:ts|tsx|mjs|js)$/.test(child)
        ? [relative(root, child)]
        : [];
  });
}
// Walk the working tree, including untracked application source. Never recurse vendor output.
const files = [
  ...walk(join(root, 'phase2_work/src')),
  ...walk(join(root, 'phase2_work/functions/src')),
  ...walk(join(root, 'phase2_work/scripts')),
  'phase2_work/server.ts',
].filter(
  (path) =>
    existsSync(join(root, path)) &&
    !path.includes('/vendor/') &&
    !/\.(test|spec)\.[^.]+$/.test(path),
);
const legacy = {},
  violations = [];
const digest = (source) => createHash('sha256').update(source).digest('hex');
const forbidden = new Set([
  'getDb',
  'getEmulatorDatabase',
  'nativeDatabase',
  'getFirestore',
  'firestore',
  'Firestore',
  'LocalRepositoryStore',
]);
for (const path of files) {
  const source = readFileSync(join(root, path), 'utf8');
  if (infrastructure.includes(path)) {
    if (reviewed[path] !== digest(source))
      violations.push(path + ': reviewed infrastructure source drift');
    continue;
  }
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const isApp = !path.startsWith('phase2_work/scripts/');
  let bad = false;
  function visit(node) {
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) bad = true;

    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const module =
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
          ? node.moduleSpecifier.text
          : '';
      const clause = ts.isImportDeclaration(node)
        ? node.importClause
        : node.exportClause;
      if (
        module === 'firebase-admin' ||
        module === 'firebase-admin/firestore' ||
        /(?:^|\/)(?:db|nativeDatabase|localStore)(?:\.[cm]?[jt]s)?$/.test(
          module,
        )
      ) {
        if (!clause || (ts.isImportDeclaration(node) && clause.name)) bad = true;
        if (clause && !(ts.isImportDeclaration(node) && clause.isTypeOnly)) {
          const bindings = ts.isImportDeclaration(node)
            ? clause.namedBindings
            : clause;
          if (!bindings || ts.isNamespaceImport(bindings)) bad = true;
          else if (ts.isNamedImports(bindings) || ts.isNamedExports(bindings))
            for (const element of bindings.elements) {
              const imported = (element.propertyName ?? element.name).text;
              const localFacade =
                /src\/server\/(durableStore|inMemoryStore)\.ts$/.test(path) &&
                module.endsWith('/localStore');
              if (
                !element.isTypeOnly &&
                forbidden.has(imported) &&
                !localFacade
              )
                bad = true;
            }
        }
      }
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const name = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : ts.isElementAccessExpression(expression) &&
            expression.argumentExpression &&
            ts.isStringLiteral(expression.argumentExpression)
          ? expression.argumentExpression.text
          : ts.isIdentifier(expression)
            ? expression.text
            : '';
      if (
        (path.startsWith('phase2_work/src/server/') ||
          path.startsWith('phase2_work/src/core/') ||
          path.startsWith('phase2_work/functions/') ||
          path.startsWith('phase2_work/scripts/') ||
          path === 'phase2_work/server.ts') &&
        [
          'collection',
          'collectionGroup',
          'doc',
          'getFirestore',
          'getDb',
          'firestore',
          'getEmulatorDatabase',
        ].includes(name)
      )
        bad = true;
      if (
        (expression.kind === ts.SyntaxKind.ImportKeyword ||
          name === 'require') &&
        node.arguments.some(
          (arg) =>
            ts.isStringLiteral(arg) &&
            /^(?:firebase-admin|firebase-admin\/firestore)$|(?:^|\/)(?:db|nativeDatabase|localStore)(?:\.[cm]?[jt]s)?$/.test(
              arg.text,
            ),
        )
      )
        bad = true;
      // Computed/dynamic SDK imports cannot bypass the named-import boundary.
      if (
        isApp &&
        (expression.kind === ts.SyntaxKind.ImportKeyword ||
          name === 'require') &&
        node.arguments.some((arg) => !ts.isStringLiteral(arg))
      )
        bad = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (bad) legacy[path] = digest(source);
}
if (process.argv.includes('--review-infrastructure')) {
  const hashes = Object.fromEntries(
    infrastructure
      .filter((path) => existsSync(join(root, path)))
      .map((path) => [path, digest(readFileSync(join(root, path), 'utf8'))]),
  );
  writeFileSync(
    reviewedPath,
    JSON.stringify(
      {
        scope:
          'Reviewed private SDK constructors, canonical tenant repository and emulator-only fixture facade; no folder-wide exemptions',
        files: hashes,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    'Infrastructure hashes updated; rerun the guard and review this diff.',
  );
  process.exit(0);
}
const manifest = join(
  root,
  'phase2_work/docs/security/LEGACY_ADMIN_ACCESS.json',
);
if (process.argv.includes('--inventory'))
  writeFileSync(
    manifest,
    JSON.stringify(
      {
        scope:
          'Unmigrated application SDK capabilities; infrastructure separately hash-pinned',
        files: legacy,
      },
      null,
      2,
    ) + '\n',
  );
else {
  const expected = JSON.parse(readFileSync(manifest, 'utf8')).files;
  if (JSON.stringify(legacy) !== JSON.stringify(expected))
    violations.push(
      'Admin SDK legacy source drift: explicit migration/security review required',
    );
}
if (violations.length) throw new Error(violations.join('\n'));
if (process.argv.includes('--certify') && Object.keys(legacy).length) {
  console.error('BLOCKED: unscoped Admin SDK consumers remain');
  process.exitCode = 1;
} else
  console.log(
    `Admin SDK boundary guard PASS; ${Object.keys(legacy).length} unscoped application files; ${Object.keys(reviewed).length} reviewed infrastructure modules.`,
  );
