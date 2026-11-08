import {
  getConfiguredMaintenanceRepository,
  closeServerDb,
} from '../src/server/firestoreRepository/nativeDatabase';
import { z } from 'zod';
const schema = z.record(z.string(), z.unknown());
async function computeQualityMetrics() {
  const db = getConfiguredMaintenanceRepository();
  const snapshot = await db.listAll('matches', schema, {
    where: ['mutualSuccessScore', '>', 0],
  });

  let totalScore = 0;
  let ghostedCount = 0;
  const totalEvaluated = snapshot.length;

  snapshot.forEach((doc) => {
    const data = doc.data;
    totalScore +=
      typeof data.mutualSuccessScore === 'number' &&
      Number.isFinite(data.mutualSuccessScore)
        ? data.mutualSuccessScore
        : 0;

    if (
      (data.feedbackA as { conversationQuality?: string } | undefined)
        ?.conversationQuality === 'ghosted' ||
      (data.feedbackB as { conversationQuality?: string } | undefined)
        ?.conversationQuality === 'ghosted'
    ) {
      ghostedCount++;
    }
  });

  const avgSuccess =
    totalEvaluated > 0 ? (totalScore / totalEvaluated).toFixed(2) : '0';
  const ghostingRate =
    totalEvaluated > 0
      ? ((ghostedCount / totalEvaluated) * 100).toFixed(1)
      : '0';

  console.log('==========================================');
  console.log('       MATCHING-QUALITÄTSBERICHT          ');
  console.log('==========================================');
  console.log(`Ausgewertete Matches:                ${totalEvaluated}`);
  console.log(`Ø Mutual Success Score:              ${avgSuccess} / 5.0`);
  console.log(`Ghosting-Rate vor/nach Gate:         ${ghostingRate}%`);
  console.log('==========================================');
}

try {
  await computeQualityMetrics();
} finally {
  await closeServerDb();
}
