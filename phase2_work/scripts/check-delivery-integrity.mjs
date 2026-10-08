#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const email = readFileSync('src/server/email.ts', 'utf8');
const exportSource = readFileSync('src/server/datenschutz.ts', 'utf8');
const failures = [];

if (/status:\s*['"]success['"][\s\S]{0,220}simulated\s*:\s*true/.test(email)) {
  failures.push('Email worker must never mark simulated/undelivered mail as success.');
}
if (!email.includes("status: 'pending'") || !email.includes("email_provider_unavailable")) {
  failures.push('Email provider outage must preserve a pending retry state.');
}
if (!exportSource.includes("fehler(res, 503, 'Die Auskunft konnte wegen nicht verfügbarer Kontodaten")) {
  failures.push('GDPR export must fail closed when Firebase Auth account data cannot be loaded.');
}

if (failures.length) {
  console.error('FAIL: delivery integrity policy');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('PASS: delivery integrity policy');
