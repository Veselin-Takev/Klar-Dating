import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "demo-klar";

if (projectId.startsWith("demo-") && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}

if (getApps().length === 0) {
  initializeApp({ projectId });
}

async function computeQualityMetrics() {
  const db = getFirestore();
  const snapshot = await db.collection("matches").where("mutualSuccessScore", ">", 0).get();

  let totalScore = 0;
  let ghostedCount = 0;
  const totalEvaluated = snapshot.size;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    totalScore += data.mutualSuccessScore ?? 0;

    if (
      data.feedbackA?.conversationQuality === "ghosted" ||
      data.feedbackB?.conversationQuality === "ghosted"
    ) {
      ghostedCount++;
    }
  });

  const avgSuccess = totalEvaluated > 0 ? (totalScore / totalEvaluated).toFixed(2) : "0";
  const ghostingRate = totalEvaluated > 0 ? ((ghostedCount / totalEvaluated) * 100).toFixed(1) : "0";

  console.log("==========================================");
  console.log("       MATCHING-QUALITÄTSBERICHT          ");
  console.log("==========================================");
  console.log(`Ausgewertete Matches:                ${totalEvaluated}`);
  console.log(`Ø Mutual Success Score:              ${avgSuccess} / 5.0`);
  console.log(`Ghosting-Rate vor/nach Gate:         ${ghostingRate}%`);
  console.log("==========================================");
}

computeQualityMetrics().catch((err) => {
  if (err.message && err.message.includes("ECONNREFUSED")) {
    console.error("\n❌ FEHLER: Der Firestore Emulator läuft nicht auf 127.0.0.1:8080!");
    console.error("Starte ihn bitte mit: npx firebase emulators:start --only firestore\n");
  } else {
    console.error(err);
  }
  process.exit(1);
});
