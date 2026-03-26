#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing .env at $ENV_FILE" >&2
  exit 1
fi

cluster_name="$(awk -F= '$1=="DST_CLUSTER_NAME"{print $2}' "$ENV_FILE" | tail -n 1)"
if [ -z "$cluster_name" ]; then
  echo "DST_CLUSTER_NAME is missing from .env" >&2
  exit 1
fi

cluster_dir="$REPO_ROOT/data/$cluster_name"
required_files=(
  "$cluster_dir/cluster.ini"
  "$cluster_dir/cluster_token.txt"
  "$cluster_dir/Master/server.ini"
  "$cluster_dir/Caves/server.ini"
)

for path in "${required_files[@]}"; do
  if [ ! -f "$path" ]; then
    echo "missing required local config file: $path" >&2
    exit 1
  fi
done

token_value="$(tr -d '\r\n' <"$cluster_dir/cluster_token.txt")"
if [ -z "$token_value" ]; then
  echo "cluster_token.txt is empty: $cluster_dir/cluster_token.txt" >&2
  exit 1
fi

if [ "$token_value" = 'replace-with-your-klei-cluster-token' ]; then
  echo "cluster_token.txt still contains the example placeholder: $cluster_dir/cluster_token.txt" >&2
  exit 1
fi

printf 'local config looks ready for cluster %s\n' "$cluster_name"
