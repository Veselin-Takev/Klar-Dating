#!/usr/bin/env node
// Prüft direkte Gemini-Aufrufe in Express-Handlern gegen die Ersatzmatrix.
// Ein AST erkennt auch TypeScript-Casts und ignoriert Kommentare/Zeichenketten.
// Indirekte Aufrufe über Worker benötigen weiterhin einen separaten Review.
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function parse(path) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  if (source.parseDiagnostics.length) throw new Error(`Syntaxfehler in ${path}`);
  return source;
}

function visit(node, predicate) {
  if (predicate(node)) return true;
  return ts.forEachChild(node, child => visit(child, predicate)) === true;
}

const source = parse('server.ts');
const policy = parse('src/server/kiPolitik.ts');
const known = new Set();
visit(policy, node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(policy) === 'STRATEGIE' &&
      node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    for (const property of node.initializer.properties) {
      if (property.name && ts.isStringLiteral(property.name)) known.add(property.name.text);
    }
  }
  return false;
});

const endpoints = new Set();
visit(source, node => {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const receiver = node.expression;
  if (receiver.expression.getText(source) !== 'app' ||
      !['get', 'post', 'put', 'patch', 'delete'].includes(receiver.name.text)) return false;
  const [path, ...handlers] = node.arguments;
  if (!path || !ts.isStringLiteralLike(path) || !path.text.startsWith('/api/')) return false;
  const callsModel = handlers.some(handler => visit(handler, child =>
    ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) &&
    child.expression.name.text === 'generateContent' &&
    /\bai\.models\b/.test(child.expression.expression.getText(source))));
  if (callsModel) endpoints.add(path.text);
  return false;
});

if (!endpoints.size || !known.size) {
  console.error('KI-Prüfung ohne Prüfgegenstand: Modellrouten oder Ersatzmatrix fehlen.');
  process.exit(1);
}
const missing = [...endpoints].filter(path => !known.has(path));
if (missing.length) {
  console.error(`KI-Endpunkte OHNE Ersatzstrategie:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`KI-Ersatz: alle ${endpoints.size} Endpunkte mit direktem Modellaufruf haben eine Strategie.`);
