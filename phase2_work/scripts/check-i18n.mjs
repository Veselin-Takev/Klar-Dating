import fs from 'node:fs';
import assert from 'node:assert/strict';
function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === 'string' ? [[path, item]] : leaves(item, path);
  });
}
const read = lang => new Map(leaves(JSON.parse(fs.readFileSync(`src/i18n/locales/${lang}.json`, 'utf8'))));
const base = read('de');
const placeholders = text => [...text.matchAll(/{{\s*([^{}]+?)\s*}}/g)].map(match => match[1]).sort();
for (const lang of ['en', 'es', 'fr']) {
  const catalog = read(lang);
  assert.deepEqual([...catalog.keys()].sort(), [...base.keys()].sort(), `${lang}: missing/extra translation keys`);
  for (const [key, value] of catalog) {
    assert.ok(value.trim(), `${lang}.${key}: empty translation`);
    assert.deepEqual(placeholders(value), placeholders(base.get(key)), `${lang}.${key}: interpolation mismatch`);
  }
}
console.log(`i18n: ${base.size} keys and interpolation parameters consistent across de/en/es/fr. This checks catalog integrity, not full UI migration.`);
