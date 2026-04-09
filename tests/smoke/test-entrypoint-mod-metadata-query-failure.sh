#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-entrypoint-mod-metadata-query-failure.XXXXXX")"

cp -a "$FIXTURE_DIR" "$TMP_DIR/cluster"
printf '%s\n' 'real-token-value' >"$TMP_DIR/cluster/cluster_token.txt"
mkdir -p "$TMP_DIR/cluster/mods"
cat >"$TMP_DIR/cluster/mods/dedicated_server_mods_setup.lua" <<'EOF'
ServerModSetup("workshop-333333333")
ServerModSetup("workshop-444444444")
EOF

cat >"$TMP_DIR/fake-curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "curl: (28) Failed to connect to api.steampowered.com port 443 after 21058 ms: Could not connect to server" >&2
exit 28
EOF
chmod +x "$TMP_DIR/fake-curl"

cat >"$TMP_DIR/fake-supervisord" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'supervisord-started\n'
exit 0
EOF
chmod +x "$TMP_DIR/fake-supervisord"

mkdir -p "$TMP_DIR/data" "$TMP_DIR/dst/bin64" "$TMP_DIR/ugc" "$TMP_DIR/steam-state" "$TMP_DIR/mocks"
cp -a "$TMP_DIR/cluster" "$TMP_DIR/data/Cluster_1"
cp "$TMP_DIR/fake-curl" "$TMP_DIR/mocks/curl"
cp "$TMP_DIR/fake-supervisord" "$TMP_DIR/mocks/supervisord"

cat >"$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

set +e
OUTPUT="$(
  docker run --rm \
    -e DST_CLUSTER_NAME=Cluster_1 \
    -e DST_UPDATE_MODE=never \
    -e DST_SERVER_MODS_UPDATE_MODE=runtime \
    -v "$TMP_DIR/data:/data" \
    -v "$TMP_DIR/dst:/opt/dst" \
    -v "$TMP_DIR/ugc:/ugc" \
    -v "$TMP_DIR/steam-state:/steam-state" \
    -v "$TMP_DIR/mocks/curl:/usr/bin/curl" \
    -v "$TMP_DIR/mocks/supervisord:/usr/bin/supervisord" \
    dst-docker:v1 2>&1
)"
STATUS=$?
set -e

if [ "$STATUS" -ne 0 ]; then
  echo "metadata query failure should not block runtime startup"
  printf '%s\n' "$OUTPUT"
  exit 1
fi

for expected_log in \
  'server mods: querying Steam metadata for missing ids workshop-333333333 workshop-444444444' \
  'server mods: Steam metadata query failed; continuing without legacy fallback (status=28)' \
  'server mods status: legacy-fallback-query-failed workshop-333333333 status=28' \
  'server mods status: legacy-fallback-query-failed workshop-444444444 status=28' \
  'entrypoint: starting supervisord' \
  'supervisord-started'
do
  if ! grep -q "$expected_log" <<<"$OUTPUT"; then
    echo "expected log missing after metadata query failure: $expected_log"
    printf '%s\n' "$OUTPUT"
    exit 1
  fi
done
