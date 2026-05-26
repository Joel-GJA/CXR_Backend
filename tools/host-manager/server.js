const fs = require("fs");
const http = require("http");
const path = require("path");
const RoomManager = require("./src/runtime/roomManager");
const ProcessManager = require("./src/runtime/processManager");
const ServiceTemplate = require("./src/runtime/serviceTemplate");
const LogRotator = require("./src/runtime/logRotator");
const LogWebSocketServer = require("./src/utils/webSocketServer");
const TelemetryForwarder = require("./src/runtime/telemetryForwarder");
const {
  sendJson,
  sendError,
  readJsonBody,
  getRouteMatch
} = require("./src/utils/http");
const {
  getAvailableIPv4Addresses,
  isAuthorizedRequest,
  loadHostManagerConfig,
  watchBuilds
} = require("../shared/runtimeConfig");

const configPath = path.join(__dirname, "config", "default.json");
const config = loadHostManagerConfig(configPath);
const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));

const logRotator = new LogRotator(config.logsDirectory);
const processManager = new ProcessManager(config, logRotator);
const roomManager = new RoomManager(config, processManager);
const serviceTemplate = new ServiceTemplate();
serviceTemplate.loadFromConfig(rawConfig.templates || {}, path.dirname(configPath));

const telemetryForwarder = new TelemetryForwarder(processManager, config);

const dashboardDirectory = path.join(__dirname, "dashboard");
const adminToken = process.env.CXR_ADMIN_TOKEN || "";
const recentRequestActivity = [];
const maxRecentRequestActivity = 200;

const server = http.createServer((request, response) => {
  const startedAt = Date.now();

  response.on("finish", () => {
    recordRequestActivity(request, response.statusCode, startedAt);
  });

  handleRequest(request, response).catch(error => {
    roomManager.log("error", `Unhandled request error: ${error.stack || error.message}`);
    sendError(response, 500, "internal server error");
  });
});

const logWsServer = new LogWebSocketServer(server);

processManager.on("log", (entry) => {
  logWsServer.broadcast(entry);
});

processManager.on("status", (status) => {
  logWsServer.broadcastStatus(status);
});

watchBuilds(path.dirname(configPath), (newBuilds, oldBuilds, diff) => {
  const result = roomManager.refreshBuilds(newBuilds);
  logWsServer.broadcastBuilds(newBuilds, result);
  roomManager.log("info", `Builds updated: +${result.added.length} -${result.removed.length}`);
  for (const id of result.added) {
    roomManager.log("info", `Build added: "${newBuilds[id].name}" (${id})`);
  }
  for (const id of result.removed) {
    roomManager.log("info", `Build removed: "${oldBuilds[id].name}" (${id})`);
  }
});

function gracefulShutdownHostManager() {
  roomManager.log("info", "Shutting down host manager...");
  roomManager.shuttingDown = true;
  telemetryForwarder.stop();
  processManager.shutdown();
  roomManager.shutdown();
  logWsServer.close();

  server.close(() => {
    roomManager.log("info", "Host manager closed.");
    setTimeout(() => process.exit(0), 2000);
  });

  setTimeout(() => {
    roomManager.log("error", "Host manager forced shutdown.");
    process.exit(1);
  }, 8000);
}

process.on("SIGTERM", gracefulShutdownHostManager);
process.on("SIGINT", gracefulShutdownHostManager);

server.listen(config.hostManagerPort, "0.0.0.0", () => {
    roomManager.log(
      "info",
      `CXR Host Manager listening on http://0.0.0.0:${config.hostManagerPort}`
    );

    for (const [buildId, build] of Object.entries(roomManager.listBuilds())) {
      roomManager.log("info", `Build "${build.name}" (${buildId}): ${build.executablePath}`);
    }

    roomManager.log("info", `Registry URL: ${config.registryUrl || "disabled"}`);

    const templates = serviceTemplate.list();
    for (const t of templates) {
      roomManager.log("info", `Template "${t.name}" (${t.type}): ${t.description}`);
    }

    telemetryForwarder.start();
    roomManager.log("info", "Telemetry forwarder started");
});

async function handleRequest(request, response) {
  try {
    if (!isPublicRoute(request) && !isAuthorized(request)) {
      sendError(response, 401, "unauthorized");
      return;
    }

    const rootRoute = getRouteMatch(request, "GET", "/");
    if (rootRoute.matched) {
      await serveDashboardAsset(response, "index.html");
      return;
    }

    const dashboardRootRoute = getRouteMatch(request, "GET", "/dashboard");
    if (dashboardRootRoute.matched) {
      await serveDashboardAsset(response, "index.html");
      return;
    }

    const dashboardTrailingSlashRoute = getRouteMatch(request, "GET", "/dashboard/");
    if (dashboardTrailingSlashRoute.matched) {
      await serveDashboardAsset(response, "index.html");
      return;
    }

    const dashboardIndexRoute = getRouteMatch(request, "GET", "/dashboard/index.html");
    if (dashboardIndexRoute.matched) {
      await serveDashboardAsset(response, "index.html");
      return;
    }

    const dashboardScriptRoute = getRouteMatch(request, "GET", "/dashboard/app.js");
    if (dashboardScriptRoute.matched) {
      await serveDashboardAsset(response, "app.js");
      return;
    }

    const dashboardStylesRoute = getRouteMatch(request, "GET", "/dashboard/styles.css");
    if (dashboardStylesRoute.matched) {
      await serveDashboardAsset(response, "styles.css");
      return;
    }

    const dashboardLogsRoute = getRouteMatch(request, "GET", "/dashboard/logs.html");
    if (dashboardLogsRoute.matched) {
      await serveDashboardAsset(response, "logs.html");
      return;
    }

    const dashboardHealthRoute = getRouteMatch(request, "GET", "/dashboard/health.html");
    if (dashboardHealthRoute.matched) {
      await serveDashboardAsset(response, "health.html");
      return;
    }

    const dashboardServicesRoute = getRouteMatch(request, "GET", "/dashboard/services.html");
    if (dashboardServicesRoute.matched) {
      await serveDashboardAsset(response, "services.html");
      return;
    }

    const buildsListRoute = getRouteMatch(request, "GET", "/builds");
    if (buildsListRoute.matched) {
      sendJson(response, 200, { builds: roomManager.listBuilds() });
      return;
    }

    const configSummaryRoute = getRouteMatch(request, "GET", "/config-summary");
    if (configSummaryRoute.matched) {
      sendJson(response, 200, {
        publicAddress: config.publicAddress,
        roomPortRange: config.roomPortRange,
        builds: roomManager.listBuilds(),
        registryUrl: config.registryUrl,
        logsDirectory: config.logsDirectory,
        templates: serviceTemplate.list()
      });
      return;
    }

    const stateRoute = getRouteMatch(request, "GET", "/api/state");
    if (stateRoute.matched) {
      sendJson(response, 200, {
        rooms: roomManager.listRooms(),
        builds: roomManager.listBuilds(),
        connectionHints: buildConnectionHints(),
        auth: {
          enabled: Boolean(adminToken)
        }
      });
      return;
    }

    const requestActivityRoute = getRouteMatch(request, "GET", "/api/request-activity");
    if (requestActivityRoute.matched) {
      sendJson(response, 200, {
        requests: recentRequestActivity.slice(-60),
        roomActivity: roomManager.getRecentActivity(60)
      });
      return;
    }

    const hostLogRoute = getRouteMatch(request, "GET", "/api/logs/host-manager");
    if (hostLogRoute.matched) {
      sendJson(response, 200, {
        text: readTextFileTail(roomManager.hostLogPath, 400)
      });
      return;
    }

    const registryStateRoute = getRouteMatch(request, "GET", "/api/registry-state");
    if (registryStateRoute.matched) {
      sendJson(response, 200, await getRegistryState());
      return;
    }

    const roomLogRoute = getRouteMatch(request, "GET", "/api/logs/rooms/:id");
    if (roomLogRoute.matched) {
      const room = roomManager.getRoom(roomLogRoute.params.id);

      if (!room) {
        sendError(response, 404, "room not found");
        return;
      }

      sendJson(response, 200, {
        stdout: readTextFileTail(room.stdoutLogPath, 220),
        stderr: readTextFileTail(room.stderrLogPath, 220)
      });
      return;
    }

    const healthRoute = getRouteMatch(request, "GET", "/health");
    if (healthRoute.matched) {
      sendJson(response, 200, {
        ok: true,
        service: "cxr-host-manager",
        hostManagerPort: config.hostManagerPort,
        roomCount: roomManager.listRooms().length,
        authEnabled: Boolean(adminToken)
      });
      return;
    }

    const listRoomsRoute = getRouteMatch(request, "GET", "/rooms");
    if (listRoomsRoute.matched) {
      sendJson(response, 200, { rooms: roomManager.listRooms() });
      return;
    }

    const createRoomRoute = getRouteMatch(request, "POST", "/rooms");
    if (createRoomRoute.matched) {
      const body = await readJsonBody(request);
      const room = roomManager.createRoom(body);
      sendJson(response, 201, room);
      return;
    }

    const getRoomRoute = getRouteMatch(request, "GET", "/rooms/:id");
    if (getRoomRoute.matched) {
      const room = roomManager.getRoom(getRoomRoute.params.id);

      if (!room) {
        sendError(response, 404, "room not found");
        return;
      }

      sendJson(response, 200, room);
      return;
    }

    const stopRoomRoute = getRouteMatch(request, "POST", "/rooms/:id/stop");
    if (stopRoomRoute.matched) {
      const room = roomManager.stopRoom(stopRoomRoute.params.id);
      sendJson(response, 200, room);
      return;
    }

    const restartRoomRoute = getRouteMatch(request, "POST", "/rooms/:id/restart");
    if (restartRoomRoute.matched) {
      const room = roomManager.restartRoom(restartRoomRoute.params.id);
      sendJson(response, 200, room);
      return;
    }

    if (handleServiceRoutes(request, response)) {
      return;
    }

    const telemetryRoute = getRouteMatch(request, "GET", "/api/telemetry");
    if (telemetryRoute.matched) {
      sendJson(response, 200, telemetryForwarder.getSnapshot());
      return;
    }

    const templatesRoute = getRouteMatch(request, "GET", "/api/templates");
    if (templatesRoute.matched) {
      sendJson(response, 200, { templates: serviceTemplate.list() });
      return;
    }

    sendError(response, 404, "not found");
  } catch (error) {
    if (error.message.includes("not found")) {
      sendError(response, 404, error.message);
      return;
    }

    if (error.message.includes("not running") || error.message.includes("not in a valid state")) {
      sendError(response, 409, error.message);
      return;
    }

    sendError(response, 400, error.message);
  }
}

function handleServiceRoutes(request, response) {
  const listServices = getRouteMatch(request, "GET", "/services");
  if (listServices.matched) {
    sendJson(response, 200, { services: processManager.list() });
    return true;
  }

  const createService = getRouteMatch(request, "POST", "/services");
  if (createService.matched) {
    handleCreateService(request, response).catch(error => {
      sendError(response, 400, error.message);
    });
    return true;
  }

  const getService = getRouteMatch(request, "GET", "/services/:id");
  if (getService.matched) {
    try {
      const svc = processManager.getStatus(getService.params.id);
      sendJson(response, 200, svc);
    } catch (error) {
      sendError(response, 404, error.message);
    }
    return true;
  }

  const deleteService = getRouteMatch(request, "DELETE", "/services/:id");
  if (deleteService.matched) {
    try {
      processManager.remove(deleteService.params.id);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendError(response, 404, error.message);
    }
    return true;
  }

  const restartService = getRouteMatch(request, "POST", "/services/:id/restart");
  if (restartService.matched) {
    try {
      const svc = processManager.restart(restartService.params.id);
      sendJson(response, 200, svc);
    } catch (error) {
      if (error.message.includes("not found")) {
        sendError(response, 404, error.message);
      } else {
        sendError(response, 409, error.message);
      }
    }
    return true;
  }

  const stopService = getRouteMatch(request, "POST", "/services/:id/stop");
  if (stopService.matched) {
    try {
      const svc = processManager.stop(stopService.params.id);
      sendJson(response, 200, svc);
    } catch (error) {
      if (error.message.includes("not found")) {
        sendError(response, 404, error.message);
      } else {
        sendError(response, 409, error.message);
      }
    }
    return true;
  }

  const serviceLog = getRouteMatch(request, "GET", "/api/logs/services/:id");
  if (serviceLog.matched) {
    try {
      const svc = processManager.getStatus(serviceLog.params.id);
      sendJson(response, 200, {
        stdout: logRotator.readTail(serviceLog.params.id, "stdout", 220),
        stderr: logRotator.readTail(serviceLog.params.id, "stderr", 220)
      });
    } catch (error) {
      sendError(response, 404, error.message);
    }
    return true;
  }

  return false;
}

async function handleCreateService(request, response) {
  const body = await readJsonBody(request);
  const templateName = body.template || body.templateName;
  if (!templateName) {
    sendError(response, 400, "template or templateName is required");
    return;
  }

  if (!serviceTemplate.has(templateName)) {
    sendError(response, 400, `Unknown template "${templateName}"`);
    return;
  }

  const template = serviceTemplate.get(templateName);
  if (template.type === "built-in") {
    sendError(response, 400, `Template "${templateName}" is built-in and cannot be started as a process`);
    return;
  }

  const overrides = body.overrides || {};

  let resolved;
  if (template.type === "dynamic") {
    if (templateName === "unity-room") {
      const buildId = overrides.buildId || null;
      const build = buildId ? roomManager.findBuild(buildId) : roomManager.findBuild(null);
      if (!build) {
        sendError(response, 400, "No build available for unity-room template");
        return;
      }
      resolved = {
        type: "process",
        executable: build.executablePath,
        args: overrides.args || [],
        cwd: build.workingDirectory,
        env: overrides.env || {},
        templateName: "unity-room",
        maxRestarts: 10,
        needsPort: true
      };
    } else {
      sendError(response, 400, `Dynamic template "${templateName}" has no resolution handler`);
      return;
    }
  } else {
    resolved = serviceTemplate.resolve(templateName, overrides);
  }

  if (!resolved) {
    sendError(response, 400, `Failed to resolve template "${templateName}"`);
    return;
  }

  const serviceId = processManager.start(resolved, overrides);
  const status = processManager.getStatus(serviceId);
  sendJson(response, 201, status);
}

async function serveDashboardAsset(response, assetName) {
  const assetPath = path.join(dashboardDirectory, assetName);
  const contentType = getContentType(assetName);
  const body = await fs.promises.readFile(assetPath);

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });

  response.end(body);
}

function getContentType(assetName) {
  if (assetName.endsWith(".html")) return "text/html; charset=utf-8";
  if (assetName.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (assetName.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function readTextFileTail(filePath, maxLines) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return "";
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(Math.min(stat.size, 65536));
    const readSize = Math.min(stat.size, buffer.length);
    const bytesRead = fs.readSync(fd, buffer, 0, readSize, Math.max(0, stat.size - readSize));
    fs.closeSync(fd);

    const tail = buffer.toString("utf8", 0, bytesRead);
    const lines = tail.split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - maxLines)).join("\n");
  } catch (error) {
    if (error.code === "ENOENT") {
      return "";
    }

    return "";
  }
}

function buildConnectionHints() {
  const availableAddresses = getAvailableIPv4Addresses();
  const hostManagerUrl = `http://${config.publicAddress}:${config.hostManagerPort}`;
  const registryPort = getUrlPort(config.registryUrl, 8080);
  const registryHost = getUrlHost(config.registryUrl);
  const remoteRegistryHost = isLoopbackHost(registryHost) ? config.publicAddress : registryHost;
  const remoteRegistryUrl = remoteRegistryHost
    ? `http://${remoteRegistryHost}:${registryPort}`
    : "";
  const rooms = roomManager.listRooms().filter(room => room.status === "running" || room.status === "starting");
  const selectedRoom = rooms[0] || null;
  const warnings = [];

  if (!availableAddresses.includes(config.publicAddress)) {
    warnings.push("Configured publicAddress is not one of the server's detected IPv4 addresses.");
  }

  if (isLoopbackHost(registryHost)) {
    warnings.push("Registry publish target is loopback-only for the server process. Clients must use the external registry URL shown here, not 127.0.0.1.");
  }

  return {
    hostManagerUrl,
    availableAddresses,
    warning: warnings.join(" "),
    xrMultiplayerDebugGui: {
      directConnectAddress: selectedRoom ? `${selectedRoom.ip}:${selectedRoom.port}` : "",
      remoteRegistryUrl
    },
    curl: {
      createRoom: `curl -X POST ${hostManagerUrl}/rooms -H "Content-Type: application/json" -d "{\\"requestedName\\":\\"Client Join Test\\",\\"maxParticipants\\":8}"`,
      listRooms: `curl ${hostManagerUrl}/rooms`,
      registryRooms: remoteRegistryUrl ? `curl ${remoteRegistryUrl}/rooms` : ""
    }
  };
}

function getUrlHost(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(value).hostname;
  } catch (error) {
    return "";
  }
}

function getUrlPort(value, fallbackPort) {
  if (!value) {
    return fallbackPort;
  }

  try {
    const parsed = new URL(value);
    return parsed.port ? Number.parseInt(parsed.port, 10) : fallbackPort;
  } catch (error) {
    return fallbackPort;
  }
}

function isLoopbackHost(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function isPublicRoute(request) {
  const pathname = new URL(request.url, "http://localhost").pathname;

  return pathname === "/" ||
    pathname === "/dashboard" ||
    pathname === "/dashboard/" ||
    pathname === "/dashboard/index.html" ||
    pathname === "/dashboard/app.js" ||
    pathname === "/dashboard/styles.css" ||
    pathname === "/dashboard/logs.html" ||
    pathname === "/dashboard/health.html" ||
    pathname === "/dashboard/services.html";
}

function isAuthorized(request) {
  return isAuthorizedRequest(request, adminToken);
}

async function getRegistryState() {
  if (!config.registryUrl) {
    return {
      configured: false,
      url: "",
      ok: false,
      health: null,
      rooms: [],
      error: "Registry URL is not configured."
    };
  }

  try {
    const [health, roomsPayload, eventsPayload] = await Promise.all([
      fetchJson(`${config.registryUrl}/health`),
      fetchJson(`${config.registryUrl}/rooms`),
      fetchJsonOptional(`${config.registryUrl}/events?limit=50`, {
        events: [],
        requestCounts: {}
      })
    ]);

    return {
      configured: true,
      url: config.registryUrl,
      ok: true,
      health,
      rooms: Array.isArray(roomsPayload.rooms) ? roomsPayload.rooms : [],
      events: Array.isArray(eventsPayload.events) ? eventsPayload.events : [],
      requestCounts: eventsPayload.requestCounts || health.requestCounts || {},
      error: ""
    };
  } catch (error) {
    return {
      configured: true,
      url: config.registryUrl,
      ok: false,
      health: null,
      rooms: [],
      events: [],
      requestCounts: {},
      error: error.message
    };
  }
}

function fetchJson(urlString) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlString);
    const client = parsedUrl.protocol === "https:" ? require("https") : require("http");

    const request = client.request(
      parsedUrl,
      {
        method: "GET",
        timeout: 5000
      },
      response => {
        let body = "";

        response.on("data", chunk => {
          body += chunk;
        });

        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Request failed with status ${response.statusCode}`));
            return;
          }

          try {
            resolve(body.length > 0 ? JSON.parse(body) : {});
          } catch (error) {
            reject(new Error(`Invalid JSON from ${urlString}: ${error.message}`));
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error(`Request timed out for ${urlString}`));
    });

    request.on("error", reject);
    request.end();
  });
}

function fetchJsonOptional(urlString, fallbackValue) {
  return fetchJson(urlString).catch(() => fallbackValue);
}

function recordRequestActivity(request, statusCode, startedAt) {
  const pathname = new URL(request.url, "http://localhost").pathname;

  let roomId = "";
  const roomIdMatch = pathname.match(/^\/(?:api\/logs\/)?rooms\/([^/]+)/);
  if (roomIdMatch) roomId = decodeURIComponent(roomIdMatch[1]);

  recentRequestActivity.push({
    timestamp: new Date().toISOString(),
    method: request.method,
    path: normalizeRequestPath(pathname),
    originalPath: pathname,
    roomId: roomId,
    statusCode,
    durationMs: Date.now() - startedAt,
    remoteAddress: request.socket.remoteAddress || ""
  });

  while (recentRequestActivity.length > maxRecentRequestActivity) {
    recentRequestActivity.shift();
  }
}

function normalizeRequestPath(pathname) {
  if (pathname.startsWith("/rooms/") && pathname.endsWith("/stop")) {
    return "/rooms/:id/stop";
  }

  if (pathname.startsWith("/rooms/") && pathname.endsWith("/restart")) {
    return "/rooms/:id/restart";
  }

  if (pathname.startsWith("/rooms/")) {
    return "/rooms/:id";
  }

  if (pathname.startsWith("/api/logs/rooms/")) {
    return "/api/logs/rooms/:id";
  }

  return pathname;
}
