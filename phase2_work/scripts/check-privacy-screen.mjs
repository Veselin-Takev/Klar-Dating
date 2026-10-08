import fs from 'node:fs';
const text = fs.readFileSync('src/components/Sichtschutz.tsx','utf8');
for (const marker of ['INACTIVITY_MS', 'visibilitychange', 'SICHTSCHUTZ_EIN', 'Wieder anzeigen', 'Niemand sieht, was du gerade liest']) if (!text.includes(marker)) throw new Error(`Missing privacy screen control: ${marker}`);
console.log('Privacy screen lock: PASS');
