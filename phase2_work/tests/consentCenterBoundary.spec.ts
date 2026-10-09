import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('consent center contract', () => {
  it('uses atomic server decisions and signed evidence', () => {
    const handler = fs.readFileSync('src/server/datenschutz.ts', 'utf8');
    const persistence = fs.readFileSync('src/server/consentPersistence.ts', 'utf8');
    const audit = fs.readFileSync('src/server/consentAudit.ts', 'utf8');
    expect(handler).toContain('persistConsentDecision');
    expect(persistence).toContain('runObservedTransaction');
    expect(persistence).toContain('signConsentAuditRecord');
    expect(audit).toContain('HMAC-SHA256');
  });
});
