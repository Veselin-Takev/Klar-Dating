import fs from "node:fs";

const file = ".github/workflows/release.yml";
const text = fs.readFileSync(file, "utf8");
const identityText = fs.readFileSync("scripts/write-release-identity.mjs", "utf8");
const failures = [];
const workflowFiles = fs.readdirSync(".github/workflows").filter(name => /\.ya?ml$/.test(name));
for (const workflowFile of workflowFiles) {
  const workflowText = fs.readFileSync(`.github/workflows/${workflowFile}`, "utf8");
  const matches = workflowText.match(/^\s*-?\s*uses:\s*[^@\s]+@([^\s#]+)(?:\s+#.*)?$/gm) ?? [];
  for (const match of matches) {
    const ref = match.match(/@([^\s#]+)/)?.[1] ?? "";
    if (!/^[0-9a-f]{40}$/.test(ref)) {
      failures.push(`${workflowFile}: GitHub Action ref must be pinned to a full 40-character commit SHA (found \`${ref}\`).`);
    }
  }
}

if (!/on:\n\s+push:\n\s+tags:\s*\[\'v\*\.\*\.\*\'\]/.test(text)) {
  failures.push("Production release must be triggered only by semver-like v*.*.* tags.");
}
if (/^\s+workflow_dispatch:/m.test(text)) {
  failures.push("Production release must not be manually dispatchable without an explicit tag contract.");
}
if (/ghcr\.io\/veselin8606-source\/klar-app@/.test(text)) {
  failures.push("Production workflow must not hard-code a historical container registry owner.");
}
if (!text.includes('ghcr.io/${{ github.repository_owner }}/klar-app@${KLAR_RELEASE_DIGEST}')) {
  failures.push("Production image verification must use the immutable digest under github.repository_owner.");
}
if (!text.includes('KLAR_PRODUCTION_RELEASE_APPROVED: ${{ vars.KLAR_PRODUCTION_RELEASE_APPROVED }}')) {
  failures.push("Production release must require an explicit protected-environment approval variable before artifact publication.");
}
if (!text.includes('run: node scripts/check-production-release-approval.mjs')) {
  failures.push("Production release approval gate is missing.");
}
if (!text.includes('node scripts/write-release-identity.mjs')) {
  failures.push("Production release must generate exact commit/tag/run/image identity evidence before publication.");
}
if (!text.includes('node scripts/write-release-identity.mjs') || !text.includes('path: release/')) {
  failures.push("Production release evidence must generate and upload release/build-identity.json with the release evidence directory.");
}
if (!text.includes('release/build-identity.json') || !text.includes('release/functions-build-identity.json') || !text.includes('release/SHA256SUMS')) {
  failures.push("Release identity evidence must cover both application and Firebase Functions identities before publication.");
}
if (!text.includes('node scripts/write-functions-release-identity.mjs')) {
  failures.push("Production release must generate an exact Firebase Functions build identity after the Functions build.");
}
if (!text.includes('node scripts/check-release-artifact-hygiene.mjs')) {
  failures.push("Production release must run the release artifact hygiene gate before packaging.");
}
if (!text.includes('node scripts/write-functions-release-identity.mjs')) {
  failures.push("Production release must generate an exact Firebase Functions build identity after the Functions build.");
}
if (!text.includes("provenance: mode=max") && !text.includes("--provenance=mode=max")) {
  failures.push("Production container builds must enable maximum Buildx provenance attestation.");
}
if (!text.includes("sbom: true") && !text.includes("--sbom=true")) {
  failures.push("Production container builds must enable SBOM attestation.");
}
if (!text.includes('docker buildx imagetools inspect --raw "$image" > release/container-index.json') || !text.includes('node scripts/check-container-attestations.mjs release/container-index.json')) {
  failures.push("Production release must verify published OCI attestation manifests in the immutable image index.");
}
if (!text.includes('release/container-index.json') || !text.includes('release/deploy/*.json')) {
  failures.push("Container index attestation evidence must be covered by SHA256SUMS before publication.");
}
if (!text.includes('docker buildx imagetools inspect \"ghcr.io/${{ github.repository_owner }}/klar-app:${GITHUB_REF_NAME}\" > release/container-tag-inspect.txt') || !text.includes('node scripts/write-container-tag-binding.mjs')) {
  failures.push("Production release must bind the semver registry tag to the exact immutable image digest.");
}
if (!text.includes('release/container-tag-inspect.txt') || !text.includes('release/container-tag-binding.json')) {
  failures.push("Container tag-to-digest evidence must be archived with the release.");
}
if (!text.includes('node scripts/write-sbom-identity.mjs') || !text.includes('release/sbom-build-identity.json')) {
  failures.push("Production release must bind the supplemental CycloneDX SBOM to the exact commit and immutable image digest.");
}
if (!text.includes('release/sbom-build-identity.json >> release/SHA256SUMS') && !/sha256sum[^\n]*release\/sbom-build-identity\.json[^\n]*>> release\/SHA256SUMS/.test(text) && !/find release -type f.*sha256sum.*release\/SHA256SUMS/s.test(text)) {
  failures.push("SBOM build identity must be covered by SHA256SUMS before publication.");
}
if (!identityText.includes("gitRevParse('HEAD')") || !identityText.includes("refs/tags/${refName}^{commit}") || !identityText.includes("headSha !== sha") || !identityText.includes("tagSha !== sha")) {
  failures.push("Release identity must fail closed unless checked-out HEAD and the exact release tag both resolve to GITHUB_SHA.");
}
if (!text.includes('node scripts/write-release-identity.mjs')) {
  failures.push("Release identity verification script must run in the production release before publication.");
}

if (failures.length) {
  console.error("Production release workflow check FAILED:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production release workflow check PASS: tag-only trigger, immutable action pins, and repository-scoped immutable image verification are enforced.");
