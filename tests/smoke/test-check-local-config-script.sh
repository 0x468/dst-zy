#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-check-local-config-script.XXXXXX")"
mkdir -p "$TMP_DIR/work/steam-state" "$TMP_DIR/work/dst" "$TMP_DIR/work/ugc" "$TMP_DIR/work/data"

cp "$REPO_ROOT/.env.example" "$TMP_DIR/work/.env"
sed -i 's/^DST_CLUSTER_NAME=.*/DST_CLUSTER_NAME=Cluster_Z/' "$TMP_DIR/work/.env"
cp -a "$REPO_ROOT/examples" "$TMP_DIR/work/examples"
mkdir -p "$TMP_DIR/work/scripts"
cp "$REPO_ROOT/scripts/init-cluster.sh" "$TMP_DIR/work/scripts/init-cluster.sh"
cp "$REPO_ROOT/scripts/check-local-config.sh" "$TMP_DIR/work/scripts/check-local-config.sh"

(
  cd "$TMP_DIR/work"
  bash scripts/init-cluster.sh Cluster_Z
)

OUTPUT="$(
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh
)"

if ! grep -q 'local config looks ready' <<<"$OUTPUT"; then
  echo "check-local-config.sh should report success for a valid initialized cluster"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

printf '%s\n' 'replace-with-your-klei-cluster-token' > "$TMP_DIR/work/data/Cluster_Z/cluster_token.txt"

if (
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh >/tmp/test-check-local-config.out 2>&1
); then
  echo "check-local-config.sh should fail when cluster_token.txt still has the placeholder value"
  cat /tmp/test-check-local-config.out
  exit 1
fi

if ! grep -q 'cluster_token.txt still contains the example placeholder' /tmp/test-check-local-config.out; then
  echo "check-local-config.sh should explain placeholder token failures"
  cat /tmp/test-check-local-config.out
  exit 1
fi
