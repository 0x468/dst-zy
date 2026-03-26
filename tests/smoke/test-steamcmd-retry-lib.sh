#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$REPO_ROOT/.tmp/test-steamcmd-retry-lib"
LIB_PATH="$REPO_ROOT/lib/steamcmd_retry.sh"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/bin" "$TMP_DIR/logs"

cat > "$TMP_DIR/bin/mock-steamcmd" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

attempt_file="${MOCK_ATTEMPT_FILE:?}"
attempt=0
if [ -f "$attempt_file" ]; then
  attempt="$(cat "$attempt_file")"
fi
attempt=$((attempt + 1))
printf '%s' "$attempt" > "$attempt_file"

if [ "$attempt" -eq 1 ]; then
  cat <<'OUT'
Steam Console Client
ERROR! Failed to install app '343050' (Missing configuration)
OUT
  exit 8
fi

cat <<'OUT'
Steam Console Client
Success! App '343050' fully installed.
OUT
EOF

chmod +x "$TMP_DIR/bin/mock-steamcmd"

# shellcheck source=/dev/null
source "$LIB_PATH"

export MOCK_ATTEMPT_FILE="$TMP_DIR/attempt"
STEAMCMD_RETRY_LOG="$TMP_DIR/logs/retry.log"

if ! run_steamcmd_with_retry "$STEAMCMD_RETRY_LOG" "$TMP_DIR/bin/mock-steamcmd" +app_update 343050 +quit; then
  echo "expected run_steamcmd_with_retry to succeed on second attempt"
  cat "$STEAMCMD_RETRY_LOG"
  exit 1
fi

if [ "$(cat "$TMP_DIR/attempt")" != "2" ]; then
  echo "expected exactly 2 attempts"
  cat "$TMP_DIR/attempt"
  exit 1
fi

if ! grep -q 'Missing configuration' "$STEAMCMD_RETRY_LOG"; then
  echo "expected retry log to capture first failure"
  cat "$STEAMCMD_RETRY_LOG"
  exit 1
fi

cat > "$TMP_DIR/bin/mock-steamcmd-hardfail" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "ERROR! Failed to install app '343050' (Disk write failure)"
exit 7
EOF

chmod +x "$TMP_DIR/bin/mock-steamcmd-hardfail"
STEAMCMD_HARDFAIL_LOG="$TMP_DIR/logs/hardfail.log"

if run_steamcmd_with_retry "$STEAMCMD_HARDFAIL_LOG" "$TMP_DIR/bin/mock-steamcmd-hardfail" +app_update 343050 +quit; then
  echo "expected non-matching error to fail without retry"
  exit 1
fi

if grep -q 'retrying after transient Missing configuration' "$STEAMCMD_HARDFAIL_LOG"; then
  echo "non-matching error should not trigger retry message"
  cat "$STEAMCMD_HARDFAIL_LOG"
  exit 1
fi
