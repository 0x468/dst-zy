#!/usr/bin/env bash

steamcmd_output_has_missing_configuration() {
  local log_path="$1"
  grep -Fq "Failed to install app '343050' (Missing configuration)" "$log_path"
}

run_steamcmd_with_retry() {
  local log_path="$1"
  shift

  local attempt=1
  local max_attempts=2
  local status=0

  : > "$log_path"

  while [ "$attempt" -le "$max_attempts" ]; do
    if "$@" >>"$log_path" 2>&1; then
      return 0
    else
      status=$?
    fi

    if [ "$attempt" -ge "$max_attempts" ] || ! steamcmd_output_has_missing_configuration "$log_path"; then
      return "$status"
    fi

    printf 'steamcmd retry: retrying after transient Missing configuration (attempt %s/%s)\n' \
      "$attempt" "$max_attempts" >>"$log_path"
    attempt=$((attempt + 1))
  done

  return "$status"
}
