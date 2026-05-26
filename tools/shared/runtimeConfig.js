const fs = require("fs");
const os = require("os");
const path = require("path");

function getAvailableIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const infos of Object.values(interfaces)) {
    if (!Array.isArray(infos)) {
      continue;
    }

    for (const info of infos) {
      if (info && info.family === "IPv4" && !info.internal) {
        addresses.push(info.address);
      }
    }
  }

  return Array.from(new Set(addresses));
}

function isAuthorizedRequest(request, adminToken) {
  if (!adminToken) {
    return true;
  }

  const authHeader = request.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() === adminToken;
  }

  const headerToken = request.headers["x-admin-token"];
  if (typeof headerToken === "string") {
    return headerToken.trim() === adminToken;
  }

  return false;
}

function loadHostManagerConfig(configPath) {
  const configDirectory = path.dirname(configPath);
  const repoRoot = path.resolve(configDirectory, "..", "..");
  const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const availableAddresses = getAvailableIPv4Addresses();

  const config = {
    ...rawConfig,
    hostManagerPort: normalizePort(rawConfig.hostManagerPort, 3000),
    publicAddress: resolvePublicAddress(rawConfig.publicAddress, availableAddresses),
    logsDirectory: resolveOptionalPath(configDirectory, rawConfig.logsDirectory, path.join(repoRoot, "Logs")),
    registryUrl: typeof rawConfig.registryUrl === "string" ? rawConfig.registryUrl.trim() : "",
    roomPortRange: normalizeRoomPortRange(rawConfig.roomPortRange),
    builds: discoverUnityBuilds(repoRoot)
  };

  const envExecutablePath = process.env.CXR_UNITY_EXECUTABLE_PATH;
  if (envExecutablePath && envExecutablePath.trim().length > 0) {
    const executablePath = path.resolve(repoRoot, envExecutablePath.trim());
    const buildId = process.env.CXR_UNITY_BUILD_ID || "default";
    config.builds[buildId] = createBuildDescriptor(buildId, executablePath);
    if (!config.builds.default) {
      config.builds.default = config.builds[buildId];
    }
  }

  return config;
}

function normalizePort(value, fallback) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeRoomPortRange(value) {
  const start = normalizePort(value?.start, 7777);
  const end = normalizePort(value?.end, 7900);
  return start <= end ? { start, end } : { start: end, end: start };
}

function resolvePublicAddress(value, availableAddresses) {
  if (typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "auto") {
    return value.trim();
  }

  if (availableAddresses.length > 0) {
    return availableAddresses[0];
  }

  return "127.0.0.1";
}

function resolveOptionalPath(baseDirectory, rawValue, fallbackPath) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return fallbackPath;
  }

  return path.isAbsolute(rawValue)
    ? path.normalize(rawValue)
    : path.resolve(baseDirectory, rawValue);
}

function discoverUnityBuilds(repoRoot) {
  const searchRoots = [
    path.join(repoRoot, "Builds"),
    path.join(repoRoot, "unity-builds")
  ];

  const builds = {};
  const discovered = [];

  for (const searchRoot of searchRoots) {
    if (!fs.existsSync(searchRoot)) {
      continue;
    }

    for (const executablePath of walkBuildExecutables(searchRoot)) {
      discovered.push(executablePath);
    }
  }

  for (const executablePath of discovered.sort()) {
    const id = createBuildId(executablePath, Object.keys(builds));
    builds[id] = createBuildDescriptor(id, executablePath);
    if (!builds.default) {
      builds.default = builds[id];
    }
  }

  return builds;
}

function* walkBuildExecutables(rootDirectory) {
  const stack = [rootDirectory];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (looksLikeUnityExecutable(entry.name, fullPath)) {
        yield fullPath;
      }
    }
  }
}

function looksLikeUnityExecutable(fileName, fullPath) {
  const lower = fileName.toLowerCase();
  const ext = path.extname(lower);

  if (ext === ".exe" || ext === ".x86_64" || ext === ".app") {
    return true;
  }

  if (ext.length > 0) {
    return false;
  }

  try {
    const stats = fs.statSync(fullPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function createBuildId(executablePath, existingIds) {
  const baseId = sanitizeBuildId(path.basename(executablePath, path.extname(executablePath)));
  let candidate = baseId || "build";
  let suffix = 2;

  while (existingIds.includes(candidate) || candidate === "default") {
    candidate = `${baseId || "build"}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function sanitizeBuildId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createBuildDescriptor(buildId, executablePath) {
  return {
    id: buildId,
    name: path.basename(executablePath, path.extname(executablePath)),
    executablePath,
    workingDirectory: path.dirname(executablePath)
  };
}

module.exports = {
  getAvailableIPv4Addresses,
  isAuthorizedRequest,
  loadHostManagerConfig
};
