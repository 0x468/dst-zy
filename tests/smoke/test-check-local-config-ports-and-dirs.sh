#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-check-local-config-ports-and-dirs"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/work/steam-state" "$TMP_DIR/work/dst" "$TMP_DIR/work/ugc" "$TMP_DIR/work/data"

cp "$REPO_ROOT/.env.example" "$TMP_DIR/work/.env"
sed -i 's/^DST_CLUSTER_NAME=.*/DST_CLUSTER_NAME=Cluster_P/' "$TMP_DIR/work/.env"
cp -a "$REPO_ROOT/examples" "$TMP_DIR/work/examples"
mkdir -p "$TMP_DIR/work/scripts"
cp "$REPO_ROOT/scripts/init-cluster.sh" "$TMP_DIR/work/scripts/init-cluster.sh"
cp "$REPO_ROOT/scripts/check-local-config.sh" "$TMP_DIR/work/scripts/check-local-config.sh"

(
  cd "$TMP_DIR/work"
  bash scripts/init-cluster.sh Cluster_P
)

printf '%s\n' 'real-token-value' > "$TMP_DIR/work/data/Cluster_P/cluster_token.txt"
sed -i 's/^cluster_key = .*/cluster_key = real-cluster-key/' "$TMP_DIR/work/data/Cluster_P/cluster.ini"

rm -rf "$TMP_DIR/work/ugc"
if (
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh >/tmp/test-check-local-config-dirs.out 2>&1
); then
  echo "check-local-config.sh should fail when a required runtime directory is missing"
  cat /tmp/test-check-local-config-dirs.out
  exit 1
fi

if ! grep -q 'missing required runtime directory' /tmp/test-check-local-config-dirs.out; then
  echo "check-local-config.sh should explain missing runtime directory failures"
  cat /tmp/test-check-local-config-dirs.out
  exit 1
fi

mkdir -p "$TMP_DIR/work/ugc"
sed -i 's/^DST_MASTER_HOST_PORT=.*/DST_MASTER_HOST_PORT=99999/' "$TMP_DIR/work/.env"

if (
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh >/tmp/test-check-local-config-ports.out 2>&1
); then
  echo "check-local-config.sh should fail when a configured host port is invalid"
  cat /tmp/test-check-local-config-ports.out
  exit 1
fi

if ! grep -q 'invalid host port value' /tmp/test-check-local-config-ports.out; then
  echo "check-local-config.sh should explain invalid port failures"
  cat /tmp/test-check-local-config-ports.out
  exit 1
fi

sed -i 's/^DST_MASTER_HOST_PORT=.*/DST_MASTER_HOST_PORT=12000/' "$TMP_DIR/work/.env"
sed -i 's/^DST_CAVES_HOST_PORT=.*/DST_CAVES_HOST_PORT=12000/' "$TMP_DIR/work/.env"

if (
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh >/tmp/test-check-local-config-host-collision.out 2>&1
); then
  echo "check-local-config.sh should fail when host UDP ports collide"
  cat /tmp/test-check-local-config-host-collision.out
  exit 1
fi

if ! grep -q 'host port values must be different' /tmp/test-check-local-config-host-collision.out; then
  echo "check-local-config.sh should explain host port collisions"
  cat /tmp/test-check-local-config-host-collision.out
  exit 1
fi
