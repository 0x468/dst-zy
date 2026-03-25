#!/usr/bin/env bash
set -euo pipefail

DST_UPDATE_MODE=${DST_UPDATE_MODE:-install-only}
DST_CLUSTER_NAME=${DST_CLUSTER_NAME:-Cluster_1}
export DST_CLUSTER_NAME
DST_STEAMCMD_DIR=${DST_STEAMCMD_DIR:-/opt/steamcmd}
DST_INSTALL_DIR=${DST_INSTALL_DIR:-/opt/dst}
DST_UGC_DIR=${DST_UGC_DIR:-/ugc}
DST_DATA_DIR=${DST_DATA_DIR:-/data}
export DST_UGC_DIR DST_DATA_DIR
DST_SERVER_BINARY=""

readonly DATA_CLUSTER_DIR="$DST_DATA_DIR/$DST_CLUSTER_NAME"
readonly DATA_MASTER_DIR="$DATA_CLUSTER_DIR/Master"
readonly DATA_CAVES_DIR="$DATA_CLUSTER_DIR/Caves"
readonly DATA_MODS_DIR="$DATA_CLUSTER_DIR/mods"

log_info() {
  printf 'entrypoint: %s\n' "$*"
}

log_error() {
  printf 'entrypoint: %s\n' "$*" >&2
}

require_file() {
  local name="$1"
  local path="$2"

  if [ ! -f "$path" ]; then
    log_error "preflight error: missing $name at $path"
    exit 1
  fi
}

create_directories() {
  log_info "ensuring required directories"
  for dir in "$DST_STEAMCMD_DIR" "$DST_INSTALL_DIR" "$DST_UGC_DIR" \
             "$DATA_CLUSTER_DIR" "$DATA_MASTER_DIR" "$DATA_CAVES_DIR" "$DATA_MODS_DIR"; do
    mkdir -p "$dir"
  done
}

find_dst_binary() {
  local candidate
  local -a candidates=(
    "$DST_INSTALL_DIR/bin64/dontstarve_dedicated_server_nullrenderer_x64"
    "$DST_INSTALL_DIR/bin64/dontstarve_dedicated_server_nullrenderer"
    "$DST_INSTALL_DIR/bin/dontstarve_dedicated_server_nullrenderer"
  )

  for candidate in "${candidates[@]}"; do
    if [ -x "$candidate" ]; then
      DST_SERVER_BINARY="$candidate"
      return 0
    fi
  done

  DST_SERVER_BINARY=""
  return 1
}

run_steamcmd_app_update() {
  local extra_args=("$@")
  local description="app_update 343050"
  if [ "${#extra_args[@]}" -gt 0 ]; then
    description+=" ${extra_args[*]}"
  fi

  log_info "running SteamCMD $description"
  "$DST_STEAMCMD_DIR/steamcmd.sh" \
    +force_install_dir "$DST_INSTALL_DIR" \
    +login anonymous \
    +app_update 343050 \
    "${extra_args[@]}" \
    +quit
}

require_dst_binary_after_steamcmd() {
  local context="${1:-SteamCMD}"
  if find_dst_binary; then
    log_info "$context produced DST binary at $DST_SERVER_BINARY"
    return 0
  fi
  log_error "$context completed but no DST binary was found under $DST_INSTALL_DIR"
  exit 1
}

handle_update_mode() {
  case "$DST_UPDATE_MODE" in
    install-only)
      if [ -z "${DST_SERVER_BINARY:-}" ]; then
        log_info 'install-only mode: DST binary not present, installing via SteamCMD'
        run_steamcmd_app_update
        require_dst_binary_after_steamcmd 'install-only SteamCMD run'
      else
        log_info "install-only mode: DST binary already present at $DST_SERVER_BINARY; skipping update"
      fi
      ;;
    update)
      log_info 'update mode: running SteamCMD app_update'
      run_steamcmd_app_update
      require_dst_binary_after_steamcmd 'update SteamCMD run'
      ;;
    validate)
      log_info 'validate mode: running SteamCMD app_update validate'
      run_steamcmd_app_update validate
      require_dst_binary_after_steamcmd 'validate SteamCMD run'
      ;;
    never)
      if [ -z "${DST_SERVER_BINARY:-}" ]; then
        log_error "update mode 'never' requires DST binary under $DST_INSTALL_DIR but none was found"
        exit 1
      fi
      log_info 'never mode: skipping network update'
      ;;
    *)
      log_error "unknown DST_UPDATE_MODE '$DST_UPDATE_MODE'"
      exit 1
      ;;
  esac
}

sync_mod_setup() {
  local src="$DATA_MODS_DIR/dedicated_server_mods_setup.lua"
  local dst="$DST_INSTALL_DIR/mods/dedicated_server_mods_setup.lua"

  if [ ! -f "$src" ]; then
    if [ -f "$dst" ]; then
      log_info "mod setup: source $src missing; removing stale $dst"
      rm -f "$dst"
    else
      log_info "mod setup: no $src found, nothing to sync"
    fi
    return
  fi

  log_info "mod setup: syncing $src to $dst"
  mkdir -p "$(dirname "$dst")"
  install -m 0644 "$src" "$dst"
}

main() {
  create_directories

  require_file cluster.ini "$DATA_CLUSTER_DIR/cluster.ini"
  require_file cluster_token.txt "$DATA_CLUSTER_DIR/cluster_token.txt"
  require_file Master/server.ini "$DATA_MASTER_DIR/server.ini"
  require_file Caves/server.ini "$DATA_CAVES_DIR/server.ini"

  if find_dst_binary; then
    log_info "DST dedicated server binary located at $DST_SERVER_BINARY"
  else
    log_info "DST dedicated server binary not found under $DST_INSTALL_DIR"
  fi
  handle_update_mode
  export DST_SERVER_BINARY
  sync_mod_setup

  log_info 'starting supervisord'
  exec /usr/bin/supervisord -n
}

main "$@"
