#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_REGION:?KLAR_REGION is required}"
: "${KLAR_SERVICE:?KLAR_SERVICE is required}"
: "${KLAR_IMAGE:?KLAR_IMAGE must be an immutable image reference}"
: "${KLAR_CONFIRM_PRODUCTION:?Set KLAR_CONFIRM_PRODUCTION=deploy}"

if [[ "${KLAR_CONFIRM_PRODUCTION}" != "deploy" ]]; then
  echo "Refusing production deployment without KLAR_CONFIRM_PRODUCTION=deploy" >&2
  exit 2
fi
if [[ ! "${KLAR_IMAGE}" =~ @sha256:[0-9a-f]{64}$ ]]; then
  echo "KLAR_IMAGE must end with an immutable @sha256 digest" >&2
  exit 2
fi

command -v gcloud >/dev/null
command -v curl >/dev/null

previous_image="$(gcloud run services describe "${KLAR_SERVICE}"   --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}"   --format='value(spec.template.spec.containers[0].image)')"

revision_suffix="candidate-${GITHUB_RUN_ID:-$(date +%s)}"
gcloud run deploy "${KLAR_SERVICE}"   --project "${KLAR_PROJECT_ID}"   --region "${KLAR_REGION}"   --image "${KLAR_IMAGE}"   --revision-suffix "${revision_suffix}"   --tag candidate   --no-traffic   --quiet

candidate_url="$(gcloud run services describe "${KLAR_SERVICE}"   --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}"   --format='value(status.traffic[?tag==candidate].url)')"

curl --fail --silent --show-error --retry 5 --retry-all-errors "${candidate_url}/api/health" >/dev/null
curl --fail --silent --show-error --retry 5 --retry-all-errors "${candidate_url}/api/ready" >/dev/null

gcloud run services update-traffic "${KLAR_SERVICE}"   --project "${KLAR_PROJECT_ID}"   --region "${KLAR_REGION}"   --to-tags candidate=10   --quiet

echo "Canary deployed at 10%."
echo "Previous image: ${previous_image}"
echo "Candidate image: ${KLAR_IMAGE}"
echo "Promote only after SLO observation:"
echo "gcloud run services update-traffic ${KLAR_SERVICE} --project ${KLAR_PROJECT_ID} --region ${KLAR_REGION} --to-tags candidate=100"
echo "Rollback with tested revision traffic switch:"
echo "KLAR_ROLLBACK_REVISION=<known-good-revision> KLAR_CONFIRM_ROLLBACK=rollback scripts/rollback-cloud-run.sh"
