#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROL_PLANE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/dst-control-plane-image-smoke.XXXXXX)"
SERVER_NAME="dst-control-plane-e2e-image"
COOKIE_JAR="$TMP_DIR/cookies.txt"
API_URL="${CONTROL_PLANE_SMOKE_URL:-http://127.0.0.1:18082}"
HOST_PORT="${CONTROL_PLANE_SMOKE_PORT:-18082}"
IMAGE="${CONTROL_PLANE_IMAGE:-dst-control-plane:v2-check}"
mkdir -p "$CONTROL_PLANE_ROOT/.tmp"
DATA_ROOT_HOST="$(mktemp -d "$CONTROL_PLANE_ROOT/.tmp/e2e-image-data.XXXXXX")"

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    echo "smoke-image e2e failed; container logs:" >&2
    docker logs "$SERVER_NAME" >&2 || true
  fi
  docker rm -f "$SERVER_NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR" "$DATA_ROOT_HOST"
  exit "$status"
}
trap cleanup EXIT

docker run -d \
  --name "$SERVER_NAME" \
  -p "${HOST_PORT}:8080" \
  -v "$DATA_ROOT_HOST":/opt/dst-control-plane/data \
  -e DST_CONTROL_PLANE_ADMIN_USERNAME=admin \
  -e DST_CONTROL_PLANE_ADMIN_PASSWORD=secret \
  -e DST_CONTROL_PLANE_SESSION_SECRET=0123456789abcdef0123456789abcdef \
  -e DST_CONTROL_PLANE_EXECUTION_MODE=dry-run \
  "$IMAGE" >/dev/null

for _ in $(seq 1 90); do
  if curl -fsS "$API_URL/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS "$API_URL/healthz" >"$TMP_DIR/healthz.txt"
grep -q '^ok$' "$TMP_DIR/healthz.txt"

curl -fsS "$API_URL/" >"$TMP_DIR/root.html"
grep -q '<title>DST Control Plane</title>' "$TMP_DIR/root.html"

curl -sS -o "$TMP_DIR/unauthorized.json" -w '%{http_code}' \
  "$API_URL/api/clusters" >"$TMP_DIR/unauthorized.status"
grep -q '^401$' "$TMP_DIR/unauthorized.status"
grep -q '"error":"Unauthorized"' "$TMP_DIR/unauthorized.json"

curl -fsS -c "$COOKIE_JAR" -H 'Content-Type: application/json' \
  -H 'X-DST-Control-Plane-CSRF: 1' \
  -d '{"username":"admin","password":"secret"}' \
  "$API_URL/api/login" >"$TMP_DIR/login.json"
grep -q '"status":"ok"' "$TMP_DIR/login.json"

curl -fsS -b "$COOKIE_JAR" "$API_URL/api/clusters" >"$TMP_DIR/clusters.json"
grep -q '^\[\]' "$TMP_DIR/clusters.json"

printf 'control plane image smoke passed\n'
