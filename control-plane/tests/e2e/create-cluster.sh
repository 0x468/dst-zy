#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROL_PLANE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/dst-control-plane-create.XXXXXX)"
DATA_ROOT_HOST="$(mktemp -d "$CONTROL_PLANE_ROOT/.tmp/e2e-create-data.XXXXXX")"
SERVER_NAME="dst-control-plane-e2e-create"
COOKIE_JAR="$TMP_DIR/cookies.txt"
API_URL="http://127.0.0.1:18080"
DATA_ROOT_CONTAINER="/workspace/.tmp/$(basename "$DATA_ROOT_HOST")"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "create-cluster e2e failed; container logs:" >&2
    docker logs "$SERVER_NAME" >&2 || true
  fi
  docker rm -f "$SERVER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$DATA_ROOT_HOST"
  exit "$status"
}
trap cleanup EXIT

docker run -d \
  --name "$SERVER_NAME" \
  -p 18080:18080 \
  -v "$CONTROL_PLANE_ROOT":/workspace \
  -w /workspace/api \
  -e DST_CONTROL_PLANE_LISTEN_ADDR=:18080 \
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

curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -d '{"mode":"create","slug":"cluster-a","display_name":"Cluster A","cluster_name":"Cluster_A"}' \
  "$API_URL/api/clusters" >"$TMP_DIR/create.json"

grep -q '"slug":"cluster-a"' "$TMP_DIR/create.json"

curl -fsS "$API_URL/api/clusters" >"$TMP_DIR/list.json"
grep -q '"slug":"cluster-a"' "$TMP_DIR/list.json"

curl -fsS "$API_URL/api/clusters/cluster-a/config" >"$TMP_DIR/config.json"
grep -q '"cluster_name":"Cluster_A"' "$TMP_DIR/config.json"

curl -fsS -b "$COOKIE_JAR" -X POST -H 'Content-Type: application/json' \
  -d '{"action":"start"}' \
  "$API_URL/api/clusters/cluster-a/actions" >"$TMP_DIR/action.json"

grep -q '"job_type":"start"' "$TMP_DIR/action.json"

curl -fsS "$API_URL/api/jobs" >"$TMP_DIR/jobs.json"
grep -q '"status":"succeeded"' "$TMP_DIR/jobs.json"

printf 'create cluster e2e passed\n'
