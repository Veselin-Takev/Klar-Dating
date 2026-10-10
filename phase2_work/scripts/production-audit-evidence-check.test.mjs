import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const script = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'audit-production-controls.ts'), 'utf8');
test('audit checks external output before cloud access', () => {
 const check = script.indexOf('validateExternalReportPath(repositoryRoot, output)');
 const cloud = script.indexOf('const serviceJson = gcloud(');
 assert.ok(check >= 0 && cloud > check, 'External output must be checked before gcloud');
 assert.match(script, /join\(tmpdir\(\),/);
});
test('audit writes private write-once evidence', () => {
 assert.match(script, /writeFile\(output,[\s\S]*?mode:\s*0o600,\s*flag:\s*'wx'/);
});
test('audit avoids serializing the full report to console', () => {
 assert.doesNotMatch(script, /console\.(?:log|info|warn|error)\(\s*JSON\.stringify\(\s*report\b/);
 assert.match(script, /console\.log\(`Production controls audit/);
});

test('gcloud audit commands have bounded time and output', () => {
 assert.match(script, /execFileSync\('gcloud', args, \{[^\n]*timeout:\s*30_000,\s*maxBuffer:\s*2 \* 1024 \* 1024/);
});
