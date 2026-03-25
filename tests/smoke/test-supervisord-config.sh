#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG="$REPO_ROOT/supervisord.conf"

if ! awk '
  /^\[supervisord\]$/ { section = "supervisord"; next }
  /^\[program:master\]$/ { section = "master"; next }
  /^\[program:caves\]$/ { section = "caves"; next }
  /^\[/ { section = ""; next }

  section == "supervisord" && $0 == "user=root" { saw_root_user = 1 }
  section == "master" && $0 == "directory=/opt/dst/bin64" { saw_master_directory = 1 }
  section == "caves" && $0 == "directory=/opt/dst/bin64" { saw_caves_directory = 1 }
  section == "master" && $0 ~ /command=.*-console/ { saw_master_console = 1 }
  section == "caves" && $0 ~ /command=.*-console/ { saw_caves_console = 1 }
  section == "master" && $0 ~ /command=.*%\(ENV_DST_SERVER_EXTRA_ARGS\)s/ { saw_master_extra_args = 1 }
  section == "caves" && $0 ~ /command=.*%\(ENV_DST_SERVER_EXTRA_ARGS\)s/ { saw_caves_extra_args = 1 }

  END {
    exit !(saw_root_user && saw_master_directory && saw_caves_directory &&
            saw_master_extra_args && saw_caves_extra_args &&
            !saw_master_console && !saw_caves_console)
  }
' "$CONFIG"; then
  echo "supervisord.conf is missing required runtime settings"
  sed -n '1,220p' "$CONFIG"
  exit 1
fi
