import fs from 'node:fs';

const file = fs.readFileSync('src/services/dataExportService.ts', 'utf8');
const forbidden = [
  'X-Firebase-Token',
  'x-firebase-token',
  "collection('chats')",
  'where(\'participants\'',
  'fallback to client-side',
];
for (const marker of forbidden) {
  if (file.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`Data export integrity violation: ${marker}`);
  }
}
if (!file.includes("/api/account/export")) throw new Error('Data export must use the authoritative server export endpoint.');
if (!file.includes('Authorization: `Bearer ${token}`')) throw new Error('Data export must use the standard Authorization Bearer credential.');
if (!file.includes('response.ok')) throw new Error('Data export must fail closed on non-success responses.');
if (!file.includes('AbortSignal.timeout(20_000)')) throw new Error('Data export must have a bounded request timeout.');
console.log('PASS: data export is server-authoritative, standard-authenticated, bounded and fail-closed.');
