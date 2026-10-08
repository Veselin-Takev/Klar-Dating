import fs from 'node:fs';
const ui=fs.readFileSync('src/components/ConsentSettings.tsx','utf8');
const handler=fs.readFileSync('src/server/datenschutz.ts','utf8');
const persistence=fs.readFileSync('src/server/consentPersistence.ts','utf8');
for (const marker of ['/api/einwilligung/zweck','Erlaubt','Nicht erlaubt','Widerrufen']) if (!ui.includes(marker)) throw new Error(`Missing consent UI control: ${marker}`);
for (const marker of ['handleEinwilligungZweck','persistConsentDecision','revokeExplicitConsent']) if (!handler.includes(marker)) throw new Error(`Missing consent server control: ${marker}`);
for (const marker of ['runTransaction','signConsentAuditRecord','HMAC-SHA256']) if (!persistence.includes(marker) && marker !== 'HMAC-SHA256') throw new Error(`Missing consent ledger control: ${marker}`);
if (!fs.readFileSync('src/server/consentAudit.ts','utf8').includes('HMAC-SHA256')) throw new Error('Missing HMAC-SHA256 consent signature');
console.log('Consent center boundary: PASS');
