import fs from 'node:fs';
const data = fs.readFileSync('src/data.ts', 'utf8');
const forbidden = ['Lena', 'Jonas', 'Clara', 'images.unsplash.com'];
const violations = forbidden.filter(token => data.toLowerCase().includes(token.toLowerCase()));
const match = fs.readFileSync('src/components/KlarMatchWidget.tsx', 'utf8');
if (match.includes('data.demo') || match.includes('images.unsplash.com')) violations.push('production match widget contains demo profile data');
if (violations.length) { console.error('Production-data gate failed:\n' + violations.join('\n')); process.exit(1); }
console.log('Production-data gate passed. Production contains no bundled sample profiles.');
