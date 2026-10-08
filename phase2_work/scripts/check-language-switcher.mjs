import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../src/components/LanguageSwitcher.tsx', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/i18n/config.ts', import.meta.url), 'utf8');
const locale = readFileSync(new URL('../src/i18n/locale.ts', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/components/Layout.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const test = readFileSync(new URL('../src/components/LanguageSwitcher.test.tsx', import.meta.url), 'utf8');

const checks = [
  ['four supported locales', /SUPPORTED_LANGUAGES\s*=\s*\['de', 'en', 'es', 'fr'\]/s.test(locale)],
  ['native select control', /<select[\s\S]*value=\{currentLanguage\}/.test(component)],
  ['reactive i18next change', /void change\(event\.target\.value\)/.test(component)],
  ['root lang synchronization', /document\.documentElement\.lang\s*=\s*normalizeLanguage\(language\)/.test(config)],
  ['persistent language key', /LANGUAGE_STORAGE_KEY/.test(config) && /klar_language/.test(locale)],
  ['systembar integration', /<LanguageSwitcher\s*\/>/.test(layout)],
  ['keyboard/mobile touch target', /min-h-11/.test(component) && /\.klar-language-switcher/.test(css)],
  ['localized accessibility label', /t\('settings\.language'\)/.test(component)],
  ['live persistence/status semantics', /role="status"/.test(component) && /aria-busy=/.test(component)],
  ['automated coverage', /it\.each\(\['de', 'en', 'es', 'fr'\]/.test(test) && /localStorage\.getItem\('klar_language'\)/.test(test)],
];

const failures = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failures.length) process.exit(1);
console.log('Language switcher boundary: PASS');
