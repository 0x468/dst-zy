#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-real-steamcmd-update-modes.XXXXXX")"
mkdir -p "$TMP_DIR/data" "$TMP_DIR/dst" "$TMP_DIR/ugc" "$TMP_DIR/steam-state" "$TMP_DIR/mocks"

cp -a "$FIXTURE_DIR" "$TMP_DIR/data/Cluster_1"
printf '%s\n' 'real-token-value' >"$TMP_DIR/data/Cluster_1/cluster_token.txt"

cat >"$TMP_DIR/mocks/supervisord" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
chmod +x "$TMP_DIR/mocks/supervisord"

run_mode() {
  local mode="$1"
  local log_path="$TMP_DIR/${mode}.log"

  timeout 1800s docker run --rm \
    -e DST_CLUSTER_NAME=Cluster_1 \
    -e DST_UPDATE_MODE="$mode" \
    -e DST_SERVER_MODS_UPDATE_MODE=skip \
    -v "$TMP_DIR/data:/data" \
    -v "$TMP_DIR/dst:/opt/dst" \
    -v "$TMP_DIR/ugc:/ugc" \
    -v "$TMP_DIR/steam-state:/steam-state" \
    -v "$TMP_DIR/mocks/supervisord:/usr/bin/supervisord" \
    dst-docker:v1 >"$log_path" 2>&1
}

run_mode update

if ! grep -q 'update mode: running SteamCMD app_update' "$TMP_DIR/update.log"; then
  echo "real update run should announce update mode"
  cat "$TMP_DIR/update.log"
  exit 1
fi

if [ ! -x "$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" ]; then
  echo "real update run should leave the DST binary behind"
  find "$TMP_DIR/dst" -maxdepth 3 -print | sort
  exit 1
fi

if [ ! -f "$TMP_DIR/steam-state/steamcmd-app-update.log" ]; then
  echo "real update run should write steamcmd-app-update.log"
  find "$TMP_DIR/steam-state" -maxdepth 3 -print | sort
  exit 1
fi

run_mode validate

if ! grep -q 'validate mode: running SteamCMD app_update validate' "$TMP_DIR/validate.log"; then
  echo "real validate run should announce validate mode"
  cat "$TMP_DIR/validate.log"
  exit 1
fi

if ! grep -Eq "app_update 343050 validate|validate SteamCMD run produced DST binary" "$TMP_DIR/validate.log"; then
  echo "real validate run should exercise the validate path"
  cat "$TMP_DIR/validate.log"
  exit 1
fi

if [ ! -x "$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" ]; then
  echo "real validate run should keep the DST binary available"
  find "$TMP_DIR/dst" -maxdepth 3 -print | sort
  exit 1
fi

printf 'slow steamcmd update/validate regression passed under %s\n' "$TMP_DIR"
