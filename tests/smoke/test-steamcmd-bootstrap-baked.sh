#!/usr/bin/env bash
set -euo pipefail

if OUTPUT=$(docker run --rm --entrypoint bash dst-docker:v1 -lc '/usr/local/steamcmd/steamcmd.sh +quit' 2>&1); then
  :
fi

if grep -Fq '36395 KB' <<<"$OUTPUT"; then
  echo "expected baked image to avoid first-run SteamCMD bootstrap download"
  printf '%s\n' "$OUTPUT"
  exit 1
fi
