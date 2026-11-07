#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_REGION:?KLAR_REGION is required}"
: "${KLAR_SERVICE:?KLAR_SERVICE is required}"
: "${KLAR_IMAGE:?KLAR_IMAGE must be an immutable image reference}"
: "${KLAR_IMAGE_REPOSITORY:?KLAR_IMAGE_REPOSITORY must identify the approved GHCR klar-app repository}"
: "${KLAR_CONFIRM_PRODUCTION:?Set KLAR_CONFIRM_PRODUCTION=deploy}"

if [[ "${KLAR_CONFIRM_PRODUCTION}" != "deploy" ]]; then
  echo "Refusing production deployment without KLAR_CONFIRM_PRODUCTION=deploy" >&2
  exit 2
fi
# An immutable digest alone is NOT an approved image: an unrelated registry
# can also publish a valid sha256. Enforce the same canonical GHCR source
# already required by promote-prod.sh, before the GO preflight or gcloud.
if [[ ! "${KLAR_IMAGE_REPOSITORY}" =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/klar-app$ ]]; then
  echo "KLAR_IMAGE_REPOSITORY must be the approved GHCR klar-app repository" >&2
  exit 2
fi
if [[ ! "${KLAR_IMAGE}" =~ ^ghcr\.io/[a-z0-9][a-z0-9._-]*/klar-app@sha256:[0-9a-f]{64}$ ]]; then
  echo "KLAR_IMAGE must be an immutable GHCR klar-app digest" >&2
  exit 2
fi
if [[ "${KLAR_IMAGE}" != "${KLAR_IMAGE_REPOSITORY}@sha256:"* ]]; then
  echo "KLAR_IMAGE is outside the approved image repository" >&2
  exit 2
fi

# A candidate with 10% canary traffic is a production release action.
# Do not contact GCP while the repository's exact-SHA GO evidence is NO-GO.
# This check also requires the protected release approval and independent reviews.
command -v node >/dev/null
node "$(dirname "${BASH_SOURCE[0]}")/check-production-release-approval.mjs"
# The approved SHA must be the real, clean checked-out source (not just an env claim).
node "$(dirname "${BASH_SOURCE[0]}")/check-production-checkout-identity.mjs"

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
echo "Do NOT promote using an unguarded gcloud update-traffic command."
echo "After independently reviewed canary SLO evidence and formal GO revalidation,"
echo "use scripts/promote-prod.sh with an approved immutable image, candidate revision,"
echo "signed-off observation evidence and KLAR_CONFIRM_PROMOTION=promote."
echo "Rollback with tested revision traffic switch:"
echo "KLAR_ROLLBACK_REVISION=<known-good-revision> KLAR_CONFIRM_ROLLBACK=rollback scripts/rollback-cloud-run.sh"
