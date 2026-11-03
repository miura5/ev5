#!/usr/bin/env bash
# Runs the /kit visual test in the pinned Playwright image. Pass --update-snapshots to regenerate baselines.
# The image tag is derived from the pinned @playwright/test version in package.json.
set -euo pipefail
cd "$(dirname "$0")/.."
version="$(node -p "require('./package.json').devDependencies['@playwright/test']")"
image="mcr.microsoft.com/playwright:v${version}-noble"
npm run build
npx vite preview --port 4173 --strictPort &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do
  curl -fsS http://127.0.0.1:4173/kit >/dev/null 2>&1 && break
  sleep 1
done
docker run --rm --init --ipc=host --network host --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -e PW_BASE_URL=http://127.0.0.1:4173 -v "$PWD:/work" -w /work "$image" \
  npx playwright test -c e2e/playwright.visual.config.ts "$@"
