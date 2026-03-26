#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-check-local-config-shard-settings.XXXXXX")"
mkdir -p "$TMP_DIR/work/steam-state" "$TMP_DIR/work/dst" "$TMP_DIR/work/ugc" "$TMP_DIR/work/data"

cp "$REPO_ROOT/.env.example" "$TMP_DIR/work/.env"
sed -i 's/^DST_CLUSTER_NAME=.*/DST_CLUSTER_NAME=Cluster_Shard/' "$TMP_DIR/work/.env"
cp -a "$REPO_ROOT/examples" "$TMP_DIR/work/examples"
mkdir -p "$TMP_DIR/work/scripts"
cp "$REPO_ROOT/scripts/init-cluster.sh" "$TMP_DIR/work/scripts/init-cluster.sh"
cp "$REPO_ROOT/scripts/check-local-config.sh" "$TMP_DIR/work/scripts/check-local-config.sh"

(
  cd "$TMP_DIR/work"
  bash scripts/init-cluster.sh Cluster_Shard
)

printf '%s\n' 'real-token-value' > "$TMP_DIR/work/data/Cluster_Shard/cluster_token.txt"

if (
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh >/tmp/test-check-local-config-shard.out 2>&1
); then
  echo "check-local-config.sh should fail when cluster.ini still has the example cluster_key"
  cat /tmp/test-check-local-config-shard.out
  exit 1
fi

if ! grep -q 'cluster.ini still contains the example cluster_key' /tmp/test-check-local-config-shard.out; then
  echo "check-local-config.sh should explain cluster_key placeholder failures"
  cat /tmp/test-check-local-config-shard.out
  exit 1
fi

sed -i 's/^cluster_key = .*/cluster_key = real-cluster-key/' "$TMP_DIR/work/data/Cluster_Shard/cluster.ini"
sed -i 's/^server_port = .*/server_port = 11000/' "$TMP_DIR/work/data/Cluster_Shard/Caves/server.ini"

if (
  cd "$TMP_DIR/work" &&
  bash scripts/check-local-config.sh >/tmp/test-check-local-config-shard-ports.out 2>&1
); then
  echo "check-local-config.sh should fail when Master and Caves server_port collide"
  cat /tmp/test-check-local-config-shard-ports.out
  exit 1
fi

if ! grep -q 'Master/Caves server_port values must be different' /tmp/test-check-local-config-shard-ports.out; then
  echo "check-local-config.sh should explain shard port collisions"
  cat /tmp/test-check-local-config-shard-ports.out
  exit 1
fi
