#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const source = readFileSync('src/server/trustAndSafety.ts','utf8');
const table = readFileSync('scripts/loeschkaskade.mjs','utf8');
const required = ["consent_audit_log", "subjectPseudonym", "pseudonymizedAt"];
for (const token of required) if (!source.includes(token)) throw new Error(`Missing consent audit retention control: ${token}`);
if (!table.includes("consent_audit_log: { art: 'bleibt'")) throw new Error('Consent audit retention policy is not marked as retained');
if (source.includes("loescheAbfrage(db.collection('consent_audit_log')")) throw new Error('Consent audit ledger must not be deleted during account purge');
console.log('PASS consent audit retention');
