// @vitest-environment node
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logSafeFailure } from '../src/server/safeErrorLog';
import { translateText } from '../src/server/translationService';
const canary = 'synthetic-private@example.test?token=LOG-CANARY';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('emits only a fixed warning event with no additional fields', () => {
  const sink = vi.spyOn(console, 'warn').mockImplementation(() => {});
  logSafeFailure('translation_fallback');
  expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'WARN', event: 'translation_fallback' })]]);
});
it('emits only a fixed error event even if JS supplies an extra error object', () => {
  const sink = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error(canary, { cause: { url: canary } }); error.stack = canary;
  Reflect.apply(logSafeFailure, null, ['smart_audit_failure', error]);
  expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'ERROR', event: 'smart_audit_failure' })]]);
});
const invalid: [string, () => unknown][] = [
  ['sensitive label', () => canary], ['prototype name', () => '__proto__'], ['inherited name', () => 'toString'],
  ['null', () => null], ['undefined', () => undefined], ['symbol', () => Symbol(canary)],
  ['error object', () => new Error(canary)],
  ['hostile property access', () => new Proxy({}, { get() { throw new Error('Must not inspect event object'); } })],
];
it.each(invalid)('does not serialize or inspect invalid event input: %s', (_label, create) => {
  const sink = vi.spyOn(console, 'error').mockImplementation(() => {});
  Reflect.apply(logSafeFailure, null, [create()]);
  expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'ERROR', event: 'unclassified_failure' })]]);
});
const failures: [string, () => unknown][] = [
  ['SDK Error', () => { const error = new Error(canary, { cause: { response: canary } }); error.stack = canary; return error; }],
  ['provider-shaped object', () => ({ message: canary, response: { data: canary }, stack: canary })],
  ['hostile object', () => new Proxy({}, { get() { throw new Error('Must not inspect thrown value'); } })],
];
describe('translation failure integration', () => {
  it.each(failures)('preserves fallback and minimizes %s', async (_label, create) => {
    const sink = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('TRANSLATION_SERVICE_URL', 'http://translation.example.test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(create()));
    expect(await translateText('synthetic text', 'en', 'de')).toEqual({ textTranslated: null, sourceLang: 'en', targetLang: 'de', usedFallback: true });
    expect(sink.mock.calls).toEqual([[JSON.stringify({ level: 'WARN', event: 'translation_fallback' })]]);
    expect(JSON.stringify(sink.mock.calls)).not.toContain(canary);
  });
});
function isStatic(node: ts.Node): boolean {
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)
    || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
  if (ts.isObjectLiteralExpression(node)) return node.properties.every(property => ts.isPropertyAssignment(property)
    && !ts.isComputedPropertyName(property.name) && isStatic(property.initializer));
  return ts.isCallExpression(node) && node.expression.getText() === 'JSON.stringify'
    && node.arguments.length === 1 && isStatic(node.arguments[0]!);
}
it('keeps server/translation failure sinks static and never passes exceptions to the safe logger', () => {
  const expected = new Set(['translation_fallback', 'firestore_health_failure', 'auth_health_failure',
    'adult_consent_check_failure', 'audit_log_write_failure', 'smart_audit_image_failure',
    'smart_audit_failure', 'dating_readiness_failure', 'daily_coach_failure', 'server_start_failure']);
  const events = new Set<string>(); const unsafe: string[] = [];
  for (const file of ['server.ts', 'src/server/translationService.ts']) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source);
        if (name === 'logSafeFailure') {
          if (node.arguments.length !== 1 || !ts.isStringLiteral(node.arguments[0]!)) unsafe.push(file + ': unsafe failure arguments');
          else events.add((node.arguments[0] as ts.StringLiteral).text);
        }
        if (name === 'console.error' || name === 'console.warn') {
          // Existing explicit local CSP diagnostics are not arbitrary exception logging.
          let parent: ts.Node | undefined = node.parent; let localCsp = false;
          while (parent) {
            if (ts.isIfStatement(parent) && parent.expression.getText(source) === 'emulatorQuellen.length > 0'
              && node.getText(source).includes('HINWEIS: Die CSP')) localCsp = true;
            parent = parent.parent;
          }
          if (!localCsp && !node.arguments.every(isStatic)) unsafe.push(file + ': dynamic console arguments');
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(unsafe).toEqual([]); expect([...events].sort()).toEqual([...expected].sort());
});
