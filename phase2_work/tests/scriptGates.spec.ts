// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const fixtures: string[] = [];
function run(script: string, files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'klar-gate-'));
  fixtures.push(cwd);
  for (const [path, content] of Object.entries(files)) {
    const target = join(cwd, path);
    mkdirSync(resolve(target, '..'), { recursive: true });
    writeFileSync(target, content);
  }
  return spawnSync(process.execPath, [resolve('scripts', script)], { cwd, encoding: 'utf8' });
}
afterEach(() => { for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true }); });

describe('enterprise scanner regressions', () => {
  it('accepts class setters while rejecting an undeclared React setter', () => {
    const valid = run('check-hooks.mjs', {
      'src/Cache.ts': 'class Cache { public static setCachedData(value: string) { return value; } }',
    });
    expect(valid.status, valid.stderr).toBe(0);
    const invalid = run('check-hooks.mjs', {
      'src/Widget.tsx': 'export function Widget() { setMissing(true); return null; }',
    });
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('setMissing');
  });

  it.each(['ai.models.generateContent({})', '(ai.models as any).generateContent({})'])(
    'checks model calls including TypeScript casts: %s', call => {
      const files = {
        'server.ts': "app.post('/api/test', async (req, res) => { await " + call + "; });",
        'src/server/kiPolitik.ts': "export const STRATEGIE = { '/api/test': 'kein_ersatz' };",
      };
      const valid = run('kiErsatzPruefung.mjs', files);
      expect(valid.status, valid.stderr).toBe(0);
      expect(valid.stdout).toContain('alle 1 Endpunkte');
      const invalid = run('kiErsatzPruefung.mjs', {
        ...files, 'src/server/kiPolitik.ts': "export const STRATEGIE = { '/api/other': 'leer' };",
      });
      expect(invalid.status).toBe(1);
      expect(invalid.stderr).toContain('/api/test');
    },
  );

  it('cannot pass with only model calls in comments or strings', () => {
    const result = run('kiErsatzPruefung.mjs', {
      'server.ts': 'app.post("/api/test", () => { /* ai.models.generateContent({}) */ return "ai.models.generateContent({})"; });',
      'src/server/kiPolitik.ts': "export const STRATEGIE = { '/api/test': 'leer' };",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ohne Prüfgegenstand');
  });
});
