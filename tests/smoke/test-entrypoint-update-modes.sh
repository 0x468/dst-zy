#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-entrypoint-update-modes.XXXXXX")"
mkdir -p "$TMP_DIR/mocks"

cp -a "$FIXTURE_DIR" "$TMP_DIR/cluster"
printf '%s\n' 'real-token-value' >"$TMP_DIR/cluster/cluster_token.txt"

cat >"$TMP_DIR/mocks/steamcmd.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' "$*" >> /mocks/steamcmd.log
mkdir -p /opt/dst/bin64
cat > /opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64 <<'BIN'
#!/usr/bin/env bash
exit 0
BIN
chmod +x /opt/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64
EOF
chmod +x "$TMP_DIR/mocks/steamcmd.sh"

cat >"$TMP_DIR/mocks/supervisord" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'DST_SERVER_BINARY=%s\n' "${DST_SERVER_BINARY:-}" > /mocks/supervisord.log
printf 'DST_SERVER_EXTRA_ARGS=%s\n' "${DST_SERVER_EXTRA_ARGS:-}" >> /mocks/supervisord.log
exit 0
EOF
chmod +x "$TMP_DIR/mocks/supervisord"

run_case() {
  local case_name="$1"
  local preserve_dst="${2:-0}"
  if [ "$#" -ge 2 ]; then
    shift
  fi
  shift
  local case_dir="$TMP_DIR/$case_name"

  rm -rf "$case_dir/data" "$case_dir/ugc" "$case_dir/steam-state" "$case_dir/mocks"
  if [ "$preserve_dst" != "1" ]; then
    rm -rf "$case_dir/dst"
  fi
  mkdir -p "$case_dir/data" "$case_dir/dst" "$case_dir/ugc" "$case_dir/steam-state" "$case_dir/mocks"
  cp -a "$TMP_DIR/cluster" "$case_dir/data/Cluster_1"
  cp "$TMP_DIR/mocks/steamcmd.sh" "$case_dir/mocks/steamcmd.sh"
  cp "$TMP_DIR/mocks/supervisord" "$case_dir/mocks/supervisord"

  docker run --rm \
    -e DST_CLUSTER_NAME=Cluster_1 \
    "$@" \
    -v "$case_dir/data:/data" \
    -v "$case_dir/dst:/opt/dst" \
    -v "$case_dir/ugc:/ugc" \
    -v "$case_dir/steam-state:/steam-state" \
    -v "$case_dir/mocks:/mocks" \
    -v "$case_dir/mocks/steamcmd.sh:/usr/local/steamcmd/steamcmd.sh" \
    -v "$case_dir/mocks/supervisord:/usr/bin/supervisord" \
    dst-docker:v1
}

INSTALL_ONLY_DIR="$TMP_DIR/install-only-missing"
INSTALL_ONLY_OUTPUT="$(run_case install-only-missing 0 -e DST_UPDATE_MODE=install-only 2>&1)"

if ! grep -q 'install-only mode: DST binary not present, installing via SteamCMD' <<<"$INSTALL_ONLY_OUTPUT"; then
  echo "install-only should install when DST binary is missing"
  printf '%s\n' "$INSTALL_ONLY_OUTPUT"
  exit 1
fi

if [ ! -x "$INSTALL_ONLY_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" ]; then
  echo "install-only should leave a DST binary behind after SteamCMD runs"
  find "$INSTALL_ONLY_DIR/dst" -maxdepth 3 -print | sort
  exit 1
fi

if ! grep -q '+app_update 343050 +quit' "$INSTALL_ONLY_DIR/mocks/steamcmd.log"; then
  echo "install-only should call SteamCMD app_update"
  cat "$INSTALL_ONLY_DIR/mocks/steamcmd.log"
  exit 1
fi

SKIP_INSTALL_DIR="$TMP_DIR/install-only-existing"
mkdir -p "$SKIP_INSTALL_DIR/dst/bin64"
cat >"$SKIP_INSTALL_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$SKIP_INSTALL_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

SKIP_INSTALL_OUTPUT="$(run_case install-only-existing 1 -e DST_UPDATE_MODE=install-only 2>&1)"

if ! grep -q 'install-only mode: DST binary already present' <<<"$SKIP_INSTALL_OUTPUT"; then
  echo "install-only should skip SteamCMD when DST binary already exists"
  printf '%s\n' "$SKIP_INSTALL_OUTPUT"
  exit 1
fi

if [ -f "$SKIP_INSTALL_DIR/mocks/steamcmd.log" ]; then
  echo "install-only should not call SteamCMD when DST binary already exists"
  cat "$SKIP_INSTALL_DIR/mocks/steamcmd.log"
  exit 1
fi

UPDATE_DIR="$TMP_DIR/update-mode"
mkdir -p "$UPDATE_DIR/dst/bin64"
cat >"$UPDATE_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$UPDATE_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

UPDATE_OUTPUT="$(run_case update-mode 1 -e DST_UPDATE_MODE=update 2>&1)"

if ! grep -q 'update mode: running SteamCMD app_update' <<<"$UPDATE_OUTPUT"; then
  echo "update mode should always run SteamCMD"
  printf '%s\n' "$UPDATE_OUTPUT"
  exit 1
fi

if ! grep -q '+app_update 343050 +quit' "$UPDATE_DIR/mocks/steamcmd.log"; then
  echo "update mode should call SteamCMD without validate"
  cat "$UPDATE_DIR/mocks/steamcmd.log"
  exit 1
fi

VALIDATE_DIR="$TMP_DIR/validate-mode"
mkdir -p "$VALIDATE_DIR/dst/bin64"
cat >"$VALIDATE_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$VALIDATE_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

VALIDATE_OUTPUT="$(run_case validate-mode 1 -e DST_UPDATE_MODE=validate 2>&1)"

if ! grep -q 'validate mode: running SteamCMD app_update validate' <<<"$VALIDATE_OUTPUT"; then
  echo "validate mode should announce validate"
  printf '%s\n' "$VALIDATE_OUTPUT"
  exit 1
fi

if ! grep -q '+app_update 343050 validate +quit' "$VALIDATE_DIR/mocks/steamcmd.log"; then
  echo "validate mode should pass validate to SteamCMD"
  cat "$VALIDATE_DIR/mocks/steamcmd.log"
  exit 1
fi

set +e
NEVER_OUTPUT="$(run_case never-missing 0 -e DST_UPDATE_MODE=never 2>&1)"
NEVER_STATUS=$?
set -e

if [ "$NEVER_STATUS" -eq 0 ]; then
  echo "never mode should fail when DST binary is missing"
  printf '%s\n' "$NEVER_OUTPUT"
  exit 1
fi

if ! grep -q "update mode 'never' requires DST binary" <<<"$NEVER_OUTPUT"; then
  echo "never mode should explain the missing DST binary requirement"
  printf '%s\n' "$NEVER_OUTPUT"
  exit 1
fi

set +e
BAD_MODE_OUTPUT="$(run_case bad-mode 0 -e DST_UPDATE_MODE=broken 2>&1)"
BAD_MODE_STATUS=$?
set -e

if [ "$BAD_MODE_STATUS" -eq 0 ]; then
  echo "unknown update mode should fail"
  printf '%s\n' "$BAD_MODE_OUTPUT"
  exit 1
fi

if ! grep -q "unknown DST_UPDATE_MODE 'broken'" <<<"$BAD_MODE_OUTPUT"; then
  echo "unknown update mode should explain the invalid value"
  printf '%s\n' "$BAD_MODE_OUTPUT"
  exit 1
fi
