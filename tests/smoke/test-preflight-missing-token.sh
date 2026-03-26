#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-preflight-missing-token"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/data"

cp -a "$FIXTURE_DIR" "$TMP_DIR/data/Cluster_1"

if OUTPUT=$(docker run --rm -e DST_UPDATE_MODE=never -v "$TMP_DIR/data:/data" dst-docker:v1 2>&1); then
  echo "expected docker run to fail when cluster_token.txt is absent"
  exit 1
fi

if ! grep -q 'cluster_token.txt' <<< "$OUTPUT"; then
  echo "preflight output did not mention cluster_token.txt"
  printf '%s\n' "$OUTPUT"
  exit 1
fi
