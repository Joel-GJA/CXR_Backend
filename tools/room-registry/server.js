#!/usr/bin/env node

const http = require("http");
const os = require("os");
const { URL } = require("url");

const host = process.env.CXR_REGISTRY_HOST || "0.0.0.0";
const port = Number.parseInt(process.env.CXR_REGISTRY_PORT || "8080", 10);
const staleAfterMs = Number.parseInt(
  process.env.CXR_REGISTRY_STALE_MS || "15000",
  10
);

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

function nowMs() {
  return Date.now();
}

function cleanupStaleRooms() {
  const cutoff = nowMs() - staleAfterMs;

  for (const [roomId, room] of rooms.entries()) {
    if ((room.lastSeenUnixMs || 0) < cutoff) {
      rooms.delete(roomId);
    }
  }
}

const cleanupInterval = setInterval(
  cleanupStaleRooms,
  Math.max(5000, staleAfterMs / 2)
);
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

function sendJson(request, response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });

  response.end(body);
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
    sendJson(request, response, 200, { ok: true, room });
  } catch (error) {
    sendJson(request, response, 400, { error: error.message });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(request, response, 200, { ok: true, rooms: rooms.size });
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
    const roomId = decodeURIComponent(url.pathname.slice("/rooms/".length));
    rooms.delete(roomId);
    sendJson(request, response, 200, { ok: true });
    return;
  }

  sendJson(request, response, 404, { error: "not found" });
});

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
