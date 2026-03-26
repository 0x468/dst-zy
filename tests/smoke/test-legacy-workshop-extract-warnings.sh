#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-legacy-workshop-extract-warnings"
LIB_PATH="$REPO_ROOT/lib/legacy_workshop_fallback.sh"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/bin"

python3 - "$TMP_DIR/mod.zip" <<'PY'
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1], "w") as archive:
    archive.writestr("modmain.lua", "print('ok')\n")
    archive.writestr(r"scripts\modinfo.lua", "name='Legacy'\n")
PY

cat > "$TMP_DIR/bin/unzip" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

zip_path="$2"
target_dir="$4"

python3 - "$zip_path" "$target_dir" <<'PY'
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    archive.extractall(sys.argv[2])
PY

exit 1
EOF

chmod +x "$TMP_DIR/bin/unzip"

# shellcheck source=/dev/null
source "$LIB_PATH"

PATH="$TMP_DIR/bin:$PATH"
extract_legacy_workshop_zip "$TMP_DIR/mod.zip" "$TMP_DIR/out"

if [ ! -f "$TMP_DIR/out/modmain.lua" ]; then
  echo "extract_legacy_workshop_zip should keep root files when unzip warns"
  exit 1
fi

if [ ! -f "$TMP_DIR/out/scripts/modinfo.lua" ]; then
  echo "extract_legacy_workshop_zip should normalize backslash paths when unzip warns"
  find "$TMP_DIR/out" -maxdepth 4 -print | sort
  exit 1
fi
