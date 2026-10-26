import fs from 'node:fs';
const source = fs.readFileSync('src/server/translationService.ts', 'utf8');
const required = [
  /TRANSLATION_RESPONSE_MAX_BYTES\s*=\s*64 \* 1024/,
  /TRANSLATION_TEXT_MAX_CHARS\s*=\s*12_000/,
  /readBoundedResponse\(response, TRANSLATION_RESPONSE_MAX_BYTES/,
  /JSON\.parse\(responseText\)/,
  /data\.textTranslated\.length\s*>\s*TRANSLATION_TEXT_MAX_CHARS/,
];
for (const [i, re] of required.entries()) if (!re.test(source)) throw new Error(`Translation provider boundary check ${i + 1} failed`);
console.log('Translation provider boundary: PASS');
