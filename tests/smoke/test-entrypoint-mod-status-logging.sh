#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-entrypoint-mod-status-logging.XXXXXX")"

cp -a "$FIXTURE_DIR" "$TMP_DIR/cluster"
printf '%s\n' 'real-token-value' >"$TMP_DIR/cluster/cluster_token.txt"
mkdir -p "$TMP_DIR/cluster/mods"
cat >"$TMP_DIR/cluster/mods/dedicated_server_mods_setup.lua" <<'EOF'
ServerModSetup("workshop-111111111")
ServerModSetup("workshop-222222222")
ServerModSetup("workshop-333333333")
ServerModSetup("workshop-444444444")
EOF

mkdir -p "$TMP_DIR/fallback-src"
cat >"$TMP_DIR/fallback-src/modinfo.lua" <<'EOF'
name = "Smoke Fallback Mod"
description = "fallback test"
author = "codex"
version = "1.0.0"
EOF
cat >"$TMP_DIR/fallback-src/modmain.lua" <<'EOF'
print("fallback loaded")
EOF
python3 - <<PY
import zipfile
with zipfile.ZipFile(r"$TMP_DIR/workshop-444444444.zip", "w") as zf:
    zf.write(r"$TMP_DIR/fallback-src/modinfo.lua", "modinfo.lua")
    zf.write(r"$TMP_DIR/fallback-src/modmain.lua", "modmain.lua")
PY

cat >"$TMP_DIR/fake-curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

output_path=""
args=("$@")
for ((i=0; i<${#args[@]}; i++)); do
  if [ "${args[$i]}" = "-o" ]; then
    output_path="${args[$((i + 1))]}"
  fi
done

request="${args[*]}"

if [[ "$request" == *"GetPublishedFileDetails"* ]]; then
  cat >"$output_path" <<'JSON'
{
  "response": {
    "publishedfiledetails": [
      {
        "publishedfileid": "333333333",
        "result": 1,
        "consumer_app_id": 322330,
        "file_url": ""
      },
      {
        "publishedfileid": "444444444",
        "result": 1,
        "consumer_app_id": 322330,
        "file_url": "https://example.invalid/workshop-444444444.zip"
      }
    ]
  }
}
JSON
  exit 0
fi

if [[ "$request" == *"https://example.invalid/workshop-444444444.zip"* ]]; then
  cp /mocks/workshop-444444444.zip "$output_path"
  exit 0
fi

echo "unexpected curl invocation: $request" >&2
exit 1
EOF
chmod +x "$TMP_DIR/fake-curl"

cat >"$TMP_DIR/fake-supervisord" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
chmod +x "$TMP_DIR/fake-supervisord"

mkdir -p "$TMP_DIR/data" "$TMP_DIR/dst/bin64" "$TMP_DIR/dst/mods/workshop-222222222" "$TMP_DIR/ugc/content/322330/111111111" "$TMP_DIR/steam-state" "$TMP_DIR/mocks"
cp -a "$TMP_DIR/cluster" "$TMP_DIR/data/Cluster_1"
cp "$TMP_DIR/fake-curl" "$TMP_DIR/mocks/curl"
cp "$TMP_DIR/fake-supervisord" "$TMP_DIR/mocks/supervisord"
cp "$TMP_DIR/workshop-444444444.zip" "$TMP_DIR/mocks/workshop-444444444.zip"

cat >"$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

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
    -v "$TMP_DIR/mocks:/mocks" \
    dst-docker:v1 2>&1
)"

for expected_log in \
  'server mods status: ugc-hit workshop-111111111' \
  'server mods status: local-hit workshop-222222222' \
  'server mods status: legacy-fallback-metadata-missing workshop-333333333' \
  'server mods status: legacy-fallback-installed workshop-444444444'
do
  if ! grep -q "$expected_log" <<<"$OUTPUT"; then
    echo "expected structured mod status log missing: $expected_log"
    printf '%s\n' "$OUTPUT"
    exit 1
  fi
done
