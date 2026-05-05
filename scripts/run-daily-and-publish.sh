#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
DATE_VALUE="${DOCTOR_BRIEFING_DATE:-$(date +%F)}"
LOCK_DIR="$LOG_DIR/.daily-run.lock"
LOG_FILE="$LOG_DIR/daily-run-$DATE_VALUE.log"

mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

echo "===== doctor hotspot daily run started at $(date '+%F %T %z') ====="
echo "Repo: $REPO_ROOT"
echo "Date: $DATE_VALUE"
echo "NO_PUSH=${NO_PUSH:-0} PUBLISH_ONLY=${PUBLISH_ONLY:-0}"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another daily run is already in progress: $LOCK_DIR" >&2
  exit 1
fi

cleanup() {
  local exit_code=$?
  rmdir "$LOCK_DIR" 2>/dev/null || true
  echo "===== doctor hotspot daily run finished with status $exit_code at $(date '+%F %T %z') ====="
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

cd "$REPO_ROOT"

if [[ "${PUBLISH_ONLY:-0}" != "1" ]]; then
  ./scripts/generate-report-codex.sh
else
  echo "PUBLISH_ONLY=1, skipping Codex generation."
fi

node scripts/validate-report-output.mjs
node scripts/publish-report.mjs

if [[ "${NO_PUSH:-0}" == "1" ]]; then
  echo "NO_PUSH=1, skipping git commit/push."
else
  SKIP_PUBLISH=1 ./scripts/push-site.sh
fi
