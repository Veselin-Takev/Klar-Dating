#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_ROOT"

if ! command -v nvm >/dev/null 2>&1; then
  for candidate in "${NVM_DIR:-/usr/local/share/nvm}/nvm.sh" "$HOME/.nvm/nvm.sh"; do
    if [[ -s "$candidate" ]]; then
      # shellcheck disable=SC1090
      source "$candidate"
      break
    fi
  done
fi
if ! command -v nvm >/dev/null 2>&1; then
  echo 'nvm is required by the Codespaces base image' >&2
  exit 1
fi

nvm install 22.23.3
# A postCreateCommand runs in its own shell: persist the pin for later terminals.
nvm alias default 22.23.3
nvm use 22.23.3
[[ "$(node -v)" == 'v22.23.3' ]] || { echo 'Node 22.23.3 required' >&2; exit 1; }

# Install the exact Bun package version in the nvm-scoped npm prefix.
npm install --global --no-audit --no-fund bun@1.4.4
[[ "$(bun --version)" == '1.4.4' ]] || { echo 'Bun 1.4.4 required' >&2; exit 1; }

java_version="$(java -version 2>&1)"
printf '%s\n' "$java_version"
[[ "$java_version" =~ version[[:space:]]+\"21([.\"]|$) ]] || { echo 'Java 21 required' >&2; exit 1; }

node scripts/check-dependency-locks.mjs
bun ci
npm ci --prefix functions --ignore-scripts --no-audit --no-fund
test -f node_modules/firebase-tools/lib/bin/firebase.js || { echo 'Local Firebase CLI is missing' >&2; exit 1; }
printf 'Klar Codespaces prerequisites OK: Node %s / Bun %s\n' "$(node -v)" "$(bun --version)"
