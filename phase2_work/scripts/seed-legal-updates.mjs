import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app);

const updates = [
  {
    id: 'dsgvo-2026-08',
    version: '2026.08.1',
    publishedAt: '2026-08-14',
    titleKey: 'legalUpdates.items.transparencyAge.title',
    descriptionKey: 'legalUpdates.items.transparencyAge.description',
    sourceKey: 'legalUpdates.items.transparencyAge.source',
    sourceUrl: 'https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en',
    categoryKey: 'legalUpdates.categories.privacy',
    actionRequired: false,
  },
];

const batch = db.batch();
for (const update of updates) batch.set(db.collection('legal_updates').doc(update.id), update, { merge: false });
await batch.commit();
console.log(`Seeded ${updates.length} legal update(s).`);
