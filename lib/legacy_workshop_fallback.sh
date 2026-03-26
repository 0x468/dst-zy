#!/usr/bin/env bash

legacy_workshop_file_urls_from_json() {
  local json_path="$1"

  if command -v jq >/dev/null 2>&1; then
    jq -r '
      .response.publishedfiledetails[]
      | select(.result == 1)
      | select(.consumer_app_id == 322330)
      | select((.file_url // "") != "")
      | "\(.publishedfileid)|\(.file_url)"
    ' "$json_path"
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$json_path" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    payload = json.load(fh)

for item in payload.get("response", {}).get("publishedfiledetails", []):
    if item.get("result") != 1:
        continue
    if item.get("consumer_app_id") != 322330:
        continue
    file_url = item.get("file_url") or ""
    if not file_url:
        continue
    print(f"{item['publishedfileid']}|{file_url}")
PY
    return 0
  fi

  printf 'legacy_workshop_file_urls_from_json: need jq or python3 to parse %s\n' "$json_path" >&2
  return 1
}

normalize_legacy_workshop_tree() {
  local tree_dir="$1"
  local path
  local rel
  local normalized_rel
  local target

  [ -d "$tree_dir" ] || return 0

  while IFS= read -r -d '' path; do
    rel="${path#"$tree_dir"/}"
    [ "$rel" != "$path" ] || continue
    normalized_rel="${rel//\\//}"

    if [ "$normalized_rel" = "$rel" ]; then
      continue
    fi

    target="$tree_dir/$normalized_rel"
    if [ -d "$path" ]; then
      mkdir -p "$target"
      rmdir "$path" 2>/dev/null || true
      continue
    fi

    mkdir -p "$(dirname "$target")"
    mv -f "$path" "$target"
  done < <(find "$tree_dir" -depth -mindepth 1 -print0)
}

extract_legacy_workshop_zip() {
  local zip_path="$1"
  local target_dir="$2"
  local scratch_dir
  local status=0

  rm -rf "$target_dir"
  mkdir -p "$target_dir"

  scratch_dir="$(mktemp -d "${target_dir%/}.extract.XXXXXX")"

  if command -v unzip >/dev/null 2>&1; then
    unzip -qq "$zip_path" -d "$scratch_dir" || status=$?
  elif command -v python3 >/dev/null 2>&1; then
    python3 - "$zip_path" "$scratch_dir" <<'PY'
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    archive.extractall(sys.argv[2])
PY
    status=$?
  else
    printf 'extract_legacy_workshop_zip: need unzip or python3 to extract %s\n' "$zip_path" >&2
    return 1
  fi

  if [ "$status" -gt 1 ]; then
    rm -rf "$scratch_dir"
    return "$status"
  fi

  normalize_legacy_workshop_tree "$scratch_dir"
  cp -a "$scratch_dir"/. "$target_dir"/
  rm -rf "$scratch_dir"
}
