#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XR_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-${SCRIPT_DIR}/xrserver.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  source "${ENV_FILE}"
  set +a
fi

REGISTRY_PORT="${CXR_REGISTRY_PORT:-8080}"
HOST_MANAGER_PORT="${CXR_HOST_MANAGER_PORT:-3000}"

find_pids_by_port() {
  local port="$1"
  lsof -ti "tcp:${port}" 2>/dev/null || true
}

kill_pid_soft() {
  local pid="$1"
  kill "$pid" 2>/dev/null || true
}

kill_pid_force() {
  local pid="$1"
  kill -9 "$pid" 2>/dev/null || true
}

find_pids_by_pattern() {
  local pattern="$1"
  pgrep -f "$pattern" 2>/dev/null || true
}

terminate_pid_list() {
  local signal_mode="$1"
  local pids="$2"

  if [ -z "$pids" ]; then
    return 0
  fi

  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    if [ "$signal_mode" = "force" ]; then
      kill_pid_force "$pid"
    else
      kill_pid_soft "$pid"
    fi
  done <<< "$pids"
}

wait_for_port_free() {
  local port="$1"
  local retries="${2:-10}"

  for ((i=0; i<retries; i++)); do
    if [ -z "$(find_pids_by_port "$port")" ]; then
      return 0
    fi
    sleep 1
  done

  return 1
}

echo "Stopping XRServer stack"

# 1. Kill Unity room processes first (headless server)
UNITY_PIDS=$(pgrep -f "CXR_Backend.x86_64.*cxr-headless-server" 2>/dev/null || true)
if [ -n "$UNITY_PIDS" ]; then
  echo "  Stopping Unity rooms (PIDs: $(echo "$UNITY_PIDS" | tr '\n' ' '))"
  terminate_pid_list "soft" "$UNITY_PIDS"
  sleep 1
  # Force kill if still alive
  UNITY_PIDS=$(pgrep -f "CXR_Backend.x86_64.*cxr-headless-server" 2>/dev/null || true)
  if [ -n "$UNITY_PIDS" ]; then
    terminate_pid_list "force" "$UNITY_PIDS"
    echo "  Unity rooms force killed"
  else
    echo "  Unity rooms stopped"
  fi
else
  echo "  No Unity room processes found"
fi

# 2. Kill Node.js services by port using fuser
for entry in "registry:${REGISTRY_PORT}" "host-manager:${HOST_MANAGER_PORT}"; do
  name="${entry%%:*}"
  port="${entry##*:}"
  pids="$(find_pids_by_port "$port")"
  if [ -n "$pids" ]; then
    echo "  Stopping ${name} on port ${port} (PIDs: $(echo "$pids" | tr '\n' ' '))"
    terminate_pid_list "soft" "$pids"
  else
    echo "  ${name} not running on port ${port}"
  fi
done

for entry in "registry:${REGISTRY_PORT}" "host-manager:${HOST_MANAGER_PORT}"; do
  name="${entry%%:*}"
  port="${entry##*:}"
  if wait_for_port_free "$port" 3; then
    echo "  ${name} released port ${port}"
  fi
done

# 3. Force kill any remaining Node.js server processes
for entry_file in "registry/server.js" "host-manager/server.js"; do
  pids="$(find_pids_by_pattern "node.*${entry_file}")"
  if [ -n "$pids" ]; then
    echo "  Force killing remaining: ${entry_file}"
    terminate_pid_list "force" "$pids"
  fi
done

# 4. Verify ports are free
ALL_CLEAR=true
for entry in "registry:${REGISTRY_PORT}" "host-manager:${HOST_MANAGER_PORT}"; do
  name="${entry%%:*}"
  port="${entry##*:}"
  if [ -n "$(find_pids_by_port "$port")" ]; then
    echo "  WARNING: ${name} port ${port} still in use"
    ALL_CLEAR=false
  else
    echo "  Port ${port} (${name}) free"
  fi
done

if $ALL_CLEAR; then
  echo "All services stopped. Ready to start fresh."
fi
