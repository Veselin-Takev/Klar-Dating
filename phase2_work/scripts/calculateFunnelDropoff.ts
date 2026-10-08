import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { FunnelStep } from "../types/analytics";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "demo-klar";

// Wenn es sich um ein Demo-Projekt handelt und kein Emulator-Host definiert ist, lokal binden
if (projectId.startsWith("demo-") && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

if (getApps().length === 0) {
  initializeApp({ projectId });
}

const FUNNEL_ORDER: FunnelStep[] = [
  "onboarding_started",
  "profile_basic_completed",
  "biometrics_started",
  "biometrics_success",
  "onboarding_completed",
];

async function calculateDropoff() {
  const db = getFirestore();
  const snapshot = await db.collection("funnel_events").get();

  const sessionsByStep: Record<FunnelStep, Set<string>> = {
    onboarding_started: new Set(),
    profile_basic_completed: new Set(),
    biometrics_started: new Set(),
    biometrics_success: new Set(),
    biometrics_failed: new Set(),
    onboarding_completed: new Set(),
  };

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (sessionsByStep[data.step as FunnelStep]) {
      sessionsByStep[data.step as FunnelStep].add(data.sessionId);
    }
  });

  console.log("==============================================================");
  console.log("             KLAR APP: ONBOARDING FUNNEL AUDIT                ");
  console.log("==============================================================");

  let previousCount = 0;

  FUNNEL_ORDER.forEach((step, index) => {
    const currentCount = sessionsByStep[step].size;
    let stepConversion = "100.0%";
    let dropoffRate = "0.0%";

    if (index > 0 && previousCount > 0) {
      const conv = (currentCount / previousCount) * 100;
      stepConversion = `${conv.toFixed(1)}%`;
      dropoffRate = `${(100 - conv).toFixed(1)}%`;
    }

    console.log(
      `[Stufe ${index + 1}] ${step.padEnd(25)} | Sessions: ${currentCount
        .toString()
        .padEnd(6)} | Conv: ${stepConversion.padEnd(7)} | Drop-off: ${dropoffRate}`
    );

    previousCount = currentCount;
  });

  const biometricsFails = sessionsByStep["biometrics_failed"].size;
  console.log("--------------------------------------------------------------");
  console.log(`Zusatzmetrik: Fehlgeschlagene Biometrie-Scans: ${biometricsFails}`);
  console.log("==============================================================");
}

calculateDropoff().catch((err) => {
  if (err.message && err.message.includes("ECONNREFUSED")) {
    console.error("\n❌ FEHLER: Der Firestore Emulator läuft nicht auf 127.0.0.1:8080!");
    console.error("Starte ihn bitte in einem separaten Terminal mit: npx firebase emulators:start --only firestore\n");
  } else {
    console.error(err);
  }
  process.exit(1);
});
