import fs from 'node:fs';

const tips = fs.readFileSync('src/screens/Tips.tsx', 'utf8');
const queue = fs.readFileSync('src/lib/offlineQueue.ts', 'utf8');
const route = fs.readFileSync('src/server/routes/checklists.ts', 'utf8');

if (/localStorage\.(?:getItem|setItem|removeItem|clear)\s*\(/.test(tips)) {
  throw new Error('Tips date-prep screen must not access localStorage directly.');
}
for (const marker of [
  'loadQueuedDatePrepChecklist(checklistUid)',
  'enqueueDatePrepChecklist(checklistUid, next)',
  'flushDatePrepChecklist({ ownerUid: checklistUid, token })',
  "'/api/checklists/date_prep'",
]) if (!tips.includes(marker)) throw new Error(`Missing date-prep synchronization control: ${marker}`);
for (const marker of [
  'checklist:date_prep:${ownerUid}',
  'indexedDB.open(DB_NAME, 3)',
  "url: '/api/checklists/date_prep'",
  'ownerUid',
]) if (!queue.includes(marker)) throw new Error(`Missing UID-scoped IndexedDB control: ${marker}`);
for (const marker of [
  "doc(`users/${uid}/checklists/date_prep`)",
  'sanitizeChecklist',
  'updatedAt: new Date()',
]) if (!route.includes(marker)) throw new Error(`Missing server-authoritative checklist control: ${marker}`);
console.log('Date-prep checklist boundary: PASS');
