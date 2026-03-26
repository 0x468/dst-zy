#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

required_files=(
  "$REPO_ROOT/examples/Cluster_1/cluster.ini"
  "$REPO_ROOT/examples/Cluster_1/cluster_token.txt.example"
  "$REPO_ROOT/examples/Cluster_1/adminlist.txt"
  "$REPO_ROOT/examples/Cluster_1/blocklist.txt"
  "$REPO_ROOT/examples/Cluster_1/whitelist.txt"
  "$REPO_ROOT/examples/Cluster_1/Master/server.ini"
  "$REPO_ROOT/examples/Cluster_1/Master/modoverrides.lua"
  "$REPO_ROOT/examples/Cluster_1/Caves/server.ini"
  "$REPO_ROOT/examples/Cluster_1/Caves/modoverrides.lua"
  "$REPO_ROOT/examples/Cluster_1/Caves/leveldataoverride.lua"
  "$REPO_ROOT/examples/Cluster_1/mods/dedicated_server_mods_setup.lua"
)

for path in "${required_files[@]}"; do
  if [ ! -f "$path" ]; then
    echo "missing example cluster template file: $path"
    exit 1
  fi
done

if ! grep -q 'examples/Cluster_1' "$REPO_ROOT/README.md"; then
  echo "README.md should mention examples/Cluster_1"
  exit 1
fi
