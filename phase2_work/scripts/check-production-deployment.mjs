import { readFile } from "node:fs/promises";

const files = [
  ["scripts/deploy-prod.sh", "deploy"],
  ["scripts/promote-prod.sh", "promote"],
  ["scripts/rollback-cloud-run.sh", "rollback"],
];
const failures = [];
for (const [file, kind] of files) {
  const text = await readFile(file, "utf8");
  if (!text.includes("set -euo pipefail")) failures.push(`${file}: fail-fast shell policy is required.`);
  if (!text.includes("@sha256:[0-9a-f]{64}")) failures.push(`${file}: immutable sha256 image validation is required.`);
  if (!text.includes("KLAR_IMAGE_REPOSITORY")) failures.push(`${file}: approved image repository binding is required.`);
  if (kind === "deploy" && !text.includes("status.traffic")) failures.push(`${file}: deployment must verify the pre-canary traffic state.`);
  if (kind === "deploy" && !text.includes("traffic_after_canary")) failures.push(`${file}: deployment must verify the applied canary percentage.`);
  if (kind === "rollback" && !text.includes("KLAR_ROLLBACK_IMAGE")) failures.push(`${file}: rollback must name the exact approved immutable image.`);
  if (kind === "rollback" && !text.includes("spec.containers[0].image")) failures.push(`${file}: rollback must verify the target revision image.`);
  if (kind === "promote" && !text.includes("KLAR_PROMOTION_EVIDENCE")) failures.push(`${file}: promotion must require explicit canary observation evidence.`);
  if (kind === "promote" && !text.includes("KLAR_EVIDENCE_ENVIRONMENT")) failures.push(`${file}: promotion must bind evidence to trusted production environment.`);
  if (kind === "promote" && !text.includes("KLAR_EVIDENCE_NOT_BEFORE")) failures.push(`${file}: promotion must require a trusted evidence start boundary.`);
  if (kind === "promote" && !text.includes("KLAR_EVIDENCE_NOT_AFTER")) failures.push(`${file}: promotion must require a trusted evidence end boundary.`);
  if (kind === "promote" && !text.includes("KLAR_EVIDENCE_HOSTS")) failures.push(`${file}: promotion must require an approved evidence-host allowlist.`);
  if (kind === "promote" && !text.includes("traffic") || kind === "promote" && !text.includes("=10")) failures.push(`${file}: promotion must require verified 10% canary traffic before promotion.`);
  if (kind === "promote" && !text.includes("=100")) failures.push(`${file}: promotion must verify 100% traffic after the change.`);
  if (kind === "promote" && !text.includes("/api/health")) failures.push(`${file}: promotion must verify health after the traffic change.`);
  if (kind === "promote" && !text.includes("/api/ready")) failures.push(`${file}: promotion must verify readiness after the traffic change.`);
  if (kind === "promote" && !text.includes("service template image does not match")) failures.push(`${file}: promotion must verify the final service image.`);
  if (kind === "promote" && !text.includes("validate-promotion-evidence")) failures.push(`${file}: promotion must validate evidence before changing traffic.`);
  if (kind === "promote" && !text.includes("KLAR_IMAGE_REPOSITORY")) failures.push(`${file}: promotion must require the approved image repository binding.`);
  if (kind === "rollback" && !text.includes("100% traffic")) failures.push(`${file}: rollback must record explicit 100% traffic evidence.`);
  if (kind === "rollback" && !text.includes("final_traffic")) failures.push(`${file}: rollback must verify final 100% traffic before success.`);
}
if (failures.length) {
  console.error("Production deployment/rollback gate FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Production deployment/rollback gate PASS: immutable repository-bound images and verified rollback targets are enforced.");
