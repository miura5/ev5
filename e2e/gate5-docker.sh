#!/usr/bin/env bash
# Runs the Gate 5 journeys against staging in the pinned Playwright image. Needs E2E_URL and E2E_TOKEN.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${E2E_URL:?}" "${E2E_TOKEN:?}"
version="$(node -p "require('./package.json').devDependencies['@playwright/test']")"
docker run --rm --init --ipc=host --user "$(id -u):$(id -g)" -e HOME=/tmp -e E2E_URL -e E2E_TOKEN \
  -v "$PWD:/work" -w /work "mcr.microsoft.com/playwright:v${version}-noble" \
  npx playwright test -c e2e/playwright.gate5.config.ts "$@"
