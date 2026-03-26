#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

OUTPUT="$(bash "$REPO_ROOT/scripts/run-smoke.sh" fast --list)"

if ! grep -q 'running smoke suite: fast' <<<"$OUTPUT"; then
  echo "run-smoke.sh should announce the selected suite"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if ! grep -q 'test-example-cluster-template.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should include test-example-cluster-template.sh"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if ! grep -q 'test-steamcmd-retry-lib.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should include test-steamcmd-retry-lib.sh"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if ! grep -q 'test-check-local-config-ports-and-dirs.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should include test-check-local-config-ports-and-dirs.sh"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if ! grep -q 'test-check-local-config-shard-settings.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should include test-check-local-config-shard-settings.sh"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if ! grep -q 'test-bootstrap-local-script.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should include test-bootstrap-local-script.sh"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if ! grep -q 'test-compose-port-envs.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should include test-compose-port-envs.sh"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

if grep -q 'test-managed-legacy-fallback-cleanup.sh' <<<"$OUTPUT"; then
  echo "run-smoke.sh fast suite should not include docker-only cleanup smoke"
  printf '%s\n' "$OUTPUT"
  exit 1
fi
