#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PENDING_PUSH_FILE="${PENDING_PUSH_FILE:-logs/pending-push.env}"
PUSH_RETRIES="${PUSH_RETRIES:-3}"
PUSH_RETRY_DELAY_SECONDS="${PUSH_RETRY_DELAY_SECONDS:-20}"

shell_quote() {
  printf "%q" "$1"
}

write_pending_push() {
  mkdir -p "$(dirname "$PENDING_PUSH_FILE")"
  {
    printf "PENDING_PUSH_CREATED_AT=%s\n" "$(shell_quote "$(date '+%F %T %z')")"
    printf "PENDING_PUSH_BRANCH=%s\n" "$(shell_quote "$(git branch --show-current)")"
    printf "PENDING_PUSH_HEAD=%s\n" "$(shell_quote "$(git rev-parse HEAD)")"
    printf "PENDING_PUSH_REMOTE=%s\n" "$(shell_quote "$(git remote get-url origin)")"
    printf "PENDING_PUSH_REASON=%s\n" "$(shell_quote "$1")"
  } > "$PENDING_PUSH_FILE"
  echo "Push failed; pending push recorded at $PENDING_PUSH_FILE" >&2
}

clear_pending_push() {
  rm -f "$PENDING_PUSH_FILE"
}

push_with_retry() {
  local attempt
  local last_status=0

  for ((attempt = 1; attempt <= PUSH_RETRIES; attempt += 1)); do
    echo "git push attempt ${attempt}/${PUSH_RETRIES}"
    if git push; then
      clear_pending_push
      return 0
    fi
    last_status=$?
    if (( attempt < PUSH_RETRIES )); then
      sleep "$PUSH_RETRY_DELAY_SECONDS"
    fi
  done

  write_pending_push "git push failed after ${PUSH_RETRIES} attempt(s), last status ${last_status}"
  return "$last_status"
}

if [[ "${SKIP_PUBLISH:-0}" != "1" ]]; then
  node scripts/publish-report.mjs
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add README.md .gitignore docs scripts
  git commit -m "Update doctor hotspot briefing"
else
  echo "No site changes to commit."
fi

push_with_retry
