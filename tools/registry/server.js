#!/usr/bin/env node

const http = require("http");
const os = require("os");
const { URL } = require("url");

const host = process.env.CXR_REGISTRY_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.CXR_REGISTRY_PORT || "8080", 10);
const rawStaleAfterMs = Number.parseInt(
  process.env.CXR_REGISTRY_STALE_MS || "0",
  10
);
const staleAfterMs = rawStaleAfterMs > 0 ? rawStaleAfterMs : 0;
const maxRecentEvents = Number.parseInt(
  process.env.CXR_REGISTRY_MAX_EVENTS || "200",
  10
);
const registryAdminToken = process.env.CXR_ADMIN_TOKEN || "";

function isAuthorizedDelete(request) {
  if (!registryAdminToken) {
    return true;
  }
  const headerToken = request.headers["x-cxr-admin-token"];
  if (typeof headerToken === "string" && headerToken === registryAdminToken) {
    return true;
  }
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    return false;
  }
  return authorization === `Bearer ${registryAdminToken}`;
}

function getLocalAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name]) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push({ name, address: info.address });
      }
    }
  }

  return addresses;
}

const rooms = new Map();
const recentEvents = [];
const requestCounts = Object.create(null);

function nowMs() {
  return Date.now();
}

function cleanupStaleRooms() {
  if (staleAfterMs <= 0) return;

  const cutoff = nowMs() - staleAfterMs;

  for (const [roomId, room] of rooms.entries()) {
    if ((room.lastSeenUnixMs || 0) < cutoff) {
      rooms.delete(roomId);
      pushEvent({
        type: "stale-room-removed",
        roomId,
        roomName: room.roomName,
        ipAddress: room.ipAddress,
        port: room.port
      });
    }
  }
}

const cleanupInterval = setInterval(() => {
  try {
    cleanupStaleRooms();
  } catch (error) {
    console.error(`${new Date().toISOString()} Stale room cleanup error: ${error.stack || error.message}`);
  }
}, Math.max(5000, staleAfterMs / 2));
cleanupInterval.unref();

function normalizeRoom(input) {
  const roomId =
    typeof input.roomId === "string" && input.roomId.trim().length > 0
      ? input.roomId.trim()
      : `${input.ipAddress || "unknown"}:${input.port || 0}`;

  return {
    roomId,
    roomName:
      typeof input.roomName === "string" && input.roomName.trim().length > 0
        ? input.roomName.trim()
        : "Remote Room",
    ipAddress:
      typeof input.ipAddress === "string" ? input.ipAddress.trim() : "",
    port: Math.max(0, Number.parseInt(input.port || "0", 10)),
    playerCount: Math.max(0, Number.parseInt(input.playerCount || "0", 10)),
    maxPlayers: Math.max(1, Number.parseInt(input.maxPlayers || "1", 10)),
    status:
      typeof input.status === "string" && input.status.trim().length > 0
        ? input.status.trim()
        : "Open",
    lastSeenUnixMs: nowMs(),
    metadata: Array.isArray(input.metadata) ? input.metadata : []
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", chunk => {
      body += chunk;

      if (body.length > 1024 * 64) {
        request.destroy();
        reject(new Error("Request body too large."));
        return;
      }
    });

    request.on("end", () => {
      try {
        resolve(body.length > 0 ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function pushEvent(event) {
  recentEvents.push({
    timestamp: new Date().toISOString(),
    ...event
  });

  while (recentEvents.length > Math.max(20, maxRecentEvents)) {
    recentEvents.shift();
  }
}

function normalizePathname(pathname) {
  if (pathname.startsWith("/rooms/")) {
    return "/rooms/:id";
  }

  return pathname;
}

function sendJson(request, response, statusCode, payload) {
  const body = JSON.stringify(payload);
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const normalizedPathname = normalizePathname(pathname);

  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });

  response.end(body);
  requestCounts[`${request.method} ${normalizedPathname}`] =
    (requestCounts[`${request.method} ${normalizedPathname}`] || 0) + 1;
  pushEvent({
    type: "http-request",
    method: request.method,
    path: normalizedPathname,
    statusCode,
    remoteAddress: request.socket.remoteAddress || "",
    roomCount: rooms.size
  });
  console.log(
    `${new Date().toISOString()} ${request.socket.remoteAddress} ` +
      `${request.method} ${request.url} -> ${statusCode} (${body.length} bytes)`
  );
}

async function handlePost(request, response) {
  try {
    const input = await readJson(request);
    const room = normalizeRoom(input);

    if (!room.ipAddress || room.port <= 0) {
      sendJson(request, response, 400, {
        error: "room ipAddress and port are required"
      });
      return;
    }

    rooms.set(room.roomId, room);
    pushEvent({
      type: "room-upsert",
      roomId: room.roomId,
      roomName: room.roomName,
      ipAddress: room.ipAddress,
      port: room.port,
      playerCount: room.playerCount,
      maxPlayers: room.maxPlayers,
      status: room.status
    });
    sendJson(request, response, 200, { ok: true, room });
  } catch (error) {
    sendJson(request, response, 400, { error: error.message });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(request, response, 200, {
        ok: true,
        rooms: rooms.size,
        staleAfterMs,
        requestCounts,
        recentEventCount: recentEvents.length
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/events") {
      const limit = Math.max(1, Math.min(200, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
      sendJson(request, response, 200, {
        events: recentEvents.slice(-limit),
        requestCounts
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/rooms") {
      sendJson(request, response, 200, { rooms: Array.from(rooms.values()) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/rooms") {
      handlePost(request, response);
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/rooms/")) {
      if (!isAuthorizedDelete(request)) {
        sendJson(request, response, 401, { error: "unauthorized" });
        return;
      }

      const roomId = decodeURIComponent(url.pathname.slice("/rooms/".length));
      const room = rooms.get(roomId) || null;
      const existed = rooms.delete(roomId);
      pushEvent({
        type: "room-delete",
        roomId,
        existed,
        roomName: room?.roomName || "",
        ipAddress: room?.ipAddress || "",
        port: room?.port || 0
      });
      sendJson(request, response, 200, { ok: true });
      return;
    }

    sendJson(request, response, 404, { error: "not found" });
  } catch (error) {
    sendJson(request, response, 500, { error: "internal server error" });
    console.error(`${new Date().toISOString()} Unhandled error: ${error.stack || error.message}`);
  }
});

function gracefulShutdownRegistry() {
  console.log(`${new Date().toISOString()} Shutting down registry...`);
  clearInterval(cleanupInterval);
  server.close(() => {
    console.log(`${new Date().toISOString()} Registry closed.`);
    process.exit(0);
  });
  setTimeout(() => {
    console.error(`${new Date().toISOString()} Registry forced shutdown.`);
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", gracefulShutdownRegistry);
process.on("SIGINT", gracefulShutdownRegistry);

server.listen(port, host, () => {
  const addresses = getLocalAddresses();

  console.log(
    `CXR room registry listening on http://${host}:${port}, staleAfterMs=${staleAfterMs}`
  );

  if (addresses.length === 0) {
    console.log(
      "  Access URLs: http://localhost:" + port +
      " (no external network interfaces detected)"
    );
  } else {
    console.log("  Access URLs:");
    console.log("    http://localhost:" + port + "  (this machine only)");

    for (const addr of addresses) {
      console.log(
        "    http://" + addr.address + ":" + port +
        "  (" + addr.name + ")"
      );
    }

    console.log(
      "  Note: If other machines cannot connect, check your firewall" +
      " allows inbound TCP on port " + port + "."
    );
  }
});
