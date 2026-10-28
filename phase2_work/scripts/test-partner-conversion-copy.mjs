import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/components/PartnerReferralWidget.tsx', import.meta.url), 'utf8');
for (const misleading of ['Bestätigte Empfehlungen', 'Geprüfter Partner', 'Teile von Klar geprüfte Partnerangebote', 'technisch geprüfter Klicks und bestätigter Empfehlungen']) {
  assert.ok(!source.includes(misleading), 'Do not imply verified purchase or independently certified partner: ' + misleading);
}
for (const honest of ['Technisch erfasste Conversions', 'Aktivierte Partnerkampagne', 'Signierte Meldungen belegen noch keinen Kauf', 'deren Gültigkeit gesondert geprüft werden muss']) {
  assert.ok(source.includes(honest), 'Missing pending-proof disclosure: ' + honest);
}
console.log('PASS: partner conversion UI does not conflate signed partner assertions with independently verified purchases');
