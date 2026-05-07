#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PENDING_PUSH_FILE="${PENDING_PUSH_FILE:-logs/pending-push.env}"
PUSH_RETRIES="${PUSH_RETRIES:-3}"
PUSH_RETRY_DELAY_SECONDS="${PUSH_RETRY_DELAY_SECONDS:-20}"

upstream_ref() {
  git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true
}

ahead_count() {
  local upstream
  upstream="$(upstream_ref)"
  if [[ -z "$upstream" ]]; then
    echo 0
    return
  fi
  git rev-list --left-right --count "${upstream}...HEAD" | awk '{print $2}'
}

if [[ -f "$PENDING_PUSH_FILE" ]]; then
  echo "Pending push marker found: $PENDING_PUSH_FILE"
elif [[ "$(ahead_count)" != "0" ]]; then
  echo "No marker found, but local branch is ahead of upstream; retrying push."
else
  echo "No pending push."
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Refusing pending push because the worktree has uncommitted changes." >&2
  git status --short >&2
  exit 2
fi

for ((attempt = 1; attempt <= PUSH_RETRIES; attempt += 1)); do
  echo "pending git push attempt ${attempt}/${PUSH_RETRIES}"
  if git push; then
    rm -f "$PENDING_PUSH_FILE"
    echo "Pending push completed."
    exit 0
  fi
  if (( attempt < PUSH_RETRIES )); then
    sleep "$PUSH_RETRY_DELAY_SECONDS"
  fi
done

echo "Pending push still failed after ${PUSH_RETRIES} attempt(s)." >&2
exit 1
