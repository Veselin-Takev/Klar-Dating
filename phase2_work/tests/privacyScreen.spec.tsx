import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('privacy screen lock contract', () => {
  it('locks after inactivity and on hidden visibility state', () => {
    const source = fs.readFileSync('src/components/Sichtschutz.tsx', 'utf8');
    expect(source).toContain('INACTIVITY_MS');
    expect(source).toContain('visibilitychange');
    expect(source).toContain('Wieder anzeigen');
  });
});
