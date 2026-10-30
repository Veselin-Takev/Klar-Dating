import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const uploader = read('src/lib/klar.ts');
const classification = read('src/lib/profileMediaSource.ts');
const image = read('src/components/AuthorizedProfileImage.tsx');
const server = read('src/server/platform/launchPlatform.ts');
const uploaderStart = uploader.indexOf('export async function ladeProfilfotoHoch(');
const uploaderEnd = uploader.indexOf('// ── Icebreaker-Gate', uploaderStart);
assert.ok(uploaderStart !== -1 && uploaderEnd > uploaderStart, 'profile uploader source boundary');
const body = uploader.slice(uploaderStart, uploaderEnd);
assert.doesNotMatch(body, /getDownloadURL\s*\(/, 'do not mint bearer download URLs');
assert.match(body, /photoURL:\s*fileName/, 'persist only canonical storage path');
assert.match(server, /canonicalProfileMediaReference\(data\.photoURL \|\| data\.photoUrl\)/,
  'server profile projection must strip legacy bearer tokens');
assert.match(classification, /firebasestorage\.googleapis\.com/,
  'legacy Firebase URLs must be parsed for path only');
assert.match(image, /getBlob\(ref\(storage,\s*storagePath\),\s*8 \* 1024 \* 1024\)/,
  'image component must download through authenticated Firebase Storage SDK');
assert.match(image, /URL\.revokeObjectURL/, 'component must revoke object URLs');
assert.doesNotMatch(image, /getDownloadURL/, 'renderer must not use bearer download URL');
assert.match(image, /referrerPolicy="no-referrer"/, 'profile image referrers must remain sealed');
const consumers = [
  'src/screens/Profile.tsx', 'src/screens/Chats.tsx',
  'src/screens/ChatView.tsx', 'src/screens/Dashboard.tsx',
  'src/components/MemoizedProfileCard.tsx',
  'src/components/MemoizedKlarMatchCard.tsx',
  'src/components/KlarMatchWidget.tsx',
  'src/components/SmartVerbindungCarousel.tsx',
  'src/components/MatchIcebreakersWidget.tsx',
  'src/components/ProfileDetailModal.tsx',
];
for (const file of consumers) {
  const content = read(file);
  assert.match(content, /<AuthorizedProfileImage\b/, 'authorized image component missing: '+file);
  assert.doesNotMatch(content, /<img\b[^>]*src=\{[^}]*photoUrl/i,
    'legacy direct profile URL in image src: '+file);
}
assert.match(read('tests/profileMediaSource.spec.ts'), /SENSITIVE-OLD-FIREBASE-CAPABILITY/,
  'legacy token extraction regression must remain in CI');
console.log('Profile media SDK-only display/source boundary: PASS (source, not CORS or token revocation)');
