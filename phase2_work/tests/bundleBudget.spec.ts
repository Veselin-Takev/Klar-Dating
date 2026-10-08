import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBundleBudget } from '../scripts/check-bundle-budget.mjs';

const roots: string[] = [];
const sources = { main: 'console.log("main");', shared: 'export const n = 7;', lazy: 'export default "lazy screen";', css: 'body { color: black; }' };
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'klar-bundle-')); roots.push(root);
  mkdirSync(join(root, '.vite')); mkdirSync(join(root, 'assets'));
  const manifest = {
    'index.html': { file: 'assets/main.js', isEntry: true, imports: ['shared'], dynamicImports: ['lazy'], css: ['assets/main.css'] },
    shared: { file: 'assets/shared.js', imports: ['index.html'], css: ['assets/main.css'] },
    lazy: { file: 'assets/lazy.js', isDynamicEntry: true },
  };
  writeFileSync(join(root, '.vite/manifest.json'), JSON.stringify(manifest));
  for (const [key, text] of Object.entries(sources)) writeFileSync(join(root, 'assets', key === 'css' ? 'main.css' : `${key}.js`), text);
  return { root, manifest };
}
const budget = { version: 1, limits: { initialJsGzipBytes: 10000, initialCssGzipBytes: 10000, totalJsGzipBytes: 10000, largestJsGzipBytes: 10000, largestJsBytes: 10000 } };
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('production bundle budget', () => {
  it('deduplicates static imports and CSS while including lazy chunks only in total/max budgets', () => {
    const { root } = fixture();
    const report = checkBundleBudget(root, budget);
    expect(report.passed).toBe(true);
    expect(report.measurements.initialJsGzipBytes).toBe(gzipSync(sources.main).length + gzipSync(sources.shared).length);
    expect(report.measurements.initialCssGzipBytes).toBe(gzipSync(sources.css).length);
    expect(report.measurements.totalJsGzipBytes).toBe(report.measurements.initialJsGzipBytes + gzipSync(sources.lazy).length);
    expect(report.initialFiles).not.toContain('assets/lazy.js');
  });

  it('fails a regression even if other limits still pass', () => {
    const { root } = fixture();
    const report = checkBundleBudget(root, { ...budget, limits: { ...budget.limits, initialJsGzipBytes: 1 } });
    expect(report.passed).toBe(false); expect(report.failures).toEqual(['initialJsGzipBytes']);
  });

  it.each(['manifest', 'asset', 'import', 'entry'])('refuses missing %s data instead of measuring zero', defect => {
    const { root, manifest } = fixture();
    if (defect === 'manifest') rmSync(join(root, '.vite/manifest.json'));
    if (defect === 'asset') rmSync(join(root, 'assets/lazy.js'));
    if (defect === 'import') {
      manifest['index.html'].imports.push('absent');
      writeFileSync(join(root, '.vite/manifest.json'), JSON.stringify(manifest));
    }
    if (defect === 'entry') writeFileSync(join(root, '.vite/manifest.json'), '{}');
    expect(() => checkBundleBudget(root, budget)).toThrow();
  });

  it('rejects incomplete and disabled budget configuration', () => {
    const { root } = fixture();
    for (const invalid of [{ version: 2, limits: budget.limits }, { version: 1, limits: {} }, { version: 1, limits: { ...budget.limits, largestJsBytes: 0 } }]) {
      expect(() => checkBundleBudget(root, invalid)).toThrow('Invalid bundle budget');
    }
  });

  it('rejects asset paths outside the build directory', () => {
    const { root, manifest } = fixture();
    const build = join(root, 'dist'); mkdirSync(build); mkdirSync(join(build, '.vite'));
    manifest['index.html'].file = '../assets/main.js';
    writeFileSync(join(build, '.vite/manifest.json'), JSON.stringify(manifest));
    expect(() => checkBundleBudget(build, budget)).toThrow('escapes dist');
  });
});
