#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

TMP_ROOT="$(mktemp -d /tmp/dst-control-plane-e2e-lib.XXXXXX)"
TARGET_DIR="$TMP_ROOT/root-owned"

cleanup() {
  safe_rm_tree "$TMP_ROOT"
}
trap cleanup EXIT

mkdir -p "$TARGET_DIR"

docker run --rm \
  -v "$TARGET_DIR":/target \
  --entrypoint bash \
  "${E2E_DOCKER_IMAGE:-golang:1.26.1-bookworm}" \
  -lc 'mkdir -p /target/nested && touch /target/nested/file && chown -R 0:0 /target && chmod -R 755 /target'

if rm -rf "$TARGET_DIR" 2>/dev/null; then
  echo "expected plain rm -rf to fail for root-owned nested directories" >&2
  exit 1
fi

safe_rm_tree "$TARGET_DIR"

if [ -e "$TARGET_DIR" ]; then
  echo "expected safe_rm_tree to remove $TARGET_DIR" >&2
  exit 1
fi

printf 'e2e lib cleanup passed\n'
