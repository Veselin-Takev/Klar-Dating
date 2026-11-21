import fs from 'node:fs';
const text = fs.readFileSync('src/components/Sichtschutz.tsx', 'utf8');
for (const marker of ['INACTIVITY_MS', 'visibilitychange', 'SICHTSCHUTZ_EIN', 'useModalAccessibility', 'role="dialog"', 'aria-labelledby', "t('privacy.showScreen')", "t('privacy.nobodyCanSee')", "t('privacy.pauseMenu')"]) {
  if (!text.includes(marker)) throw new Error(`Missing privacy screen control: ${marker}`);
}
console.log('Privacy screen lock and accessible controls: PASS');