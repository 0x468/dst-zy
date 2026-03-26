#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "missing .env at $ENV_FILE" >&2
  exit 1
fi

cluster_name="$(awk -F= '$1=="DST_CLUSTER_NAME"{print $2}' "$ENV_FILE" | tail -n 1)"
if [ -z "$cluster_name" ]; then
  echo "DST_CLUSTER_NAME is missing from .env" >&2
  exit 1
fi

cluster_dir="$REPO_ROOT/data/$cluster_name"
required_dirs=(
  "$REPO_ROOT/steam-state"
  "$REPO_ROOT/dst"
  "$REPO_ROOT/ugc"
  "$REPO_ROOT/data"
)
required_files=(
  "$cluster_dir/cluster.ini"
  "$cluster_dir/cluster_token.txt"
  "$cluster_dir/Master/server.ini"
  "$cluster_dir/Caves/server.ini"
)
host_port_keys=(
  "DST_MASTER_HOST_PORT"
  "DST_CAVES_HOST_PORT"
  "DST_STEAM_HOST_PORT"
  "DST_CAVES_STEAM_HOST_PORT"
)
host_port_values=()
expected_master_server_port="11000"
expected_caves_server_port="11001"
expected_master_master_server_port="27018"
expected_caves_master_server_port="27019"

for path in "${required_dirs[@]}"; do
  if [ ! -d "$path" ]; then
    echo "missing required runtime directory: $path" >&2
    exit 1
  fi
done

for path in "${required_files[@]}"; do
  if [ ! -f "$path" ]; then
    echo "missing required local config file: $path" >&2
    exit 1
  fi
done

token_value="$(tr -d '\r\n' <"$cluster_dir/cluster_token.txt")"
if [ -z "$token_value" ]; then
  echo "cluster_token.txt is empty: $cluster_dir/cluster_token.txt" >&2
  exit 1
fi

if [ "$token_value" = 'replace-with-your-klei-cluster-token' ]; then
  echo "cluster_token.txt still contains the example placeholder: $cluster_dir/cluster_token.txt" >&2
  exit 1
fi

cluster_key_value="$(awk -F= '$1 ~ /^[[:space:]]*cluster_key[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/cluster.ini" | tail -n 1)"
shard_enabled_value="$(awk -F= '$1 ~ /^[[:space:]]*shard_enabled[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/cluster.ini" | tail -n 1)"
master_port_value="$(awk -F= '$1 ~ /^[[:space:]]*master_port[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/cluster.ini" | tail -n 1)"
if [ "$cluster_key_value" = 'replace-with-your-own-cluster-key' ]; then
  echo "cluster.ini still contains the example cluster_key: $cluster_dir/cluster.ini" >&2
  exit 1
fi

if [ "$shard_enabled_value" != 'true' ]; then
  echo "cluster.ini shard_enabled must be true: $cluster_dir/cluster.ini" >&2
  exit 1
fi

if ! [[ "$master_port_value" =~ ^[0-9]+$ ]] || [ "$master_port_value" -lt 1 ] || [ "$master_port_value" -gt 65535 ]; then
  echo "cluster.ini master_port must be a valid port: $master_port_value" >&2
  exit 1
fi

master_server_port="$(awk -F= '$1 ~ /^[[:space:]]*server_port[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/Master/server.ini" | tail -n 1)"
caves_server_port="$(awk -F= '$1 ~ /^[[:space:]]*server_port[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/Caves/server.ini" | tail -n 1)"
master_master_server_port="$(awk -F= '$1 ~ /^[[:space:]]*master_server_port[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/Master/server.ini" | tail -n 1)"
caves_master_server_port="$(awk -F= '$1 ~ /^[[:space:]]*master_server_port[[:space:]]*$/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2}' "$cluster_dir/Caves/server.ini" | tail -n 1)"

if [ -n "$master_server_port" ] && [ "$master_server_port" = "$caves_server_port" ]; then
  echo "Master/Caves server_port values must be different: $master_server_port" >&2
  exit 1
fi

if [ -n "$master_master_server_port" ] && [ "$master_master_server_port" = "$caves_master_server_port" ]; then
  echo "Master/Caves master_server_port values must be different: $master_master_server_port" >&2
  exit 1
fi

if [ "$master_server_port" != "$expected_master_server_port" ]; then
  echo "Master server_port must match compose target $expected_master_server_port: $master_server_port" >&2
  exit 1
fi

if [ "$caves_server_port" != "$expected_caves_server_port" ]; then
  echo "Caves server_port must match compose target $expected_caves_server_port: $caves_server_port" >&2
  exit 1
fi

if [ "$master_master_server_port" != "$expected_master_master_server_port" ]; then
  echo "Master master_server_port must match compose target $expected_master_master_server_port: $master_master_server_port" >&2
  exit 1
fi

if [ "$caves_master_server_port" != "$expected_caves_master_server_port" ]; then
  echo "Caves master_server_port must match compose target $expected_caves_master_server_port: $caves_master_server_port" >&2
  exit 1
fi

for key in "${host_port_keys[@]}"; do
  value="$(awk -F= -v k="$key" '$1==k{print $2}' "$ENV_FILE" | tail -n 1)"
  if [ -z "$value" ]; then
    continue
  fi
  if ! [[ "$value" =~ ^[0-9]+$ ]] || [ "$value" -lt 1 ] || [ "$value" -gt 65535 ]; then
    echo "invalid host port value for $key: $value" >&2
    exit 1
  fi
  host_port_values+=("$value")
done

if [ "${#host_port_values[@]}" -gt 0 ]; then
  unique_host_port_count="$(printf '%s\n' "${host_port_values[@]}" | sort -u | wc -l | tr -d ' ')"
  if [ "$unique_host_port_count" -ne "${#host_port_values[@]}" ]; then
    echo "host port values must be different: ${host_port_values[*]}" >&2
    exit 1
  fi
fi

printf 'local config looks ready for cluster %s\n' "$cluster_name"
