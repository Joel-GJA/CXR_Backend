const fs = require("fs");
const os = require("os");
const path = require("path");

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getAvailableIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  const virtualPrefixes = ["flannel.", "cni", "docker", "veth", "tun", "tap", "br-", "lxc", "lxd", "ovs-", "virbr"];

  for (const [name, entries] of Object.entries(interfaces)) {
    const isVirtual = virtualPrefixes.some(prefix => name.startsWith(prefix));
    if (isVirtual) continue;

    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }

  return Array.from(new Set(addresses)).sort();
}

function resolvePublicAddress(value) {
  const configuredValue = normalizeString(value);

  if (configuredValue && configuredValue.toLowerCase() !== "auto") {
    return configuredValue;
  }

  return getAvailableIPv4Addresses()[0] || "127.0.0.1";
}

function resolvePathValue(value, baseDirectory) {
  const configuredValue = normalizeString(value);

  if (!configuredValue) {
    return "";
  }

  if (path.isAbsolute(configuredValue)) {
    return path.normalize(configuredValue);
  }

  return path.normalize(path.resolve(baseDirectory, configuredValue));
}

function parsePositiveInteger(value, fallbackValue, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid ${fieldName} configuration.`);
  }

  return parsedValue;
}

function getUrlPort(value, fallbackPort) {
  const configuredValue = normalizeString(value);

  if (!configuredValue) {
    return fallbackPort;
  }

  try {
    const parsed = new URL(configuredValue);
    return parsed.port
      ? parsePositiveInteger(parsed.port, fallbackPort, "url port")
      : fallbackPort;
  } catch (error) {
    return fallbackPort;
  }
}

function discoverBuilds(baseDirectory) {
  const buildsDirEnv = normalizeString(process.env.CXR_UNITY_BUILDS_DIRECTORY);
  const unityBuildsDir = buildsDirEnv
    ? path.resolve(buildsDirEnv)
    : path.resolve(baseDirectory, "../../unity-builds");
  const builds = {};

  try {
    const entries = fs.readdirSync(unityBuildsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(unityBuildsDir, entry.name);
      let executablePath = null;

      const dirEntries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const dirEntry of dirEntries) {
        if (dirEntry.isFile() && /\.(x86_64|exe)$/i.test(dirEntry.name)) {
          executablePath = path.join(dirPath, dirEntry.name);
          break;
        }
      }

      if (!executablePath) continue;

      const name = entry.name
        .replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      builds[entry.name] = {
        name,
        executablePath,
        workingDirectory: dirPath
      };
    }
  } catch (error) {
    return {};
  }

  return builds;
}

function applyBuildOverrides(discoveredBuilds, rawOverrides, baseDirectory) {
  if (!rawOverrides || typeof rawOverrides !== "object") {
    return discoveredBuilds;
  }

  const result = { ...discoveredBuilds };

  for (const [buildId, override] of Object.entries(rawOverrides)) {
    if (!result[buildId]) {
      if (!override.executablePath || !override.workingDirectory) {
        continue;
      }
      result[buildId] = {};
    }

    if (override.name) {
      result[buildId].name = override.name;
    }

    if (override.executablePath) {
      result[buildId].executablePath = resolvePathValue(override.executablePath, baseDirectory);
    }

    if (override.workingDirectory) {
      result[buildId].workingDirectory = resolvePathValue(override.workingDirectory, baseDirectory);
    }
  }

  return result;
}

function loadHostManagerConfig(configPath) {
  const rawConfig = readJsonFile(configPath);
  const baseDirectory = path.dirname(configPath);

  const logsDirectory = resolvePathValue(
    process.env.CXR_LOGS_DIRECTORY || rawConfig.logsDirectory,
    baseDirectory
  );
  const hostManagerPort = parsePositiveInteger(
    process.env.CXR_HOST_MANAGER_PORT,
    rawConfig.hostManagerPort,
    "hostManagerPort"
  );
  const roomPortStart = parsePositiveInteger(
    process.env.CXR_ROOM_PORT_START,
    rawConfig.roomPortRange?.start,
    "roomPortRange.start"
  );
  const roomPortEnd = parsePositiveInteger(
    process.env.CXR_ROOM_PORT_END,
    rawConfig.roomPortRange?.end,
    "roomPortRange.end"
  );

  if (roomPortStart === undefined || roomPortEnd === undefined) {
    throw new Error("roomPortRange.start and roomPortRange.end must be configured.");
  }

  if (roomPortStart > roomPortEnd) {
    throw new Error("roomPortRange.start must be less than or equal to roomPortRange.end.");
  }

  let builds = discoverBuilds(baseDirectory);
  builds = applyBuildOverrides(builds, rawConfig.builds, baseDirectory);

  if (Object.keys(builds).length === 0) {
    const legacyExecutable = resolvePathValue(
      process.env.CXR_UNITY_EXECUTABLE_PATH || rawConfig.unityExecutablePath,
      baseDirectory
    );
    const legacyWorkingDir = resolvePathValue(
      process.env.CXR_UNITY_WORKING_DIRECTORY || rawConfig.unityWorkingDirectory,
      baseDirectory
    );

    if (legacyExecutable && legacyWorkingDir) {
      builds["default"] = {
        name: "Default",
        executablePath: legacyExecutable,
        workingDirectory: legacyWorkingDir
      };
    }
  }

  return {
    hostManagerPort,
    publicAddress: resolvePublicAddress(
      process.env.CXR_PUBLIC_ADDRESS || rawConfig.publicAddress || "auto"
    ),
    roomPortRange: {
      start: roomPortStart,
      end: roomPortEnd
    },
    builds,
    registryUrl: normalizeString(process.env.CXR_REGISTRY_URL || rawConfig.registryUrl),
    logsDirectory,
    availableAddresses: getAvailableIPv4Addresses(),
    configPath: path.normalize(configPath)
  };
}

function isAuthorizedRequest(request, adminToken) {
  if (!adminToken) {
    return true;
  }

  const headerToken = request.headers["x-cxr-admin-token"];
  if (typeof headerToken === "string" && headerToken === adminToken) {
    return true;
  }

  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    return false;
  }

  return authorization === `Bearer ${adminToken}`;
}

function watchBuilds(baseDirectory, onChange) {
  const buildsDirEnv = normalizeString(process.env.CXR_UNITY_BUILDS_DIRECTORY);
  const unityBuildsDir = buildsDirEnv
    ? path.resolve(buildsDirEnv)
    : path.resolve(baseDirectory, "../../unity-builds");

  let currentBuilds = discoverBuilds(baseDirectory);
  let debounceTimer = null;

  try {
    fs.watch(unityBuildsDir, (eventType) => {
      if (eventType !== "rename") return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const newBuilds = discoverBuilds(baseDirectory);
        const oldKeys = Object.keys(currentBuilds);
        const newKeys = Object.keys(newBuilds);

        const added = newKeys.filter(k => !oldKeys.includes(k));
        const removed = oldKeys.filter(k => !newKeys.includes(k));

        if (added.length > 0 || removed.length > 0) {
          const oldBuilds = currentBuilds;
          currentBuilds = newBuilds;
          onChange(newBuilds, oldBuilds, { added, removed });
        }
      }, 500);
    });
  } catch (error) {
    console.error(`Failed to watch builds directory ${unityBuildsDir}: ${error.message}`);
  }
}

module.exports = {
  discoverBuilds,
  getAvailableIPv4Addresses,
  getUrlPort,
  isAuthorizedRequest,
  loadHostManagerConfig,
  watchBuilds
};
