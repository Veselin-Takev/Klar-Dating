import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const middleware = fs.readFileSync('src/core/auth/authMiddleware.ts', 'utf8');
const failures = [];

if (!source.includes('verifyIdToken(idToken, true)')) {
  failures.push('requireAuth must verify Firebase ID tokens with the Admin SDK and revocation checks enabled.');
}
if (!middleware.includes('verifyIdToken(token, true)')) {
  failures.push('src/core/auth/authMiddleware.ts must verify Firebase ID tokens with the Admin SDK and revocation checks enabled.');
}
if (/verifyIdToken\([^;\n]*,\s*false\s*\)/.test(source + '\n' + middleware)) {
  failures.push('Signature-only Firebase verification is forbidden at the API authentication boundaries.');
}

for (const forbidden of [
  "req.user = { uid: 'verified-user-id'",
  "req.user = { uid: \"verified-user-id\"",
  "token === 'invalid'",
]) {
  if (middleware.includes(forbidden)) failures.push(`Runtime auth mock/fixed identity is forbidden: ${forbidden}`);
}

for (const forbidden of [
  "Buffer.from(payloadPart, 'base64url')",
  'validateAuthClaims(payload)',
  'JSON.parse(Buffer.from(payloadPart',
]) {
  if (source.includes(forbidden)) {
    failures.push(`Unsigned JWT payload fallback is forbidden: ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error('Auth boundary gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Auth boundary gate PASS: production authentication requires Firebase Admin SDK signature and revocation verification.');

