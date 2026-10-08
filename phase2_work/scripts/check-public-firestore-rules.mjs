import { readFileSync } from 'node:fs';

const text = readFileSync('firestore.rules', 'utf8')
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');

const forbidden = [
  /allow\s+(?:read|get|list|write|create|update|delete)\s*:\s*if\s+true\s*;/g,
  /allow\s+read\s*:\s*if\s+true\b/g,
];

const failures = [];
for (const pattern of forbidden) {
  for (const match of text.matchAll(pattern)) {
    const line = text.slice(0, match.index ?? 0).split('\n').length;
    failures.push(`firestore.rules:${line}: unconditional public access rule is forbidden`);
  }
}

if (failures.length) {
  console.error('Public Firestore rules gate FAILED:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Public Firestore rules gate PASS: no unconditional client access rule is present.');

const publicProfileMatch = text.match(/match \/public_profiles\/{userId}[\s\S]*?allow write: if false;/);
const publicProfile = publicProfileMatch?.[0] ?? '';
if (!publicProfile.includes("get(/databases/$(database)/documents/users/$(userId)).data.isAdult == true")) {
  throw new Error('public_profiles reads are not bound to the target profile adult gate');
}
