// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Vercel Vite deployment and static asset contract', () => {
  it('routes /api before SPA fallback and forbids Vercel caching of API results', () => {
    const cfg = JSON.parse(read('vercel.json')) as {
      rewrites: Array<{source: string; destination: string}>;
      headers: Array<{source: string; headers: Array<{key: string; value: string}>}>;
    };
    expect(cfg.rewrites[0]).toEqual({
      source: '/api/:path*',
      destination: '/api/proxy?__klar_api_path=:path*',
    });
    expect(cfg.rewrites[1]?.destination).toBe('/index.html');
    const apiHeaders = cfg.headers.find(rule => rule.source === '/api/:path*')?.headers ?? [];
    expect(apiHeaders.some(h => h.key.toLowerCase() === 'cache-control' && h.value === 'no-store')).toBe(true);
  });

  it('uses the actual public logo for loader, HTML favicon and notifications', () => {
    expect(existsSync('public/logo.svg')).toBe(true);
    expect(read('src/components/LogoLoader.tsx')).toContain('src="/logo.svg"');
    expect(read('index.html')).toContain('href="/logo.svg"');
    for (const path of [
      'src/screens/Dashboard.tsx',
      'src/services/pushNotificationService.ts',
      'src/components/DatingGoalRoadmapWidget.tsx',
    ]) {
      expect(read(path)).not.toMatch(/\/favicon\.ico|\/icon\.png/);
    }
  });

  it('does not describe backend 404 as an invalid birthdate', () => {
    const source = read('src/components/EinwilligungUndAlter.tsx');
    expect(source).toContain('[404, 405, 502, 503, 504].includes(res.status)');
    expect(source).toContain('setFehler(t("ageGate.errorService"))');
    expect(source).toContain('profile.isAdult !== true');
  });

  it('proxy implementation never writes Firestore or fabricates adult status', () => {
    const source = read('api/proxy.ts');
    expect(source).toContain("unavailable('api_upstream_not_configured')");
    expect(source).toContain("redirect: 'manual'");
    expect(source).not.toContain('setDoc(');
    expect(source).not.toContain('isAdult: true');
  });
});
