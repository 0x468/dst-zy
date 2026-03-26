#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cluster_name="${1:-Cluster_1}"

mkdir -p "$REPO_ROOT/steam-state" "$REPO_ROOT/dst" "$REPO_ROOT/ugc" "$REPO_ROOT/data"

if [ ! -f "$REPO_ROOT/.env" ]; then
  cp "$REPO_ROOT/.env.example" "$REPO_ROOT/.env"
fi

while IFS= read -r example_line; do
  case "$example_line" in
    ''|'#'*)
      continue
      ;;
    *=*)
      example_key="${example_line%%=*}"
      if ! grep -q "^${example_key}=" "$REPO_ROOT/.env"; then
        printf '%s\n' "$example_line" >>"$REPO_ROOT/.env"
      fi
      ;;
  esac
done <"$REPO_ROOT/.env.example"

if grep -q '^DST_CLUSTER_NAME=' "$REPO_ROOT/.env"; then
  sed -i "s/^DST_CLUSTER_NAME=.*/DST_CLUSTER_NAME=$cluster_name/" "$REPO_ROOT/.env"
else
  printf '\nDST_CLUSTER_NAME=%s\n' "$cluster_name" >>"$REPO_ROOT/.env"
fi

if [ ! -d "$REPO_ROOT/data/$cluster_name" ]; then
  bash "$SCRIPT_DIR/init-cluster.sh" "$cluster_name" "$REPO_ROOT/data"
fi

printf 'bootstrapped local runtime under %s\n' "$REPO_ROOT"
