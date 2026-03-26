#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_ENV="$REPO_ROOT/.env"

cleanup() {
  rm -f "$TMP_ENV"
}
trap cleanup EXIT

cp "$REPO_ROOT/.env.example" "$TMP_ENV"

cat >> "$TMP_ENV" <<'EOF'
DST_MASTER_HOST_PORT=12000
DST_CAVES_HOST_PORT=12001
DST_STEAM_HOST_PORT=28015
EOF

OUTPUT="$(
  cd "$REPO_ROOT" &&
  docker compose config
)"

for published_port in 'published: "12000"' 'published: "12001"' 'published: "28015"'; do
  if ! grep -q "$published_port" <<<"$OUTPUT"; then
    echo "docker compose config did not render expected field: $published_port"
    printf '%s\n' "$OUTPUT"
    exit 1
  fi
done
