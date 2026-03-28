#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROL_PLANE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_DIR="$CONTROL_PLANE_ROOT/tests/fixtures/clusters/import-bare"
TMP_DIR="$(mktemp -d /tmp/dst-control-plane-import.XXXXXX)"
SERVER_NAME="dst-control-plane-e2e-import"
COOKIE_JAR="$TMP_DIR/cookies.txt"
API_URL="http://127.0.0.1:18081"
mkdir -p "$CONTROL_PLANE_ROOT/.tmp"
DATA_ROOT_HOST="$(mktemp -d "$CONTROL_PLANE_ROOT/.tmp/e2e-import-data.XXXXXX")"
DATA_ROOT_CONTAINER="/workspace/.tmp/$(basename "$DATA_ROOT_HOST")"
IMPORT_SOURCE="$DATA_ROOT_HOST/import-source"
IMPORT_SOURCE_CONTAINER="$DATA_ROOT_CONTAINER/import-source"

mkdir -p "$IMPORT_SOURCE/Master" "$IMPORT_SOURCE/Caves"

cp "$FIXTURE_DIR/cluster.ini" "$IMPORT_SOURCE/cluster.ini"
cp "$FIXTURE_DIR/server-master.ini" "$IMPORT_SOURCE/Master/server.ini"
cp "$FIXTURE_DIR/server-caves.ini" "$IMPORT_SOURCE/Caves/server.ini"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "import-cluster e2e failed; container logs:" >&2
    docker logs "$SERVER_NAME" >&2 || true
  fi
  docker rm -f "$SERVER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$DATA_ROOT_HOST"
  exit "$status"
}
trap cleanup EXIT

docker run -d \
  --name "$SERVER_NAME" \
  -p 18081:18081 \
  -v "$CONTROL_PLANE_ROOT":/workspace \
  -w /workspace/api \
  -e GOPROXY=https://goproxy.cn,direct \
  -e DST_CONTROL_PLANE_LISTEN_ADDR=:18081 \
  -e DST_CONTROL_PLANE_DATA_ROOT="$DATA_ROOT_CONTAINER" \
  -e DST_CONTROL_PLANE_ADMIN_USERNAME=admin \
  -e DST_CONTROL_PLANE_ADMIN_PASSWORD=secret \
  -e DST_CONTROL_PLANE_SESSION_SECRET=0123456789abcdef0123456789abcdef \
  -e DST_CONTROL_PLANE_EXECUTION_MODE=dry-run \
  golang:1.26.1-bookworm \
  go run ./cmd/server >/dev/null

for _ in $(seq 1 90); do
  if curl -fsS "$API_URL/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "$API_URL/healthz" >/dev/null

curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"secret"}' \
  "$API_URL/api/login" >/dev/null

IMPORT_PAYLOAD=$(printf '{"mode":"import","slug":"imported-a","display_name":"Imported A","cluster_name":"Imported_A","base_dir":"%s"}' "$IMPORT_SOURCE_CONTAINER")

curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d "$IMPORT_PAYLOAD" \
  "$API_URL/api/clusters" >"$TMP_DIR/import.json"

grep -q '"slug":"imported-a"' "$TMP_DIR/import.json"

curl -fsS -b "$COOKIE_JAR" "$API_URL/api/clusters/imported-a/config" >"$TMP_DIR/config.json"
grep -q '"cluster_name":"Imported_A"' "$TMP_DIR/config.json"

SAVE_PAYLOAD='{"cluster_name":"Imported_A","cluster_description":"Updated imported cluster","game_mode":"survival","cluster_key":"import-key","master_port":10889,"master":{"server_port":11000,"master_server_port":27018,"authentication_port":8768},"caves":{"server_port":11001,"master_server_port":27019,"authentication_port":8769}}'

curl -fsS -b "$COOKIE_JAR" -X PUT -H 'Content-Type: application/json' \
  -d "$SAVE_PAYLOAD" \
  "$API_URL/api/clusters/imported-a/config" >/dev/null

curl -fsS -b "$COOKIE_JAR" -X POST -H 'Content-Type: application/json' \
  -d '{"action":"stop"}' \
  "$API_URL/api/clusters/imported-a/actions" >"$TMP_DIR/action.json"

grep -q '"job_type":"stop"' "$TMP_DIR/action.json"

curl -fsS -b "$COOKIE_JAR" "$API_URL/api/jobs" >"$TMP_DIR/jobs.json"
grep -q '"status":"succeeded"' "$TMP_DIR/jobs.json"

printf 'import cluster e2e passed\n'
