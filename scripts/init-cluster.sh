#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLE_DIR="$REPO_ROOT/examples/Cluster_1"

cluster_name="${1:-}"
data_root="${2:-$REPO_ROOT/data}"

if [ -z "$cluster_name" ]; then
  echo "usage: bash scripts/init-cluster.sh <cluster-name> [data-root]" >&2
  exit 1
fi

target_dir="$data_root/$cluster_name"

if [ -e "$target_dir" ]; then
  echo "target cluster directory already exists: $target_dir" >&2
  exit 1
fi

mkdir -p "$data_root"
cp -a "$EXAMPLE_DIR" "$target_dir"

mv "$target_dir/cluster_token.txt.example" "$target_dir/cluster_token.txt"
sed -i "s/^cluster_name = .*/cluster_name = 示例 $cluster_name/" "$target_dir/cluster.ini"

printf 'initialized cluster template at %s\n' "$target_dir"
printf 'next step: edit %s/cluster_token.txt and fill in your real Klei token\n' "$target_dir"
