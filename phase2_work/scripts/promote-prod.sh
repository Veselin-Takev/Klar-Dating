#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_REGION:?KLAR_REGION is required}"
: "${KLAR_SERVICE:?KLAR_SERVICE is required}"
: "${KLAR_PROMOTE_REVISION:?KLAR_PROMOTE_REVISION is required}"
: "${KLAR_PROMOTE_IMAGE:?KLAR_PROMOTE_IMAGE must be the exact immutable approved image digest}"
: "${KLAR_IMAGE_REPOSITORY:?KLAR_IMAGE_REPOSITORY must be the approved production image repository}"
: "${KLAR_PROMOTION_EVIDENCE:?KLAR_PROMOTION_EVIDENCE must reference approved canary observation evidence}"
: "${KLAR_CONFIRM_PROMOTION:?Set KLAR_CONFIRM_PROMOTION=promote}"
: "${KLAR_EVIDENCE_ENVIRONMENT:?KLAR_EVIDENCE_ENVIRONMENT=production is required}"
: "${KLAR_EVIDENCE_NOT_BEFORE:?KLAR_EVIDENCE_NOT_BEFORE is required}"
: "${KLAR_EVIDENCE_NOT_AFTER:?KLAR_EVIDENCE_NOT_AFTER is required}"
: "${KLAR_EVIDENCE_HOSTS:?KLAR_EVIDENCE_HOSTS must contain approved observability hosts}"

[[ "${KLAR_CONFIRM_PROMOTION}" == "promote" ]] || { echo "Refusing promotion without KLAR_CONFIRM_PROMOTION=promote" >&2; exit 2; }
[[ "${KLAR_PROMOTE_REVISION}" =~ ^[a-z][a-z0-9-]{0,62}$ ]] || { echo "Invalid Cloud Run revision name" >&2; exit 2; }
[[ "${KLAR_PROMOTE_IMAGE}" =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/klar-app@sha256:[0-9a-f]{64}$ ]] || { echo "Promotion image must be an immutable GHCR klar-app digest" >&2; exit 2; }
[[ "${KLAR_PROMOTE_IMAGE}" == "${KLAR_IMAGE_REPOSITORY}@sha256:"* ]] || { echo "Promotion image is outside the approved repository" >&2; exit 2; }

command -v gcloud >/dev/null
command -v node >/dev/null

node scripts/validate-promotion-evidence.mjs "${KLAR_PROMOTION_EVIDENCE}" "${KLAR_PROMOTE_IMAGE}" "${KLAR_PROMOTE_REVISION}" "${GITHUB_SHA:-${KLAR_BUILD_SHA:-}}"

revision_image="$(gcloud run revisions describe "${KLAR_PROMOTE_REVISION}" --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" --format='value(spec.containers[0].image)')"
[[ "${revision_image}" == "${KLAR_PROMOTE_IMAGE}" ]] || { echo "Candidate revision image does not match approved immutable image" >&2; exit 2; }

traffic_json="$(gcloud run services describe "${KLAR_SERVICE}" --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" --format='json(status.traffic)')"
node - "${traffic_json}" "${KLAR_PROMOTE_REVISION}" <<'NODE'
const traffic = JSON.parse(process.argv[2]).status?.traffic ?? [];
const revision = process.argv[3];
const candidate = traffic.find(entry => entry.revisionName === revision);
if (!candidate || Number(candidate.percent) !== 10) {
  console.error('Promotion requires the named candidate revision to have exactly 10% traffic before promotion.');
  process.exit(2);
}
NODE

gcloud run services update-traffic "${KLAR_SERVICE}" --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" --to-revisions "${KLAR_PROMOTE_REVISION}=100" --quiet

final_state="$(gcloud run services describe "${KLAR_SERVICE}" \
  --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" \
  --format='json(status.traffic,spec.template.spec.containers[0].image,status.url)')"
node - "${final_state}" "${KLAR_PROMOTE_REVISION}" "${KLAR_PROMOTE_IMAGE}" <<'NODE'
const state = JSON.parse(process.argv[2]);
const revision = process.argv[3];
const image = process.argv[4];
const traffic = state.status?.traffic ?? [];
const candidate = traffic.find(entry => entry.revisionName === revision);
if (!candidate || Number(candidate.percent) !== 100) {
  console.error('Cloud Run did not confirm 100% candidate traffic; refusing to report promotion success');
  process.exit(2);
}
if (state.spec?.template?.spec?.containers?.[0]?.image !== image) {
  console.error('Cloud Run service template image does not match the promoted immutable image');
  process.exit(2);
}
if (!state.status?.url) {
  console.error('Cloud Run service URL is missing after promotion');
  process.exit(2);
}
NODE

service_url="$(node - "${final_state}" <<'NODE'
const state = JSON.parse(process.argv[2]);
process.stdout.write(state.status?.url ?? '');
NODE
)"
curl --fail --silent --show-error --retry 5 --retry-all-errors "${service_url}/api/health" >/dev/null
curl --fail --silent --show-error --retry 5 --retry-all-errors "${service_url}/api/ready" >/dev/null

echo "Production promotion completed: ${KLAR_PROMOTE_REVISION} at 100% traffic with verified image, health, and readiness."
