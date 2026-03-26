#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-entrypoint-server-mod-modes.XXXXXX")"

cp -a "$FIXTURE_DIR" "$TMP_DIR/cluster"
printf '%s\n' 'real-token-value' >"$TMP_DIR/cluster/cluster_token.txt"
mkdir -p "$TMP_DIR/cluster/mods"
cat >"$TMP_DIR/cluster/mods/dedicated_server_mods_setup.lua" <<'EOF'
ServerModSetup("workshop-111111111")
EOF

cat >"$TMP_DIR/fake-dst-binary" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> /mocks/dst-binary.log
exit 0
EOF
chmod +x "$TMP_DIR/fake-dst-binary"

cat >"$TMP_DIR/fake-supervisord" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'DST_SERVER_EXTRA_ARGS=%s\n' "${DST_SERVER_EXTRA_ARGS:-}" > /mocks/supervisord.log
exit 0
EOF
chmod +x "$TMP_DIR/fake-supervisord"

run_case() {
  local case_name="$1"
  shift
  local case_dir="$TMP_DIR/$case_name"

  rm -rf "$case_dir"
  mkdir -p "$case_dir/data" "$case_dir/dst/bin64" "$case_dir/ugc/content/322330/111111111" "$case_dir/steam-state" "$case_dir/mocks"
  cp -a "$TMP_DIR/cluster" "$case_dir/data/Cluster_1"
  cp "$TMP_DIR/fake-dst-binary" "$case_dir/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"
  cp "$TMP_DIR/fake-supervisord" "$case_dir/mocks/supervisord"

  docker run --rm \
    -e DST_CLUSTER_NAME=Cluster_1 \
    -e DST_UPDATE_MODE=never \
    "$@" \
    -v "$case_dir/data:/data" \
    -v "$case_dir/dst:/opt/dst" \
    -v "$case_dir/ugc:/ugc" \
    -v "$case_dir/steam-state:/steam-state" \
    -v "$case_dir/mocks:/mocks" \
    -v "$case_dir/mocks/supervisord:/usr/bin/supervisord" \
    dst-docker:v1
}

RUNTIME_DIR="$TMP_DIR/runtime"
RUNTIME_OUTPUT="$(run_case runtime -e DST_SERVER_MODS_UPDATE_MODE=runtime 2>&1)"

if ! grep -q 'server mods: runtime mode; shard processes will update mods themselves' <<<"$RUNTIME_OUTPUT"; then
  echo "runtime mode should announce runtime behavior"
  printf '%s\n' "$RUNTIME_OUTPUT"
  exit 1
fi

if [ -f "$RUNTIME_DIR/mocks/dst-binary.log" ]; then
  echo "runtime mode should not prewarm server mods"
  cat "$RUNTIME_DIR/mocks/dst-binary.log"
  exit 1
fi

if ! grep -q '^DST_SERVER_EXTRA_ARGS=$' "$RUNTIME_DIR/mocks/supervisord.log"; then
  echo "runtime mode should leave DST_SERVER_EXTRA_ARGS empty"
  cat "$RUNTIME_DIR/mocks/supervisord.log"
  exit 1
fi

PREWARM_DIR="$TMP_DIR/prewarm"
PREWARM_OUTPUT="$(run_case prewarm -e DST_SERVER_MODS_UPDATE_MODE=prewarm 2>&1)"

if ! grep -q 'server mods: prewarm finished; shard processes will reuse cache via -skip_update_server_mods' <<<"$PREWARM_OUTPUT"; then
  echo "prewarm mode should announce reuse via skip flag"
  printf '%s\n' "$PREWARM_OUTPUT"
  exit 1
fi

if ! grep -q -- '-only_update_server_mods' "$PREWARM_DIR/mocks/dst-binary.log"; then
  echo "prewarm mode should call DST binary with -only_update_server_mods"
  cat "$PREWARM_DIR/mocks/dst-binary.log"
  exit 1
fi

if ! grep -q '^DST_SERVER_EXTRA_ARGS=-skip_update_server_mods$' "$PREWARM_DIR/mocks/supervisord.log"; then
  echo "prewarm mode should export -skip_update_server_mods to supervisord"
  cat "$PREWARM_DIR/mocks/supervisord.log"
  exit 1
fi

SKIP_DIR="$TMP_DIR/skip"
SKIP_OUTPUT="$(run_case skip -e DST_SERVER_MODS_UPDATE_MODE=skip 2>&1)"

if ! grep -q 'server mods: skip mode; shard processes will trust existing UGC cache' <<<"$SKIP_OUTPUT"; then
  echo "skip mode should announce cache trust behavior"
  printf '%s\n' "$SKIP_OUTPUT"
  exit 1
fi

if [ -f "$SKIP_DIR/mocks/dst-binary.log" ]; then
  echo "skip mode should not prewarm server mods"
  cat "$SKIP_DIR/mocks/dst-binary.log"
  exit 1
fi

if ! grep -q '^DST_SERVER_EXTRA_ARGS=-skip_update_server_mods$' "$SKIP_DIR/mocks/supervisord.log"; then
  echo "skip mode should export -skip_update_server_mods to supervisord"
  cat "$SKIP_DIR/mocks/supervisord.log"
  exit 1
fi

set +e
BAD_MODE_OUTPUT="$(run_case bad-mode -e DST_SERVER_MODS_UPDATE_MODE=broken 2>&1)"
BAD_MODE_STATUS=$?
set -e

if [ "$BAD_MODE_STATUS" -eq 0 ]; then
  echo "unknown server mod mode should fail"
  printf '%s\n' "$BAD_MODE_OUTPUT"
  exit 1
fi

if ! grep -q "unknown DST_SERVER_MODS_UPDATE_MODE 'broken'" <<<"$BAD_MODE_OUTPUT"; then
  echo "unknown server mod mode should explain the invalid value"
  printf '%s\n' "$BAD_MODE_OUTPUT"
  exit 1
fi
