import fs from 'node:fs';

const source = fs.readFileSync('src/server/platform/aiPiiSanitizer.ts', 'utf8');
const required = [
  'PHONE_CANDIDATE',
  'germanDomestic',
  'germanInternational',
  '[PHONE_REDACTED]',
  'sanitizeAiPayload',
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`AI PII sanitizer hardening missing: ${token}`);
}
if (!source.includes('^(?:0(?:1[5-7]\\d{8,9}|[2-9]\\d{6,10}))$')) {
  throw new Error('German domestic phone invariant missing');
}
if (!source.includes('^(?:49(?:1[5-7]\\d{8,9}|[2-9]\\d{6,10}))$')) {
  throw new Error('German international phone invariant missing');
}
console.log('AI PII sanitizer boundary: PASS');
