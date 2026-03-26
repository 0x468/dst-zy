#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FIXTURE_JSON="$REPO_ROOT/tests/fixtures/steam/publishedfiledetails-legacy.json"
TMP_DIR="$REPO_ROOT/.tmp/test-legacy-workshop-fallback-lib"
LIB_PATH="$REPO_ROOT/lib/legacy_workshop_fallback.sh"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# shellcheck source=/dev/null
source "$LIB_PATH"

mapfile -t LEGACY_LINES < <(legacy_workshop_file_urls_from_json "$FIXTURE_JSON")
EXPECTED_LINES=(
  "362175979|https://cdn.example.invalid/362175979.zip"
  "661253977|https://cdn.example.invalid/661253977.zip"
)

if [ "${#LEGACY_LINES[@]}" -ne "${#EXPECTED_LINES[@]}" ]; then
  echo "legacy_workshop_file_urls_from_json returned unexpected line count"
  printf 'actual:\n%s\n' "${LEGACY_LINES[*]:-}"
  exit 1
fi

for idx in "${!EXPECTED_LINES[@]}"; do
  if [ "${LEGACY_LINES[$idx]}" != "${EXPECTED_LINES[$idx]}" ]; then
    echo "legacy_workshop_file_urls_from_json returned unexpected value"
    printf 'expected: %s\n' "${EXPECTED_LINES[$idx]}"
    printf 'actual: %s\n' "${LEGACY_LINES[$idx]}"
    exit 1
  fi
done

mkdir -p "$TMP_DIR/tree"
touch "$TMP_DIR/tree/modmain.lua"
touch "$TMP_DIR/tree/scripts\\modinfo.lua"
mkdir -p "$TMP_DIR/tree/images\\ui"
touch "$TMP_DIR/tree/images\\ui\\icon.tex"

normalize_legacy_workshop_tree "$TMP_DIR/tree"

if [ ! -f "$TMP_DIR/tree/modmain.lua" ]; then
  echo "normalize_legacy_workshop_tree should preserve normal files"
  exit 1
fi

if [ ! -f "$TMP_DIR/tree/scripts/modinfo.lua" ]; then
  echo "normalize_legacy_workshop_tree did not normalize scripts\\\\modinfo.lua"
  find "$TMP_DIR/tree" -maxdepth 4 -print | sort
  exit 1
fi

if [ ! -f "$TMP_DIR/tree/images/ui/icon.tex" ]; then
  echo "normalize_legacy_workshop_tree did not normalize images\\\\ui\\\\icon.tex"
  find "$TMP_DIR/tree" -maxdepth 4 -print | sort
  exit 1
fi

if find "$TMP_DIR/tree" -print | grep -q '\\\\'; then
  echo "normalize_legacy_workshop_tree left backslash paths behind"
  find "$TMP_DIR/tree" -maxdepth 4 -print | sort
  exit 1
fi
