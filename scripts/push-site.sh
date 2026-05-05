#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

node scripts/publish-report.mjs

if ! git diff --quiet || ! git diff --cached --quiet; then
  git add README.md .gitignore docs scripts
  git commit -m "Update doctor hotspot briefing"
else
  echo "No site changes to commit."
fi

git push
