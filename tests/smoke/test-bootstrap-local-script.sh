#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-bootstrap-local-script"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/work"

cp "$REPO_ROOT/.env.example" "$TMP_DIR/work/.env.example"
cp -a "$REPO_ROOT/examples" "$TMP_DIR/work/examples"
mkdir -p "$TMP_DIR/work/scripts"
cp "$REPO_ROOT/scripts/init-cluster.sh" "$TMP_DIR/work/scripts/init-cluster.sh"
cp "$REPO_ROOT/scripts/bootstrap-local.sh" "$TMP_DIR/work/scripts/bootstrap-local.sh"

(
  cd "$TMP_DIR/work"
  bash scripts/bootstrap-local.sh Cluster_A
)

required_paths=(
  "$TMP_DIR/work/.env"
  "$TMP_DIR/work/steam-state"
  "$TMP_DIR/work/dst"
  "$TMP_DIR/work/ugc"
  "$TMP_DIR/work/data/Cluster_A/cluster.ini"
  "$TMP_DIR/work/data/Cluster_A/cluster_token.txt"
)

for path in "${required_paths[@]}"; do
  if [ ! -e "$path" ]; then
    echo "missing bootstrapped path: $path"
    exit 1
  fi
done

if ! grep -q '^DST_CLUSTER_NAME=Cluster_A$' "$TMP_DIR/work/.env"; then
  echo ".env should be updated to match requested cluster name"
  cat "$TMP_DIR/work/.env"
  exit 1
fi
