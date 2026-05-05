#!/bin/zsh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$REPO_ROOT/logs"
DATE_VALUE="${DOCTOR_BRIEFING_DATE:-$(date +%F)}"
LOCK_DIR="$LOG_DIR/.daily-run.lock"
LOG_FILE="$LOG_DIR/daily-run-$DATE_VALUE.log"
GENERATION_TIMEOUT_SECONDS="${GENERATION_TIMEOUT_SECONDS:-3600}"

mkdir -p "$LOG_DIR"
exec >> "$LOG_FILE" 2>&1

echo "===== doctor hotspot daily run started at $(date '+%F %T %z') ====="
echo "Repo: $REPO_ROOT"
echo "Date: $DATE_VALUE"
echo "NO_PUSH=${NO_PUSH:-0} PUBLISH_ONLY=${PUBLISH_ONLY:-0}"
echo "GENERATION_TIMEOUT_SECONDS=$GENERATION_TIMEOUT_SECONDS"

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

kill_process_tree() {
  local root_pid="$1"
  local child_pid
  for child_pid in ${(f)"$(pgrep -P "$root_pid" 2>/dev/null || true)"}; do
    [[ -n "$child_pid" ]] && kill_process_tree "$child_pid"
  done
  kill -TERM "$root_pid" 2>/dev/null || true
}

run_with_timeout() {
  local timeout_seconds="$1"
  shift
  local started_at="$SECONDS"
  "$@" &
  local command_pid="$!"

  while kill -0 "$command_pid" 2>/dev/null; do
    if (( SECONDS - started_at >= timeout_seconds )); then
      echo "Generation timed out after ${timeout_seconds}s; terminating process tree rooted at $command_pid" >&2
      kill_process_tree "$command_pid"
      sleep 5
      kill -KILL "$command_pid" 2>/dev/null || true
      wait "$command_pid" 2>/dev/null || true
      return 124
    fi
    sleep 5
  done

  wait "$command_pid"
}

if [[ "${PUBLISH_ONLY:-0}" != "1" ]]; then
  RUN_STARTED_EPOCH="$(date +%s)"
  run_with_timeout "$GENERATION_TIMEOUT_SECONDS" ./scripts/generate-report-codex.sh
  export DOCTOR_BRIEFING_MIN_MTIME_EPOCH="$RUN_STARTED_EPOCH"
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
