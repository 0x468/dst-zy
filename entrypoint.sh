#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=lib/legacy_workshop_fallback.sh
source /usr/local/lib/dst/legacy_workshop_fallback.sh
# shellcheck source=lib/steamcmd_retry.sh
source /usr/local/lib/dst/steamcmd_retry.sh

DST_UPDATE_MODE=${DST_UPDATE_MODE:-install-only}
DST_CLUSTER_NAME=${DST_CLUSTER_NAME:-Cluster_1}
export DST_CLUSTER_NAME
DST_STEAM_STATE_DIR=${DST_STEAM_STATE_DIR:-/steam-state}
DST_INSTALL_DIR=${DST_INSTALL_DIR:-/opt/dst}
DST_UGC_DIR=${DST_UGC_DIR:-/ugc}
DST_DATA_DIR=${DST_DATA_DIR:-/data}
DST_SERVER_MODS_UPDATE_MODE=${DST_SERVER_MODS_UPDATE_MODE:-runtime}
export DST_UGC_DIR DST_DATA_DIR DST_STEAM_STATE_DIR DST_SERVER_MODS_UPDATE_MODE
DST_SERVER_BINARY=""
DST_SERVER_EXTRA_ARGS=""
readonly STEAMCMD_BIN=/usr/local/steamcmd/steamcmd.sh

readonly DATA_CLUSTER_DIR="$DST_DATA_DIR/$DST_CLUSTER_NAME"
readonly DATA_MASTER_DIR="$DATA_CLUSTER_DIR/Master"
readonly DATA_CAVES_DIR="$DATA_CLUSTER_DIR/Caves"
readonly DATA_MODS_DIR="$DATA_CLUSTER_DIR/mods"
readonly SUPERVISORD_CONFIG=/etc/supervisor/conf.d/supervisord.conf
readonly LEGACY_FALLBACK_MARKER=.dst-docker-legacy-fallback
readonly STEAMCMD_RETRY_LOG_NAME=steamcmd-app-update.log

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

ensure_optional_file() {
  local path="$1"

  if [ ! -e "$path" ]; then
    : > "$path"
  fi
}

create_directories() {
  log_info "ensuring required directories"
  for dir in "$DST_STEAM_STATE_DIR" "$DST_INSTALL_DIR" "$DST_UGC_DIR" \
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
  local steamcmd_log_path="$DST_STEAM_STATE_DIR/$STEAMCMD_RETRY_LOG_NAME"
  if [ "${#extra_args[@]}" -gt 0 ]; then
    description+=" ${extra_args[*]}"
  fi

  log_info "running SteamCMD $description"
  run_steamcmd_with_retry "$steamcmd_log_path" \
    env HOME="$DST_STEAM_STATE_DIR" "$STEAMCMD_BIN" \
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

ensure_optional_cluster_files() {
  ensure_optional_file "$DATA_CLUSTER_DIR/adminlist.txt"
  ensure_optional_file "$DATA_CLUSTER_DIR/blocklist.txt"
  ensure_optional_file "$DATA_CLUSTER_DIR/whitelist.txt"
}

collect_server_mod_ids() {
  local synced_mod_setup="$DST_INSTALL_DIR/mods/dedicated_server_mods_setup.lua"

  if [ ! -f "$synced_mod_setup" ]; then
    return 0
  fi

  grep -oE 'workshop-[0-9]+' "$synced_mod_setup" | sort -u || true
}

is_mod_cached_in_ugc() {
  local mod_id="$1"
  [ -d "$DST_UGC_DIR/content/322330/${mod_id#workshop-}" ]
}

is_mod_available_locally() {
  local mod_id="$1"
  [ -d "$DST_INSTALL_DIR/mods/$mod_id" ]
}

is_managed_legacy_fallback_mod() {
  local mod_id="$1"
  [ -f "$DST_INSTALL_DIR/mods/$mod_id/$LEGACY_FALLBACK_MARKER" ]
}

collect_missing_server_mod_ids() {
  local mod_id

  while IFS= read -r mod_id; do
    [ -n "$mod_id" ] || continue
    if is_mod_cached_in_ugc "$mod_id"; then
      continue
    fi
    if is_mod_available_locally "$mod_id"; then
      continue
    fi
    printf '%s\n' "$mod_id"
  done < <(collect_server_mod_ids)
}

cleanup_stale_managed_legacy_fallback_mods() {
  local mod_dir
  local mod_id

  mkdir -p "$DST_INSTALL_DIR/mods"
  while IFS= read -r -d '' mod_dir; do
    mod_dir="$(dirname "$mod_dir")"
    mod_id="$(basename "$mod_dir")"
    if ! collect_server_mod_ids | grep -Fxq "$mod_id"; then
      log_info "server mods: removing stale managed legacy fallback $mod_id"
      rm -rf "$mod_dir"
      continue
    fi
    if is_mod_cached_in_ugc "$mod_id"; then
      log_info "server mods: removing managed legacy fallback $mod_id because UGC cache is present"
      rm -rf "$mod_dir"
    fi
  done < <(find "$DST_INSTALL_DIR/mods" -mindepth 2 -maxdepth 2 -type f -name "$LEGACY_FALLBACK_MARKER" -print0 2>/dev/null)
}

cleanup_legacy_fallback_temp_dirs() {
  mkdir -p "$DST_INSTALL_DIR/mods"
  find "$DST_INSTALL_DIR/mods" -mindepth 1 -maxdepth 1 -type d \
    \( -name '.legacy-api.*' -o -name '.legacy-fallback-*' \) \
    -exec rm -rf {} +
}

log_server_mod_cache_state() {
  local mod_id
  local -a ugc_cached_ids=()
  local -a local_cached_ids=()
  local -a missing_ids=()

  while IFS= read -r mod_id; do
    [ -n "$mod_id" ] || continue
    if is_mod_cached_in_ugc "$mod_id"; then
      ugc_cached_ids+=("$mod_id")
    elif is_mod_available_locally "$mod_id"; then
      local_cached_ids+=("$mod_id")
    else
      missing_ids+=("$mod_id")
    fi
  done < <(collect_server_mod_ids)

  if [ "${#ugc_cached_ids[@]}" -eq 0 ] && [ "${#local_cached_ids[@]}" -eq 0 ] && [ "${#missing_ids[@]}" -eq 0 ]; then
    log_info 'server mods cache: no workshop ids declared'
    return
  fi

  if [ "${#ugc_cached_ids[@]}" -gt 0 ]; then
    log_info "server mods cache: ugc ${ugc_cached_ids[*]}"
  fi

  if [ "${#local_cached_ids[@]}" -gt 0 ]; then
    log_info "server mods cache: local ${local_cached_ids[*]}"
  fi

  if [ "${#missing_ids[@]}" -gt 0 ]; then
    log_info "server mods cache: missing ${missing_ids[*]}"
  fi
}

fetch_steam_published_file_details() {
  local output_json="$1"
  shift

  local index=0
  local mod_id
  local -a curl_args=(
    -fsSL
    --retry 3
    -X POST
    https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/
    -d "itemcount=$#"
  )

  for mod_id in "$@"; do
    curl_args+=(-d "publishedfileids[$index]=${mod_id#workshop-}")
    index=$((index + 1))
  done

  curl "${curl_args[@]}" -o "$output_json"
}

install_legacy_workshop_fallback_mod() {
  local numeric_id="$1"
  local file_url="$2"
  local mod_id="workshop-$numeric_id"
  local mod_dir="$DST_INSTALL_DIR/mods/$mod_id"
  local temp_dir
  local zip_path
  local extract_dir
  local status=0

  if [ -d "$mod_dir" ] && ! is_managed_legacy_fallback_mod "$mod_id"; then
    log_info "server mods: local mod directory already exists for $mod_id; leaving it untouched"
    return 0
  fi

  temp_dir="$(mktemp -d "$DST_INSTALL_DIR/mods/.legacy-fallback-$numeric_id.XXXXXX")"
  zip_path="$temp_dir/mod.zip"
  extract_dir="$temp_dir/extracted"

  log_info "server mods: downloading legacy fallback for $mod_id"
  curl -fsSL --retry 3 "$file_url" -o "$zip_path" || status=$?
  if [ "$status" -eq 0 ]; then
    extract_legacy_workshop_zip "$zip_path" "$extract_dir" || status=$?
  fi
  if [ "$status" -ne 0 ]; then
    rm -rf "$temp_dir"
    return "$status"
  fi

  if [ ! -f "$extract_dir/modinfo.lua" ] && [ ! -f "$extract_dir/modmain.lua" ]; then
    log_error "server mods: legacy fallback for $mod_id is missing modinfo.lua/modmain.lua after extraction"
    rm -rf "$temp_dir"
    return 1
  fi

  : > "$extract_dir/$LEGACY_FALLBACK_MARKER"
  rm -rf "$mod_dir"
  mv "$extract_dir" "$mod_dir"
  rm -rf "$temp_dir"
  log_info "server mods: installed legacy fallback to $mod_dir"
}

prepare_legacy_server_mod_fallbacks() {
  local tmp_dir
  local metadata_json
  local line
  local numeric_id
  local file_url
  local mod_id
  local status=0
  local -a missing_ids=()
  local -a handled_ids=()

  cleanup_legacy_fallback_temp_dirs
  cleanup_stale_managed_legacy_fallback_mods

  while IFS= read -r mod_id; do
    [ -n "$mod_id" ] || continue
    missing_ids+=("$mod_id")
  done < <(collect_missing_server_mod_ids)

  if [ "${#missing_ids[@]}" -eq 0 ]; then
    log_info 'server mods: no missing workshop ids require legacy fallback'
    return 0
  fi

  tmp_dir="$(mktemp -d "$DST_INSTALL_DIR/mods/.legacy-api.XXXXXX")"
  metadata_json="$tmp_dir/publishedfiledetails.json"

  log_info "server mods: querying Steam metadata for missing ids ${missing_ids[*]}"
  fetch_steam_published_file_details "$metadata_json" "${missing_ids[@]}" || status=$?
  if [ "$status" -ne 0 ]; then
    rm -rf "$tmp_dir"
    return "$status"
  fi

  while IFS= read -r line; do
    [ -n "$line" ] || continue
    numeric_id="${line%%|*}"
    file_url="${line#*|}"
    install_legacy_workshop_fallback_mod "$numeric_id" "$file_url"
    handled_ids+=("workshop-$numeric_id")
  done < <(legacy_workshop_file_urls_from_json "$metadata_json")

  for mod_id in "${missing_ids[@]}"; do
    if printf '%s\n' "${handled_ids[@]:-}" | grep -Fxq "$mod_id"; then
      continue
    fi
    log_info "server mods: no legacy fallback metadata for $mod_id"
  done

  rm -rf "$tmp_dir"
}

run_only_update_server_mods() {
  local runtime_dir

  runtime_dir="$(dirname "$DST_SERVER_BINARY")"
  log_info 'server mods: prewarming via -only_update_server_mods'
  (
    cd "$runtime_dir"
    "$DST_SERVER_BINARY" \
      -cluster "$DST_CLUSTER_NAME" \
      -shard Master \
      -conf_dir . \
      -persistent_storage_root "$DST_DATA_DIR" \
      -ugc_directory "$DST_UGC_DIR" \
      -only_update_server_mods
  )
}

configure_server_mod_update_mode() {
  local synced_mod_setup="$DST_INSTALL_DIR/mods/dedicated_server_mods_setup.lua"

  DST_SERVER_EXTRA_ARGS=""
  if [ ! -f "$synced_mod_setup" ]; then
    log_info 'server mods: no synced dedicated_server_mods_setup.lua, using runtime mode'
    export DST_SERVER_EXTRA_ARGS
    return
  fi

  case "$DST_SERVER_MODS_UPDATE_MODE" in
    runtime)
      prepare_legacy_server_mod_fallbacks
      log_info 'server mods: runtime mode; shard processes will update mods themselves'
      log_server_mod_cache_state
      ;;
    prewarm)
      run_only_update_server_mods
      prepare_legacy_server_mod_fallbacks
      DST_SERVER_EXTRA_ARGS='-skip_update_server_mods'
      log_server_mod_cache_state
      log_info 'server mods: prewarm finished; shard processes will reuse cache via -skip_update_server_mods'
      ;;
    skip)
      cleanup_legacy_fallback_temp_dirs
      cleanup_stale_managed_legacy_fallback_mods
      DST_SERVER_EXTRA_ARGS='-skip_update_server_mods'
      log_server_mod_cache_state
      log_info 'server mods: skip mode; shard processes will trust existing UGC cache'
      ;;
    *)
      log_error "unknown DST_SERVER_MODS_UPDATE_MODE '$DST_SERVER_MODS_UPDATE_MODE'"
      exit 1
      ;;
  esac

  export DST_SERVER_EXTRA_ARGS
}

main() {
  create_directories

  require_file cluster.ini "$DATA_CLUSTER_DIR/cluster.ini"
  require_file cluster_token.txt "$DATA_CLUSTER_DIR/cluster_token.txt"
  require_file Master/server.ini "$DATA_MASTER_DIR/server.ini"
  require_file Caves/server.ini "$DATA_CAVES_DIR/server.ini"
  ensure_optional_cluster_files

  if find_dst_binary; then
    log_info "DST dedicated server binary located at $DST_SERVER_BINARY"
  else
    log_info "DST dedicated server binary not found under $DST_INSTALL_DIR"
  fi
  handle_update_mode
  export DST_SERVER_BINARY
  sync_mod_setup
  configure_server_mod_update_mode

  log_info 'starting supervisord'
  exec /usr/bin/supervisord -n -c "$SUPERVISORD_CONFIG"
}

main "$@"
