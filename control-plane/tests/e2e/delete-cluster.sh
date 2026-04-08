#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"
CONTROL_PLANE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/dst-control-plane-delete.XXXXXX)"
mkdir -p "$CONTROL_PLANE_ROOT/.tmp"
DATA_ROOT_HOST="$(mktemp -d "$CONTROL_PLANE_ROOT/.tmp/e2e-delete-data.XXXXXX")"
SERVER_NAME="dst-control-plane-e2e-delete"
COOKIE_JAR="$TMP_DIR/cookies.txt"
API_URL="http://127.0.0.1:18083"
DATA_ROOT_CONTAINER="/workspace/.tmp/$(basename "$DATA_ROOT_HOST")"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "delete-cluster e2e failed; container logs:" >&2
    docker logs "$SERVER_NAME" >&2 || true
  fi
  docker rm -f "$SERVER_NAME" >/dev/null 2>&1 || true
  safe_rm_tree "$TMP_DIR"
  safe_rm_tree "$DATA_ROOT_HOST"
  exit "$status"
}
trap cleanup EXIT

docker run -d \
  --name "$SERVER_NAME" \
  -p 18083:18083 \
  -v "$CONTROL_PLANE_ROOT":/workspace \
  -w /workspace/api \
  -e GOPROXY=https://goproxy.cn,direct \
  -e DST_CONTROL_PLANE_LISTEN_ADDR=:18083 \
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
  -H 'X-DST-Control-Plane-CSRF: 1' \
  -d '{"username":"admin","password":"secret"}' \
  "$API_URL/api/login" >/dev/null

curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -H 'X-DST-Control-Plane-CSRF: 1' \
  -d '{"mode":"create","slug":"cluster-a","display_name":"Cluster A","cluster_name":"Cluster_A"}' \
  "$API_URL/api/clusters" >"$TMP_DIR/create-a.json"

curl -fsS -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -H 'X-DST-Control-Plane-CSRF: 1' \
  -d '{"mode":"create","slug":"cluster-b","display_name":"Cluster B","cluster_name":"Cluster_B"}' \
  "$API_URL/api/clusters" >"$TMP_DIR/create-b.json"

grep -q '"slug":"cluster-a"' "$TMP_DIR/create-a.json"
grep -q '"slug":"cluster-b"' "$TMP_DIR/create-b.json"

DELETED_CLUSTER_DIR="$DATA_ROOT_HOST/clusters/cluster-a"
test -d "$DELETED_CLUSTER_DIR"

curl -fsS -b "$COOKIE_JAR" -X DELETE \
  -H 'X-DST-Control-Plane-CSRF: 1' \
  "$API_URL/api/clusters/cluster-a" >/dev/null

if [ -d "$DELETED_CLUSTER_DIR" ]; then
  echo "expected deleted cluster directory to be removed: $DELETED_CLUSTER_DIR" >&2
  exit 1
fi

curl -fsS -b "$COOKIE_JAR" "$API_URL/api/clusters" >"$TMP_DIR/list.json"
grep -q '"slug":"cluster-b"' "$TMP_DIR/list.json"
if grep -q '"slug":"cluster-a"' "$TMP_DIR/list.json"; then
  echo 'expected deleted cluster to disappear from cluster list' >&2
  exit 1
fi

curl -fsS -b "$COOKIE_JAR" "$API_URL/api/audit?slug=cluster-a&limit=20" >"$TMP_DIR/audit.json"
grep -q '"action":"cluster_delete"' "$TMP_DIR/audit.json"
grep -q '"action":"login_success"' "$TMP_DIR/audit.json"

printf 'delete cluster e2e passed\n'
