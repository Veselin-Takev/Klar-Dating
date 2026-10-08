#!/usr/bin/env bash
set -euo pipefail

: "${KLAR_PROJECT_ID:?KLAR_PROJECT_ID is required}"
: "${KLAR_REGION:?KLAR_REGION is required}"
: "${KLAR_SERVICE:?KLAR_SERVICE is required}"
: "${KLAR_ROLLBACK_REVISION:?KLAR_ROLLBACK_REVISION is required}"
: "${KLAR_CONFIRM_ROLLBACK:?Set KLAR_CONFIRM_ROLLBACK=rollback}"

if [[ "${KLAR_CONFIRM_ROLLBACK}" != "rollback" ]]; then
  echo "Refusing rollback without KLAR_CONFIRM_ROLLBACK=rollback" >&2
  exit 2
fi

if [[ ! "${KLAR_ROLLBACK_REVISION}" =~ ^[a-z][a-z0-9-]{0,62}$ ]]; then
  echo "KLAR_ROLLBACK_REVISION is not a valid Cloud Run revision name" >&2
  exit 2
fi

command -v gcloud >/dev/null
command -v curl >/dev/null
command -v node >/dev/null

current_revision="$(gcloud run services describe "${KLAR_SERVICE}" \
  --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" \
  --format='value(status.latestReadyRevisionName)')"

target_revision="$(gcloud run revisions list \
  --service "${KLAR_SERVICE}" \
  --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" \
  --filter="metadata.name=${KLAR_ROLLBACK_REVISION}" \
  --format='value(metadata.name)' --limit=1)"

if [[ "${target_revision}" != "${KLAR_ROLLBACK_REVISION}" ]]; then
  echo "Rollback target is not a revision of ${KLAR_SERVICE}: ${KLAR_ROLLBACK_REVISION}" >&2
  exit 2
fi

gcloud run services update-traffic "${KLAR_SERVICE}" \
  --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" \
  --to-revisions "${KLAR_ROLLBACK_REVISION}=100" --quiet

service_url="$(gcloud run services describe "${KLAR_SERVICE}" \
  --project "${KLAR_PROJECT_ID}" --region "${KLAR_REGION}" \
  --format='value(status.url)')"

curl --fail --silent --show-error --retry 5 --retry-all-errors "${service_url}/api/health" >/dev/null
curl --fail --silent --show-error --retry 5 --retry-all-errors "${service_url}/api/ready" >/dev/null

evidence_dir="${KLAR_ROLLBACK_EVIDENCE_DIR:-rollback-evidence}"
mkdir -p "${evidence_dir}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
evidence_file="${evidence_dir}/rollback-${timestamp}.json"

node - "${evidence_file}" "${KLAR_PROJECT_ID}" "${KLAR_REGION}" "${KLAR_SERVICE}" "${current_revision}" "${KLAR_ROLLBACK_REVISION}" "${service_url}" <<'NODE'
const [file, projectId, region, service, fromRevision, toRevision, serviceUrl] = process.argv.slice(2);
const fs = require('node:fs');
fs.writeFileSync(file, JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  projectId,
  region,
  service,
  fromRevision,
  toRevision,
  serviceUrl,
  trafficPercent: 100,
  health: 'passed',
  readiness: 'passed',
}, null, 2) + '\n');
NODE

echo "Rollback completed: ${current_revision} -> ${KLAR_ROLLBACK_REVISION}"
echo "Evidence: ${evidence_file}"
