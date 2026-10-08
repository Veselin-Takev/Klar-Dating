#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// Prüft: Wird ein Bezeichner benutzt, den es nirgends gibt?
//
// WOZU: Am 10.08.2026 traten SECHS Fehler dieser Form auf — useRef,
// showFilterSheet, showPhotoVerification, setDateCheck, toggleRecording,
// downloadRadarImage. Vier davon legten beim Rendern eine ganze Ansicht
// lahm. Alle sechs lagen in Dateien mit `@ts-nocheck`; der Compiler hätte
// sie in einer Sekunde gefunden, war dort aber abgeschaltet.
//
// Ein siebter — `translateMessage` in ChatView — stürzte NICHT ab, weil ein
// try/catch ihn schluckte. Die Übersetzung schlug dadurch seit jeher
// stillschweigend fehl. Solche Fälle findet kein Durchklicken.
//
// WIE: Echte Syntaxanalyse über den TypeScript-Compiler, nicht Textsuche.
// Kommentare, Zeichenketten und Template-Literale fallen damit prinzipiell
// weg — daran sind an diesem Tag mehrere Textsuchen gescheitert.
// Gültigkeitsbereiche werden nachgebildet, damit ein Name, der in einer
// ANDEREN Funktion derselben Datei deklariert ist, nicht als vorhanden gilt.
//
// GRENZE: Diese Prüfung ersetzt `tsc` nicht. Sie schliesst genau die eine
// Lücke, die `@ts-nocheck` reisst — und sollte überflüssig werden, sobald
// `@ts-nocheck` aus allen Dateien verschwunden ist.
// ═══════════════════════════════════════════════════════════════════════════

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
let ts;
try {
  ts = require('typescript');
} catch {
  console.error('typescript nicht gefunden — bitte `npm install` ausfuehren.');
  process.exit(1);
}

const GLOBALS = new Set(`window document console fetch setTimeout setInterval clearTimeout clearInterval
localStorage sessionStorage navigator alert confirm prompt JSON Math Date Object Array String Number Boolean
Promise Map Set WeakMap WeakSet Error RegExp Intl URL URLSearchParams Blob File FileReader FormData Headers
Request Response AbortController AbortSignal IntersectionObserver MutationObserver ResizeObserver
requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback structuredClone crypto
performance atob btoa encodeURIComponent decodeURIComponent encodeURI decodeURI parseInt parseFloat isNaN
isFinite Symbol BigInt Proxy Reflect queueMicrotask TextEncoder TextDecoder CustomEvent Event EventTarget
Image Audio Notification indexedDB matchMedia getComputedStyle scrollTo open close history location screen
self globalThis process require module exports __dirname __filename
undefined NaN Infinity eval arguments this super
TypeError RangeError SyntaxError EvalError ReferenceError URIError AggregateError
Function Int8Array Uint8Array Uint8ClampedArray Int16Array Uint16Array Int32Array Uint32Array
Float32Array Float64Array BigInt64Array BigUint64Array ArrayBuffer SharedArrayBuffer DataView Atomics
Node NodeList Element HTMLElement HTMLInputElement HTMLCanvasElement HTMLDivElement HTMLFormElement
HTMLTextAreaElement HTMLAudioElement HTMLVideoElement HTMLImageElement HTMLSelectElement HTMLButtonElement
SVGElement Worker ServiceWorker WebSocket XMLHttpRequest EventSource MediaRecorder MediaStream
SpeechSynthesisUtterance speechSynthesis SpeechRecognition webkitSpeechRecognition AudioContext
webkitAudioContext DOMParser XMLSerializer CSS caches Buffer setImmediate Uint8Array
ClipboardItem Clipboard Storage Headers ReadableStream WritableStream TransformStream
PerformanceObserver BroadcastChannel MessageChannel MessagePort Path2D OffscreenCanvas
ImageData Canvas jsPDF html2canvas define global
unescape escape
VisualViewport DeviceOrientationEvent WakeLock`.split(/\s+/).filter(Boolean));

function collectBindingNames(ts, name, out) {
  if (!name) return;
  if (ts.isIdentifier(name)) { out.add(name.text); return; }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const el of name.elements) {
      if (ts.isOmittedExpression(el)) continue;
      collectBindingNames(ts, el.name, out);
    }
  }
}


function isTypeContext(ts, node) {
  let n = node;
  while (n) {
    const p = n.parent;
    if (!p) return false;
    if (ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p)) return true;
    if (ts.isTypeNode(n)) {
      // ExpressionWithTypeArguments in "extends" einer Klasse ist ein Wert
      if (ts.isExpressionWithTypeArguments(n) && p && ts.isHeritageClause(p) &&
          p.token === ts.SyntaxKind.ExtendsKeyword && p.parent && ts.isClassLike(p.parent)) {
        return false;
      }
      return true;
    }
    // Typargumente eines Aufrufs: foo<Bar>()
    if ((ts.isCallExpression(p) || ts.isNewExpression(p) || ts.isTaggedTemplateExpression(p)) &&
        p.typeArguments && p.typeArguments.includes(n)) return true;
    if (ts.isAsExpression(p) && p.type === n) return true;
    if (ts.isSatisfiesExpression && ts.isSatisfiesExpression(p) && p.type === n) return true;
    if (ts.isTypeAssertionExpression && ts.isTypeAssertionExpression(p) && p.type === n) return true;
    if (ts.isVariableDeclaration(p) && p.type === n) return true;
    if (ts.isParameter(p) && p.type === n) return true;
    if (ts.isPropertyDeclaration(p) && p.type === n) return true;
    if (ts.isPropertySignature(p)) return true;
    n = p;
  }
  return false;
}

function isReference(ts, node) {
  if (!ts.isIdentifier(node)) return false;
  const p = node.parent;
  if (!p) return false;

  // Eigenschaftszugriffe: obj.name  -> name ist keine Referenz
  if (ts.isPropertyAccessExpression(p) && p.name === node) return false;
  if (ts.isQualifiedName(p) && p.right === node) return false;
  // Objektliteral-Schluessel (nicht computed); Shorthand IS eine Referenz
  if (ts.isPropertyAssignment(p) && p.name === node) return false;
  if (ts.isMethodDeclaration(p) && p.name === node) return false;
  if (ts.isPropertyDeclaration(p) && p.name === node) return false;
  if (ts.isGetAccessor(p) && p.name === node) return false;
  if (ts.isSetAccessor(p) && p.name === node) return false;
  if (ts.isPropertySignature(p) || ts.isMethodSignature(p)) return false;
  if (ts.isEnumMember(p) && p.name === node) return false;
  // Deklarationsnamen
  if (ts.isVariableDeclaration(p) && p.name === node) return false;
  if (ts.isParameter(p) && p.name === node) return false;
  if (ts.isBindingElement(p) && (p.name === node || p.propertyName === node)) return false;
  if (ts.isFunctionDeclaration(p) && p.name === node) return false;
  if (ts.isFunctionExpression(p) && p.name === node) return false;
  if (ts.isClassDeclaration(p) && p.name === node) return false;
  if (ts.isClassExpression(p) && p.name === node) return false;
  if (ts.isEnumDeclaration(p) && p.name === node) return false;
  if (ts.isModuleDeclaration(p) && p.name === node) return false;
  if (ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p)) return false;
  if (ts.isTypeParameterDeclaration(p)) return false;
  // Import/Export
  if (ts.isImportSpecifier(p) || ts.isExportSpecifier(p) || ts.isImportClause(p) ||
      ts.isNamespaceImport(p) || ts.isNamespaceExport(p) || ts.isImportEqualsDeclaration(p)) return false;
  // Labels
  if (ts.isLabeledStatement(p) && p.label === node) return false;
  if ((ts.isBreakStatement(p) || ts.isContinueStatement(p)) && p.label === node) return false;
  // JSX
  if (ts.isJsxAttribute(p) && p.name === node) return false;
  if (ts.isJsxClosingElement(p)) return false;      // Duplikat des oeffnenden Tags
  if (ts.isJsxNamespacedName && ts.isJsxNamespacedName(p)) return false;
  if ((ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === node) {
    // Intrinsische Tags (div, span, ...) sind keine Bezeichner
    if (/^[a-z]/.test(node.text)) return false;
  }
  // Meta
  if (ts.isMetaProperty && p.kind === ts.SyntaxKind.MetaProperty) return false;
  if (isTypeContext(ts, node)) return false;
  return true;
}



function isScopeNode(n) {
  return ts.isSourceFile(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) ||
    ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isBlock(n) || ts.isForStatement(n) ||
    ts.isForInStatement(n) || ts.isForOfStatement(n) || ts.isCatchClause(n) ||
    ts.isClassDeclaration(n) || ts.isClassExpression(n) || ts.isModuleBlock(n) ||
    ts.isCaseBlock(n);
}
function isFunctionScope(n) {
  return ts.isSourceFile(n) || ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) || ts.isMethodDeclaration(n) || ts.isConstructorDeclaration(n) ||
    ts.isGetAccessor(n) || ts.isSetAccessor(n) || ts.isModuleBlock(n);
}
function nearestScope(n) { let p = n.parent; while (p && !isScopeNode(p)) p = p.parent; return p; }
function nearestFunctionScope(n) { let p = n.parent; while (p && !isFunctionScope(p)) p = p.parent; return p; }

function analyze(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const scopes = new Map(); // scopeNode -> Set<name>
  const add = (scopeNode, name) => {
    if (!scopeNode) return;
    if (!scopes.has(scopeNode)) scopes.set(scopeNode, new Set());
    scopes.get(scopeNode).add(name);
  };
  const addAll = (scopeNode, nameNode) => {
    const s = new Set(); collectBindingNames(ts, nameNode, s);
    for (const n of s) add(scopeNode, n);
  };

  const declVisit = (node) => {
    if (ts.isImportClause(node) && node.name) add(sf, node.name.text);
    else if ((ts.isNamespaceImport(node) || ts.isImportSpecifier(node) ||
              ts.isImportEqualsDeclaration(node) || ts.isNamespaceExport(node)) &&
             node.name && ts.isIdentifier(node.name)) add(sf, node.name.text);
    else if (ts.isVariableDeclaration(node)) {
      const list = node.parent;
      const isVar = ts.isVariableDeclarationList(list) &&
        !(list.flags & (ts.NodeFlags.Let | ts.NodeFlags.Const));
      addAll(isVar ? nearestFunctionScope(node) : nearestScope(node), node.name);
    }
    else if (ts.isParameter(node)) {
      let fn = node.parent; addAll(fn, node.name);
      if (fn && fn.body && ts.isBlock(fn.body)) addAll(fn.body, node.name);
    }
    else if (ts.isFunctionDeclaration(node) && node.name) add(nearestFunctionScope(node) || nearestScope(node), node.name.text);
    else if ((ts.isClassDeclaration(node) || ts.isEnumDeclaration(node) ||
              ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) ||
              ts.isModuleDeclaration(node)) && node.name && ts.isIdentifier(node.name))
      add(nearestScope(node), node.name.text);
    else if ((ts.isFunctionExpression(node) || ts.isClassExpression(node)) && node.name)
      add(node, node.name.text);
    else if (ts.isTypeParameterDeclaration(node) && node.name) add(nearestScope(node), node.name.text);
    else if (ts.isCatchClause(node) && node.variableDeclaration) {
      addAll(node, node.variableDeclaration.name);
      if (node.block) addAll(node.block, node.variableDeclaration.name);
    }
    ts.forEachChild(node, declVisit);
  };
  ts.forEachChild(sf, declVisit);

  const out = [];
  const refVisit = (node) => {
    if (ts.isIdentifier(node) && isReference(ts, node)) {
      const name = node.text;
      if (!GLOBALS.has(name)) {
        let s = nearestScope(node) || sf, found = false;
        // eigener Knoten kann Scope sein (FunctionExpression-Name)
        let cur = node.parent;
        while (cur) {
          if (isScopeNode(cur) && scopes.get(cur)?.has(name)) { found = true; break; }
          cur = cur.parent;
        }
        if (!found && scopes.get(sf)?.has(name)) found = true;
        if (!found) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          out.push({ name, line: line + 1 });
        }
      }
    }
    ts.forEachChild(node, refVisit);
  };
  ts.forEachChild(sf, refVisit);
  return out;
}

function walkFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(fp, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(fp);
  }
  return acc;
}

const files = walkFiles(process.argv[2] || 'src').sort();
const befunde = [];
for (const f of files) {
  const res = analyze(f);
  if (!res.length) continue;
  const seen = new Map();
  for (const r of res) { if (!seen.has(r.name)) seen.set(r.name, []); seen.get(r.name).push(r.line); }
  for (const [name, lines] of seen) befunde.push({ f, name, lines });
}
const total = befunde.length;
if (total > 0) {
  console.error(`Benutzt, aber nirgends definiert -- ${total} Stueck:\n`);
  for (const b of befunde) console.error(`  ${b.f}:${b.lines[0]}  ->  ${b.name}  (Zeilen ${b.lines.join(',')})`);
}
if (total === 0) {
  console.log(`Bezeichner: keine undefinierte Verwendung in ${files.length} Dateien.`);
  process.exit(0);
}
process.exit(1);
