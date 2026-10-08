import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [
  { file: "src/server/platform/riskEngine.ts", forbidden: ["return assessRisk(extraSignals)"] },
  { file: "src/server/consentAudit.ts", forbidden: ["klar-enterprise-consent-audit-hmac", "Deterministic fallback secret"] },
  { file: "src/server/platform/auditComplianceExport.ts", forbidden: ["SEED_AUDIT_DATA"] },
  { file: "src/lib/smartMatchService.ts", forbidden: ["FALLBACK_PROFILES", "München Tech Community", "Cloud Excellence Hub"] },
  { file: "src/server/routes/account.ts", forbidden: ["isAdult: false,\n          einwilligung: null", "account status fallback"] },
  { file: "src/services/pushNotificationService.ts", forbidden: ["mock-push-token", "fake-push-token", "simulated push token"] },
];

const failures = [];
for (const check of checks) {
  const content = fs.readFileSync(path.join(root, check.file), "utf8");
  for (const needle of check.forbidden) {
    if (content.includes(needle)) failures.push(`${check.file}: forbidden production fallback marker: ${needle}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Production fallback policy: PASS");
