#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-init-cluster-script"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/data"

bash "$REPO_ROOT/scripts/init-cluster.sh" MyCluster "$TMP_DIR/data"

TARGET_DIR="$TMP_DIR/data/MyCluster"

required_files=(
  "$TARGET_DIR/cluster.ini"
  "$TARGET_DIR/cluster_token.txt"
  "$TARGET_DIR/adminlist.txt"
  "$TARGET_DIR/blocklist.txt"
  "$TARGET_DIR/whitelist.txt"
  "$TARGET_DIR/Master/server.ini"
  "$TARGET_DIR/Master/modoverrides.lua"
  "$TARGET_DIR/Caves/server.ini"
  "$TARGET_DIR/Caves/modoverrides.lua"
  "$TARGET_DIR/Caves/leveldataoverride.lua"
  "$TARGET_DIR/mods/dedicated_server_mods_setup.lua"
)

for path in "${required_files[@]}"; do
  if [ ! -f "$path" ]; then
    echo "missing initialized cluster file: $path"
    exit 1
  fi
done

if [ -f "$TARGET_DIR/cluster_token.txt.example" ]; then
  echo "cluster_token.txt.example should be renamed during initialization"
  exit 1
fi

if ! grep -q 'cluster_name = 示例 MyCluster' "$TARGET_DIR/cluster.ini"; then
  echo "cluster.ini should be personalized with the target cluster name"
  cat "$TARGET_DIR/cluster.ini"
  exit 1
fi
