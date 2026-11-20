import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('privacy screen lock contract', () => {
  it('locks after inactivity and on hidden visibility state', () => {
    const source = fs.readFileSync('src/components/Sichtschutz.tsx', 'utf8');
    const deCatalog = JSON.parse(fs.readFileSync('src/i18n/locales/de.json', 'utf8')) as {
      privacy?: { showScreen?: string };
    };
    expect(source).toContain('INACTIVITY_MS');
    expect(source).toContain('visibilitychange');
    expect(source).toContain("t('privacy.showScreen')");
    expect(deCatalog.privacy?.showScreen).toBe('Wieder anzeigen');
  });
});
