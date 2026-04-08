#!/usr/bin/env bash

E2E_DOCKER_IMAGE="${E2E_DOCKER_IMAGE:-golang:1.26.1-bookworm}"

safe_rm_tree() {
  local target parent base

  target="${1:-}"
  if [ -z "$target" ] || [ ! -e "$target" ]; then
    return 0
  fi

  if rm -rf "$target" 2>/dev/null; then
    return 0
  fi

  parent="$(dirname "$target")"
  base="$(basename "$target")"

  docker run --rm \
    -v "$parent":/cleanup-parent \
    -e TARGET_BASE="$base" \
    --entrypoint bash \
    "$E2E_DOCKER_IMAGE" \
    -lc 'rm -rf -- "/cleanup-parent/$TARGET_BASE"' >/dev/null

  rm -rf "$target" 2>/dev/null || true

  if [ -e "$target" ]; then
    echo "failed to remove path: $target" >&2
    return 1
  fi

  return 0
}
