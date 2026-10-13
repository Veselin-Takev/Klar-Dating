#!/usr/bin/env node
/**
 * Focused TypeScript diagnostics. This is a developer aid, NOT a substitute
 * for npm run typecheck: transitive modules are parsed/typechecked but only
 * diagnostics in explicitly selected source files are counted for this gate.
 */
import ts from 'typescript';
import path from 'node:path';
import process from 'node:process';

const groups = Object.freeze({
  transactions: [
    'src/server/platform/ageGateEngine.ts',
    'src/server/platform/consentEngine.ts',
    'src/server/routes/chat.ts',
    'src/server/routes/launch.ts',
  ],
  boundaries: [
    'src/server/platform/auditComplianceExport.ts',
    'src/server/platform/productionControls.ts',
    'src/server/platform/contactEngine.ts',
  ],
});

const group = process.argv[2];
if (!Object.hasOwn(groups, group)) {
  console.error('Usage: node scripts/typecheck-focused.mjs <transactions|boundaries>');
  process.exit(2);
}
const cwd = process.cwd();
const configFile = ts.findConfigFile(cwd, ts.sys.fileExists, 'tsconfig.json');
if (!configFile) {
  console.error('tsconfig.json not found');
  process.exit(2);
}
const read = ts.readConfigFile(configFile, ts.sys.readFile);
if (read.error) {
  console.error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'));
  process.exit(2);
}
const config = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(configFile));
if (config.errors.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(config.errors, {
    getCanonicalFileName: value => value, getCurrentDirectory: () => cwd, getNewLine: () => '\n',
  }));
  process.exit(2);
}
const selected = groups[group].map(filename => path.resolve(cwd, filename));
const selectedSet = new Set(selected.map(filename => path.normalize(filename)));
for (const filename of selected) {
  if (!ts.sys.fileExists(filename)) {
    console.error(`Missing selected module: ${path.relative(cwd, filename)}`);
    process.exit(2);
  }
}
const program = ts.createProgram({
  rootNames: selected,
  options: { ...config.options, noEmit: true },
});
const diagnostics = ts.getPreEmitDiagnostics(program);
const relevant = diagnostics.filter(diagnostic =>
  !diagnostic.file || selectedSet.has(path.normalize(diagnostic.file.fileName)),
);
const externalCount = diagnostics.length - relevant.length;
const host = {
  getCanonicalFileName: filename => filename,
  getCurrentDirectory: () => cwd,
  getNewLine: () => '\n',
};
if (relevant.length) console.error(ts.formatDiagnosticsWithColorAndContext(relevant, host));
console.log(`Focused TypeScript [${group}]: ${relevant.length} selected/global diagnostic(s) in ${selected.length} modules; ${externalCount} transitive diagnostic(s) excluded from focused result.`);
console.log('NOTE: A focused PASS does not mean global typecheck, build or release PASS.');
process.exit(relevant.length ? 1 : 0);
