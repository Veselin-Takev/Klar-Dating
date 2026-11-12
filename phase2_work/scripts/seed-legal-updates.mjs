import {
  getConfiguredMaintenanceRepository,
  closeServerDb,
} from '../src/server/firestoreRepository/nativeDatabase.ts';
import { z } from 'zod';
const db = getConfiguredMaintenanceRepository();
const apply = process.argv.includes('--apply');
const updates = [
  {
    id: 'dsgvo-2026-08',
    version: '2026.08.1',
    publishedAt: '2026-08-14',
    titleKey: 'legalUpdates.items.transparencyAge.title',
    descriptionKey: 'legalUpdates.items.transparencyAge.description',
    sourceKey: 'legalUpdates.items.transparencyAge.source',
    sourceUrl:
      'https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en',
    categoryKey: 'legalUpdates.categories.privacy',
    actionRequired: false,
  },
];

if (apply)
  await db.transaction(async (tx) => {
    for (const update of updates)
      tx.write(
        `legal_updates/${update.id}`,
        z.record(z.string(), z.unknown()),
        update,
      );
  });
console.log(
  JSON.stringify({
    mode: apply ? 'applied' : 'dry-run',
    legalUpdates: updates.length,
  }),
);
await closeServerDb();
