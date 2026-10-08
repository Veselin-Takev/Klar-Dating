import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('legal updates enterprise boundary', () => {
  it('keeps legal updates server-authoritative and acknowledgements UID-scoped', () => {
    const route = fs.readFileSync('src/server/routes/legalUpdates.ts', 'utf8');
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    const layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');
    expect(route).toContain("collection('legal_updates')");
    expect(route).toContain("collection('legal_acknowledgements')");
    expect(route).toContain('runTransaction');
    expect(rules).toContain('match /legal_updates/{updateId}');
    expect(rules).toContain('allow read, write: if false;');
    expect(rules).toContain('match /users/{userId}/legal_acknowledgements/{updateId}');
    expect(rules).toContain('allow read: if isOwner(userId);');
    expect(layout).not.toContain('klar_ack_legal_ids');
  });

  it('keeps the modal WCAG tab semantics and keyboard model', () => {
    const modal = fs.readFileSync('src/components/LegalUpdatesModal.tsx', 'utf8');
    for (const marker of ['role="tablist"', 'role="tab"', 'aria-selected', 'aria-controls', 'role="tabpanel"', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'useModalAccessibility']) {
      expect(modal).toContain(marker);
    }
  });
});
