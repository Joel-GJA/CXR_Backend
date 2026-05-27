#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
XR_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_FILE="${1:-${SCRIPT_DIR}/xrserver.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

detected_ip=$(hostname -I | awk '{print $1}')
if [[ -n "${detected_ip}" ]]; then
  CXR_PUBLIC_ADDRESS="${detected_ip}"
fi

echo "Starting XRServer stack from ${XR_ROOT}"

mkdir -p "${XR_ROOT}/host-manager/logs"

start_service() {
  local service_name="$1"
  local working_dir="$2"
  local entry_file="$3"
  local log_file="$4"

  echo "Starting ${service_name}"
  nohup node "${entry_file}" > "${log_file}" 2>&1 &
  echo "${service_name} pid=$!"
}

start_service "registry" "${XR_ROOT}/registry" "${XR_ROOT}/registry/server.js" "${XR_ROOT}/registry/registry.log"
start_service "host-manager" "${XR_ROOT}/host-manager" "${XR_ROOT}/host-manager/server.js" "${XR_ROOT}/host-manager/host-manager.launch.log"

echo "Registry:      http://${CXR_PUBLIC_ADDRESS:-127.0.0.1}:${CXR_REGISTRY_PORT:-8080}"
echo "Host Manager:  http://${CXR_PUBLIC_ADDRESS:-127.0.0.1}:${CXR_HOST_MANAGER_PORT:-3000}"
