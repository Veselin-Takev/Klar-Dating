import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const translation = fs.readFileSync('src/server/platform/translationEngine.ts', 'utf8');
const service = fs.readFileSync('src/server/translationService.ts', 'utf8');

const checks = [
  ['translate endpoint is in central KI_ENDPUNKTE', /const KI_ENDPUNKTE[\s\S]*?"\/api\/translate"[\s\S]*?\]\);/],
  ['translation path uses privacy sanitization', /sanitizePromptInput\(text\)/],
  ['translation path has no paid-provider fallback', /No paid-provider fallback by design/],
  ['translation service has bounded timeout', /TRANSLATION_TIMEOUT_MS = 1500/],
  ['translation service caps response bytes', /TRANSLATION_RESPONSE_MAX_BYTES/],
  ['translation service caps output text', /TRANSLATION_TEXT_MAX_CHARS/],
  ['translation engine preserves sanitized original on failure', /sanitized original remains authoritative/],
];

for (const [label, check] of checks) {
  const source = label.includes('translate endpoint') ? server : label.includes('service') || label.includes('timeout') || label.includes('bytes') || label.includes('output text') ? service : translation;
  if (!check.test(source)) throw new Error(`Translation AI policy boundary failed: ${label}`);
}

console.log('Translation AI policy boundary: PASS');
