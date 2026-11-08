import {
  getConfiguredMaintenanceRepository,
  closeServerDb,
} from '../src/server/firestoreRepository/nativeDatabase';
import { z } from 'zod';
const schema = z.record(z.string(), z.unknown());
import type { FunnelStep } from '../types/analytics';
const FUNNEL_ORDER: FunnelStep[] = [
  'onboarding_started',
  'profile_basic_completed',
  'biometrics_started',
  'biometrics_success',
  'onboarding_completed',
];

async function calculateDropoff() {
  const db = getConfiguredMaintenanceRepository();
  const snapshot = await db.listAll('funnel_events', schema);

  const sessionsByStep: Record<FunnelStep, Set<string>> = {
    onboarding_started: new Set(),
    profile_basic_completed: new Set(),
    biometrics_started: new Set(),
    biometrics_success: new Set(),
    biometrics_failed: new Set(),
    onboarding_completed: new Set(),
  };

  snapshot.forEach((doc) => {
    const data = doc.data;
    if (sessionsByStep[data.step as FunnelStep]) {
      if (typeof data.sessionId === 'string')
        sessionsByStep[data.step as FunnelStep].add(data.sessionId);
    }
  });

  console.log('==============================================================');
  console.log('             KLAR APP: ONBOARDING FUNNEL AUDIT                ');
  console.log('==============================================================');

  let previousCount = 0;

  FUNNEL_ORDER.forEach((step, index) => {
    const currentCount = sessionsByStep[step].size;
    let stepConversion = '100.0%';
    let dropoffRate = '0.0%';

    if (index > 0 && previousCount > 0) {
      const conv = (currentCount / previousCount) * 100;
      stepConversion = `${conv.toFixed(1)}%`;
      dropoffRate = `${(100 - conv).toFixed(1)}%`;
    }

    console.log(
      `[Stufe ${index + 1}] ${step.padEnd(25)} | Sessions: ${currentCount
        .toString()
        .padEnd(
          6,
        )} | Conv: ${stepConversion.padEnd(7)} | Drop-off: ${dropoffRate}`,
    );

    previousCount = currentCount;
  });

  const biometricsFails = sessionsByStep['biometrics_failed'].size;
  console.log('--------------------------------------------------------------');
  console.log(
    `Zusatzmetrik: Fehlgeschlagene Biometrie-Scans: ${biometricsFails}`,
  );
  console.log('==============================================================');
}

try {
  await calculateDropoff();
} finally {
  await closeServerDb();
}
