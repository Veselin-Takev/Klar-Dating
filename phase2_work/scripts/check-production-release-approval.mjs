const approved = process.env.KLAR_PRODUCTION_RELEASE_APPROVED;

if (approved !== "true") {
  console.error("Production release approval check FAILED:");
  console.error("- KLAR_PRODUCTION_RELEASE_APPROVED must be exactly 'true' in the protected production environment.");
  console.error("- No production artifact may be published without explicit protected-environment approval.");
  process.exit(1);
}

console.log("Production release approval check PASS: explicit protected-environment approval is present.");
