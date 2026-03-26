#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
suite="${1:-fast}"
list_only="${2:-}"

fast_tests=(
  "tests/smoke/test-example-cluster-template.sh"
  "tests/smoke/test-check-local-config-script.sh"
  "tests/smoke/test-check-local-config-ports-and-dirs.sh"
  "tests/smoke/test-check-local-config-shard-settings.sh"
  "tests/smoke/test-init-cluster-script.sh"
  "tests/smoke/test-legacy-workshop-extract-warnings.sh"
  "tests/smoke/test-legacy-workshop-fallback-lib.sh"
  "tests/smoke/test-steamcmd-bootstrap-baked.sh"
  "tests/smoke/test-steamcmd-retry-lib.sh"
  "tests/smoke/test-supervisord-config.sh"
)

full_tests=(
  "${fast_tests[@]}"
  "tests/smoke/test-preflight-missing-token.sh"
  "tests/smoke/test-managed-legacy-fallback-cleanup.sh"
)

case "$suite" in
  fast)
    tests=("${fast_tests[@]}")
    ;;
  full)
    tests=("${full_tests[@]}")
    ;;
  *)
    echo "usage: bash scripts/run-smoke.sh [fast|full]" >&2
    exit 1
    ;;
esac

printf 'running smoke suite: %s\n' "$suite"
for test_script in "${tests[@]}"; do
  printf '==> %s\n' "$test_script"
  if [ "$list_only" = "--list" ]; then
    continue
  fi
  bash "$REPO_ROOT/$test_script"
done
