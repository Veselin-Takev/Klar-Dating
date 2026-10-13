import fs from 'node:fs';

const db = fs.readFileSync('src/server/db.ts', 'utf8');
const durable = fs.readFileSync('src/server/durableStore.ts', 'utf8');
const devDocs = fs.readFileSync('docs/DEVELOPMENT.md', 'utf8');
const failures = [];

if (!db.includes("process.env.NODE_ENV === 'development' && process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'")) {
  failures.push('db.ts must require explicit non-production durable fallback opt-in.');
}
if (!durable.includes("process.env.NODE_ENV === 'development' && process.env.KLAR_ALLOW_DURABLE_DB_FALLBACK === 'true'")) {
  failures.push('durableStore.ts must independently enforce the production fallback boundary.');
}
const guardedFallbacks = durable.match(/allowFallback && isPermissionDenied\(e\)/g)?.length ?? 0;
if (guardedFallbacks < 9) {
  failures.push(`durableStore.ts must guard all provider-error fallback branches; found ${guardedFallbacks}, expected at least 9.`);
}
if (/catch \(e: unknown\) \{\s*fallbackActive = true;/.test(durable)) {
  failures.push('durableStore.ts must never activate fallback for an arbitrary caught error.');
}
if (!devDocs.includes('KLAR_ALLOW_DURABLE_DB_FALLBACK=true')) {
  failures.push('Development documentation must document the explicit local-only fallback flag.');
}
// Verify the fail-closed native client boundary in addition to the opt-in flag.
if (!db.includes('if (!durableFallbackAllowed()) {') ||
    !db.includes('proxyDbInstance = realDbInstance;')) {
  failures.push('db.ts must return native Firestore outside the explicit local fallback.');
}
if (db.includes('using durable store:')) {
  failures.push('db.ts must not describe durable fallback as an implicit production recovery path.');
}

if (failures.length) {
  console.error('Durable-store policy gate FAIL:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Durable-store policy gate PASS: production fail-closed; fallback requires explicit development-only opt-in.');
