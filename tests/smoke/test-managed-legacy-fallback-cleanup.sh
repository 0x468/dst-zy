#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-managed-legacy-fallback-cleanup"
FIXTURE_DIR="$REPO_ROOT/tests/fixtures/Cluster_1"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/data" "$TMP_DIR/dst/mods" "$TMP_DIR/ugc/content/322330/111111111"

cp -a "$FIXTURE_DIR" "$TMP_DIR/data/Cluster_1"
cp "$REPO_ROOT/.local-notes/key.txt" "$TMP_DIR/data/Cluster_1/cluster_token.txt"
mkdir -p "$TMP_DIR/data/Cluster_1/mods"

cat > "$TMP_DIR/data/Cluster_1/mods/dedicated_server_mods_setup.lua" <<'EOF'
ServerModSetup("workshop-111111111")
EOF

mkdir -p "$TMP_DIR/dst/bin64"
cat > "$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$TMP_DIR/dst/bin64/dontstarve_dedicated_server_nullrenderer_x64"

mkdir -p "$TMP_DIR/dst/mods/workshop-111111111"
touch "$TMP_DIR/dst/mods/workshop-111111111/.dst-docker-legacy-fallback"
mkdir -p "$TMP_DIR/dst/mods/workshop-222222222"
touch "$TMP_DIR/dst/mods/workshop-222222222/.dst-docker-legacy-fallback"
mkdir -p "$TMP_DIR/dst/mods/.legacy-api.stale"
mkdir -p "$TMP_DIR/dst/mods/.legacy-fallback-stale"

set +e
timeout 20s docker run --rm \
  -e DST_UPDATE_MODE=never \
  -e DST_SERVER_MODS_UPDATE_MODE=skip \
  -v "$TMP_DIR/data:/data" \
  -v "$TMP_DIR/dst:/opt/dst" \
  -v "$TMP_DIR/ugc:/ugc" \
  -v "$TMP_DIR/steam-state:/steam-state" \
  dst-docker:v1 >"$TMP_DIR/out.log" 2>&1
status=$?
set -e

if [ "$status" -ne 124 ]; then
  echo "expected timeout after supervisord starts dummy shard processes"
  cat "$TMP_DIR/out.log"
  exit 1
fi

if [ -d "$TMP_DIR/dst/mods/workshop-111111111" ]; then
  echo "expected managed fallback to be removed once UGC cache exists"
  find "$TMP_DIR/dst/mods" -maxdepth 2 -print | sort
  exit 1
fi

if [ -d "$TMP_DIR/dst/mods/workshop-222222222" ]; then
  echo "expected stale managed fallback to be removed when no longer declared"
  find "$TMP_DIR/dst/mods" -maxdepth 2 -print | sort
  exit 1
fi

if [ -d "$TMP_DIR/dst/mods/.legacy-api.stale" ] || [ -d "$TMP_DIR/dst/mods/.legacy-fallback-stale" ]; then
  echo "expected managed legacy temp directories to be cleaned up"
  find "$TMP_DIR/dst/mods" -maxdepth 2 -print | sort
  exit 1
fi
