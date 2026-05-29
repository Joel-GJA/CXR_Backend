const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const { exec } = require("child_process");

const MAX_RESTARTS = 10;

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

class RoomManager {
  constructor(config, processManager) {
    this.config = validateConfig(config);
    this.processManager = processManager;
    this.builds = config.builds || {};
    this.buildIds = Object.keys(this.builds);
    this.defaultBuildId = this.buildIds.includes("default")
      ? "default"
      : this.buildIds[0] || null;
    this.rooms = new Map();
    this.recentActivity = [];
    this.hostLogPath = path.join(this.config.logsDirectory, "host-manager.log");
    this.shuttingDown = false;
    this.serviceIdToRoomId = new Map();

    fs.mkdirSync(this.config.logsDirectory, { recursive: true });

    this.processManager.on("log", (entry) => {
      this.log("stdout", `[${entry.serviceId}] ${entry.data.trimEnd()}`);
    });

    this.processManager.on("status", (status) => {
      const roomId = this.serviceIdToRoomId.get(status.serviceId) || status.serviceId;
      if (this.rooms.has(roomId)) {
        const room = this.rooms.get(roomId);
        room.status = status.status;
        if (status.pid) room.pid = status.pid;
        if (status.code !== undefined) room.lastExitCode = status.code;
        if (status.signal !== undefined) room.lastExitSignal = status.signal;
        if (status.status === "running" && !room.startedAtUtc) {
          room.startedAtUtc = new Date().toISOString();
        }
        if (status.status === "stopped" || status.status === "failed") {
          room.stoppedAtUtc = new Date().toISOString();
          room.pid = null;
          // Instantly clear the room from the registry so it disappears from
          // clients/panel the moment the process exits (don't wait for stale TTL).
          this.unpublishRoom(room);
          if (status.error) {
            this.writeRoomLog(
              path.join(this.config.logsDirectory, `${roomId}.stderr.log`),
              `${status.error}\n`
            );
          }
        }
        this.recordActivity("room-status", {
          roomId,
          status: status.status,
          code: status.code,
          signal: status.signal
        });
      }
    });
  }

  listBuilds() {
    return this.builds;
  }

  refreshBuilds(newBuilds) {
    const oldIds = this.buildIds;
    const newIds = Object.keys(newBuilds);
    const added = newIds.filter(id => !oldIds.includes(id));
    const removed = oldIds.filter(id => !newIds.includes(id));
    this.builds = newBuilds;
    this.buildIds = newIds;
    if (!this.buildIds.includes(this.defaultBuildId)) {
      this.defaultBuildId = this.buildIds.includes("default")
        ? "default"
        : this.buildIds[0] || null;
    }
    return { added, removed };
  }

  findBuild(buildId) {
    if (buildId && this.builds[buildId]) {
      return this.builds[buildId];
    }
    if (this.defaultBuildId) {
      return this.builds[this.defaultBuildId];
    }
    return null;
  }

  listRooms() {
    return Array.from(this.rooms.values())
      .sort((left, right) => left.createdAtUtc.localeCompare(right.createdAtUtc))
      .map(room => this.serializeRoom(room));
  }

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    return room ? this.serializeRoom(room) : null;
  }

  getRecentActivity(limit = 60) {
    return this.recentActivity.slice(-Math.max(1, limit));
  }

  async createRoom(requestBody = {}) {
    const requestedName = normalizeRequestedName(requestBody.requestedName);
    const roomId = createRoomId();
    const port = await this.allocatePort();
    const metadata = normalizeMetadata(requestBody.metadata);
    const maxParticipants = normalizePositiveInteger(requestBody.maxParticipants);
    const requestedBuildId = normalizeBuildId(requestBody.buildId, this.buildIds);
    const effectiveBuildId = requestedBuildId || this.defaultBuildId;

    if (requestBody.buildId !== undefined && requestBody.buildId !== null && requestBody.buildId !== "" && !requestedBuildId) {
      throw new Error(`Unknown build "${requestBody.buildId}". Available builds: ${this.buildIds.join(", ") || "none"}`);
    }

    const build = this.findBuild(effectiveBuildId);

    if (!build) {
      throw new Error("No builds available. At least one Unity build must be discovered in unity-builds/.");
    }

    const launchCommand = this.buildLaunchCommand(effectiveBuildId, build, roomId, requestedName, port, maxParticipants, metadata);

    const room = {
      roomId,
      buildId: effectiveBuildId,
      serviceId: roomId,
      requestedName,
      publicAddress: this.config.publicAddress,
      port,
      status: "starting",
      pid: null,
      createdAtUtc: new Date().toISOString(),
      startedAtUtc: null,
      stoppedAtUtc: null,
      lastExitCode: null,
      lastExitSignal: null,
      restartCount: 0,
      metadata,
      maxParticipants,
      stdoutLogPath: path.join(this.config.logsDirectory, `${roomId}.stdout.log`),
      stderrLogPath: path.join(this.config.logsDirectory, `${roomId}.stderr.log`),
      launchCommand
    };

    this.rooms.set(roomId, room);
    this.serviceIdToRoomId.set(roomId, roomId);

    try {
      await this.processManager.start(
        {
          type: "process",
          executable: launchCommand.executable,
          args: launchCommand.args,
          cwd: launchCommand.workingDirectory,
          env: {},
          templateName: "unity-room",
          maxRestarts: MAX_RESTARTS
        },
        {
          serviceId: roomId,
          port,
          label: requestedName
        }
      );
      this.recordActivity("room-created", {
        roomId,
        requestedName,
        port,
        publicAddress: this.config.publicAddress,
        maxParticipants
      });
      this.log("info", `Created room ${roomId} (${requestedName}) on ${this.config.publicAddress}:${port}`);
    } catch (error) {
      room.status = "failed";
      room.stoppedAtUtc = new Date().toISOString();
      this.writeRoomLog(room.stderrLogPath, `${error.stack || error.message}\n`);
      this.recordActivity("room-create-failed", {
        roomId,
        requestedName,
        port,
        message: error.message
      });
      this.log("error", `Room ${roomId} failed during launch setup: ${error.message}`);
    }

    return this.serializeRoom(room);
  }

  stopRoom(roomId) {
    const room = this.requireRoom(roomId);
    const serviceStatus = this.processManager.getStatus(room.serviceId);
    if (!serviceStatus || serviceStatus.status === "stopped" || serviceStatus.status === "failed") {
      throw new Error(`Room ${roomId} is not running.`);
    }
    const result = this.processManager.stop(room.serviceId);
    room.status = "stopping";
    room.stoppedAtUtc = new Date().toISOString();
    // Remove from registry immediately on user request — don't wait for process exit.
    this.unpublishRoom(room);
    this.recordActivity("room-stop-requested", { roomId, pid: room.pid, port: room.port });
    this.log("info", `Stopping room ${roomId}`);
    return this.serializeRoom(room);
  }

  restartRoom(roomId) {
    const room = this.requireRoom(roomId);
    const build = this.findBuild(room.buildId);
    const launchCommand = this.buildLaunchCommand(
      room.buildId, build, room.roomId, room.requestedName, room.port, room.maxParticipants, room.metadata
    );
    room.launchCommand = launchCommand;

    try {
      const result = this.processManager.restart(room.serviceId);
      room.status = "starting";
      room.restartCount++;
      this.recordActivity("room-restarting", { roomId, port: room.port, restartCount: room.restartCount });
      this.log("info", `Restarting room ${roomId}`);
    } catch (error) {
      this.log("error", `Room ${roomId} restart failed: ${error.message}`);
    }
    return this.serializeRoom(room);
  }

  restartAllRooms() {
    const roomIds = Array.from(this.rooms.keys());
    if (roomIds.length === 0) return;
    this.log("info", `Restarting all ${roomIds.length} rooms due to IP change`);
    for (const roomId of roomIds) {
      try {
        this.restartRoom(roomId);
      } catch (e) {
        this.log("error", `Failed to restart room ${roomId}: ${e.message}`);
      }
    }
  }

  buildLaunchCommand(buildId, build, roomId, requestedName, port, maxParticipants, metadata) {
    const args = [
      "-batchmode",
      "-nographics",
      "-logFile",
      "-",
      "--cxr-headless-server",
      "--room-name",
      requestedName,
      "--port",
      String(port),
      "--public-address",
      this.config.publicAddress
    ];

    if (this.config.registryUrl) {
      args.push("--registry-url", this.config.registryUrl);
    }

    if (typeof maxParticipants === "number") {
      args.push("--max-participants", String(maxParticipants));
    }

    args.push("--metadata", `source=host-manager`);
    args.push("--metadata", `roomId=${roomId}`);
    args.push("--metadata", `buildId=${buildId}`);

    for (const item of metadata) {
      args.push("--metadata", item);
    }

    return {
      executable: build.executablePath,
      args,
      workingDirectory: build.workingDirectory
    };
  }

  _getReservedPorts() {
    const reserved = new Set();
    if (this.config.hostManagerPort) {
      reserved.add(this.config.hostManagerPort);
    }
    if (this.config.registryUrl) {
      try {
        const parsed = new URL(this.config.registryUrl);
        if (parsed.port) reserved.add(Number(parsed.port));
      } catch (_) {}
    }
    return reserved;
  }

  async allocatePort() {
    const usedPorts = new Set(
      Array.from(this.rooms.values())
        .filter(room => room.status !== "stopped" && room.status !== "failed")
        .map(room => room.port)
    );
    const reservedPorts = this._getReservedPorts();

    for (let port = this.config.roomPortRange.start; port <= this.config.roomPortRange.end; port += 1) {
      if (usedPorts.has(port) || reservedPorts.has(port)) continue;
      if (await isPortAvailable(port)) {
        return port;
      }
    }

    throw new Error("No free room ports are available.");
  }

  writeRoomLog(logPath, content) {
    try {
      fs.appendFileSync(logPath, content);
    } catch (error) {
      console.error(`Failed to write room log ${logPath}: ${error.message}`);
    }
  }

  recordActivity(type, details = {}) {
    this.recentActivity.push({
      timestamp: new Date().toISOString(),
      type,
      ...details
    });

    while (this.recentActivity.length > 200) {
      this.recentActivity.shift();
    }
  }

  unpublishRoom(room) {
    if (!this.config.registryUrl) {
      return;
    }

    this.deleteRegistryRoom(room.roomId)
      .then(() => {
        this.recordActivity("registry-room-removed", { roomId: room.roomId, port: room.port });
        this.log("info", `Registry entry cleared for room ${room.roomId}`);
      })
      .catch(error => {
        this.recordActivity("registry-room-remove-failed", { roomId: room.roomId, port: room.port, message: error.message });
        this.log("error", `Unable to clear registry entry for ${room.roomId}: ${error.message}`);
      });
  }

  deleteRegistryRoom(roomId) {
    return new Promise((resolve, reject) => {
      const targetUrl = new URL(
        `/rooms/${encodeURIComponent(roomId)}`,
        this.config.registryUrl.endsWith("/")
          ? this.config.registryUrl
          : `${this.config.registryUrl}/`
      );
      const client = targetUrl.protocol === "https:" ? require("https") : require("http");
      const request = client.request(
        targetUrl,
        { method: "DELETE", timeout: 5000 },
        response => {
          response.resume();
          if ((response.statusCode >= 200 && response.statusCode < 300) || response.statusCode === 404) {
            resolve();
            return;
          }
          reject(new Error(`Registry returned status ${response.statusCode}`));
        }
      );
      request.on("timeout", () => { request.destroy(new Error("Registry delete request timed out.")); });
      request.on("error", reject);
      request.end();
    });
  }

  killProcessByPort(port) {
    return new Promise((resolve) => {
      const isWindows = process.platform === "win32";
      const findCmd = isWindows
        ? `netstat -ano | findstr ":${port}"`
        : `lsof -ti :${port}`;

      exec(findCmd, { timeout: 5000 }, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve({ killed: false, error: error ? error.message : "No process found on port" });
          return;
        }

        let pid = null;
        if (isWindows) {
          const lines = stdout.trim().split(/\r?\n/);
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const last = parts[parts.length - 1];
            if (/^\d+$/.test(last)) {
              const match = line.match(/(\d+)\s*$/);
              if (match) {
                pid = match[1];
                break;
              }
            }
          }
        } else {
          pid = stdout.trim().split(/\r?\n/)[0].trim();
        }

        if (!pid) {
          resolve({ killed: false, error: "Could not parse PID from port lookup" });
          return;
        }

        const killCmd = isWindows ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
        exec(killCmd, { timeout: 5000 }, (killError) => {
          if (killError) {
            resolve({ killed: false, pid, error: killError.message });
          } else {
            resolve({ killed: true, pid });
          }
        });
      });
    });
  }

  serializeRoom(room) {
    let cpu = null;
    let memory = null;
    let uptime = null;
    try {
      const svc = this.processManager.getStatus(room.serviceId);
      if (svc) {
        cpu = svc.cpu;
        memory = svc.memory;
        uptime = svc.uptime;
        room.status = svc.status;
        room.pid = svc.pid;
      }
    } catch (e) {
    }

    return {
      roomId: room.roomId,
      serviceId: room.serviceId,
      buildId: room.buildId || this.defaultBuildId,
      requestedName: room.requestedName,
      ip: room.publicAddress,
      port: room.port,
      status: room.status,
      pid: room.pid,
      createdAtUtc: room.createdAtUtc,
      startedAtUtc: room.startedAtUtc,
      stoppedAtUtc: room.stoppedAtUtc,
      lastExitCode: room.lastExitCode,
      lastExitSignal: room.lastExitSignal,
      restartCount: room.restartCount,
      maxParticipants: room.maxParticipants,
      metadata: room.metadata,
      stdoutLogPath: room.stdoutLogPath,
      stderrLogPath: room.stderrLogPath,
      launchCommand: room.launchCommand,
      cpu,
      memory,
      uptime
    };
  }

  requireRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} was not found.`);
    }
    return room;
  }

  log(level, message) {
    const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
    try {
      fs.appendFileSync(this.hostLogPath, `${line}\n`);
    } catch (error) {
      console.error(`Failed to write host log: ${error.message}`);
    }
    console.log(line);
  }

  shutdown() {
    this.shuttingDown = true;
    for (const room of this.rooms.values()) {
      try {
        this.processManager.stop(room.serviceId);
      } catch (e) {
      }
    }
  }
}

function validateConfig(config) {
  const requiredStringFields = ["publicAddress", "logsDirectory"];

  for (const field of requiredStringFields) {
    if (typeof config[field] !== "string" || config[field].trim().length === 0) {
      throw new Error(`Missing required config field: ${field}`);
    }
  }

  if (!config.builds || Object.keys(config.builds).length === 0) {
    console.warn('[RoomManager] No Unity builds found. Create rooms will fail until a build is available.');
  }

  if (
    !config.roomPortRange ||
    typeof config.roomPortRange.start !== "number" ||
    typeof config.roomPortRange.end !== "number" ||
    config.roomPortRange.start > config.roomPortRange.end
  ) {
    throw new Error("Invalid roomPortRange configuration.");
  }

  if (typeof config.hostManagerPort !== "number" || config.hostManagerPort <= 0) {
    throw new Error("Invalid hostManagerPort configuration.");
  }

  return config;
}

function createRoomId() {
  return `room-${crypto.randomBytes(3).toString("hex")}`;
}

function normalizeRequestedName(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "CXR Room";
  }
  return value.trim();
}

function normalizePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("maxParticipants must be a positive integer when provided.");
  }
  return parsed;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("metadata must be an array of key=value strings.");
  }
  return value.map(item => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new Error("metadata entries must be non-empty strings.");
    }
    return item.trim();
  });
}

function normalizeBuildId(value, validBuildIds) {
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    if (validBuildIds.includes(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

module.exports = RoomManager;

