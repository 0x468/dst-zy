#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_PARENT="$REPO_ROOT/.tmp"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

mkdir -p "$TMP_PARENT"
TMP_DIR="$(mktemp -d "$TMP_PARENT/test-entrypoint-steamclient-workaround.XXXXXX")"
mkdir -p "$TMP_DIR/base-steamcmd/linux64"

cp -a "$FIXTURE_DIR" "$TMP_DIR/cluster"
printf '%s\n' 'real-token-value' >"$TMP_DIR/cluster/cluster_token.txt"

cat >"$TMP_DIR/base-steamcmd/steamcmd.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
chmod +x "$TMP_DIR/base-steamcmd/steamcmd.sh"

printf '%s\n' 'steamclient-payload' >"$TMP_DIR/base-steamcmd/linux64/steamclient.so"

cat >"$TMP_DIR/fake-supervisord" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
exit 0
EOF
chmod +x "$TMP_DIR/fake-supervisord"

run_case() {
  local case_name="$1"
  shift
  local case_dir="$TMP_DIR/$case_name"

  rm -rf "$case_dir"
  mkdir -p "$case_dir/data" "$case_dir/dst/bin64" "$case_dir/ugc" "$case_dir/steam-state" "$case_dir/mocks/steamcmd/linux64"
  cp -a "$TMP_DIR/cluster" "$case_dir/data/Cluster_1"
  cp "$TMP_DIR/base-steamcmd/steamcmd.sh" "$case_dir/mocks/steamcmd/steamcmd.sh"
  cp "$TMP_DIR/base-steamcmd/linux64/steamclient.so" "$case_dir/mocks/steamcmd/linux64/steamclient.so"
  cp "$TMP_DIR/fake-supervisord" "$case_dir/mocks/supervisord"

  cat >"$case_dir/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$case_dir/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

  docker run --rm \
    -e DST_CLUSTER_NAME=Cluster_1 \
    -e DST_UPDATE_MODE=never \
    "$@" \
    -v "$case_dir/data:/data" \
    -v "$case_dir/dst:/opt/dst" \
    -v "$case_dir/ugc:/ugc" \
    -v "$case_dir/steam-state:/steam-state" \
    -v "$case_dir/mocks/steamcmd:/usr/local/steamcmd" \
    -v "$case_dir/mocks/supervisord:/usr/bin/supervisord" \
    dst-docker:v1
}

DISABLED_DIR="$TMP_DIR/disabled"
DISABLED_OUTPUT="$(run_case disabled 2>&1)"

if [ -f "$DISABLED_DIR/dst/bin64/steamclient.so" ]; then
  echo "steamclient workaround should stay disabled by default"
  find "$DISABLED_DIR/dst/bin64" -maxdepth 1 -print | sort
  exit 1
fi

if grep -q 'steamclient workaround: copied' <<<"$DISABLED_OUTPUT"; then
  echo "disabled workaround should not report a copy"
  printf '%s\n' "$DISABLED_OUTPUT"
  exit 1
fi

ENABLED_DIR="$TMP_DIR/enabled"
ENABLED_OUTPUT="$(run_case enabled -e DST_EXPERIMENTAL_STEAMCLIENT_WORKAROUND=1 2>&1)"

if [ ! -f "$ENABLED_DIR/dst/bin64/steamclient.so" ]; then
  echo "enabled workaround should copy steamclient.so into the DST runtime directory"
  find "$ENABLED_DIR/dst/bin64" -maxdepth 1 -print | sort
  exit 1
fi

if ! grep -q 'steamclient workaround: copied' <<<"$ENABLED_OUTPUT"; then
  echo "enabled workaround should log where steamclient.so was copied"
  printf '%s\n' "$ENABLED_OUTPUT"
  exit 1
fi

if ! cmp -s "$ENABLED_DIR/dst/bin64/steamclient.so" "$TMP_DIR/base-steamcmd/linux64/steamclient.so"; then
  echo "copied steamclient.so should match the source file"
  exit 1
fi
