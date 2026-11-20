import fs from 'node:fs';
const ui = fs.readFileSync('src/components/ConsentSettings.tsx', 'utf8');
const handler = fs.readFileSync('src/server/datenschutz.ts', 'utf8');
const persistence = fs.readFileSync('src/server/consentPersistence.ts', 'utf8');
for (const marker of ['/api/einwilligung/zweck', "consentCenter.status.allowed", "consentCenter.status.notAllowed", "consentCenter.actions.withdraw", "consentCenter.actions.grant", "consentCenter.messages.failed]) {
  if (!ui.includes(marker)) throw new Error(`Missing consent UI control: ${marker}`);
}
for (const marker of ['handleEinwilligungZweck', 'persistConsentDecision', 'revokeExplicitConsent']) {
  if (!handler.includes(marker)) throw new Error(`Missing consent server control: ${marker}`);
}
if (!persistence.includes('runTransaction') && !persistence.includes('runObservedTransaction')) throw new Error('Missing consent ledger transaction control');
if (!persistence.includes('signConsentAuditRecord')) throw new Error('Missing consent ledger signing control');
if (!fs.readFileSync('src/server/consentAudit.ts', 'utf8').includes('HMAC-SHA256')) throw new Error('Missing HMAC-SHA256 consent signature');
console.log('Consent center boundary: PASS');