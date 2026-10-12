import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('profile settings categories', () => {
  const source = readFileSync(new URL('../src/screens/Profile.tsx', import.meta.url), 'utf8');
  it('provides three discoverable categories with accessible selection state', () => {
    expect(source).toContain('Sicherheit & Datenschutz');
    expect(source).toContain('Präferenzen & Hinweise');
    expect(source).toContain('Erweitert & Konto');
    expect(source).toContain('aria-pressed={settingsCategory === id}');
    expect(source).toContain('min-h-11');
  });
  it('does not unmount consent or account protection when switching categories', () => {
    expect(source).toContain("settingsCategory === 'privacy' ? 'space-y-4' : 'hidden'");
    expect(source).toContain('<ConsentSettings />');
    expect(source).toContain('<AboVerwaltung />');
    expect(source).toContain('handleDeleteAccount');
  });
});
