const { spawn } = require("child_process");
const crypto = require("crypto");
const EventEmitter = require("events");

class ProcessManager extends EventEmitter {
  constructor(config, logRotator) {
    super();
    this.config = config;
    this.logRotator = logRotator;
    this.services = new Map();
    this._metricsIntervals = new Map();
  }

  start(resolvedTemplate, overrides = {}) {
    const serviceId = overrides.serviceId || `srv-${crypto.randomBytes(3).toString("hex")}`;
    const needsPort = resolvedTemplate.needsPort === true || overrides.port != null;
    const port = overrides.port != null ? overrides.port : (needsPort ? this.allocatePort() : 0);

    const service = {
      serviceId,
      templateName: resolvedTemplate.templateName || "",
      status: "starting",
      pid: null,
      port,
      executable: resolvedTemplate.executable,
      args: [...(resolvedTemplate.args || [])],
      cwd: resolvedTemplate.cwd || process.cwd(),
      env: { ...(resolvedTemplate.env || {}) },
      createdAtUtc: new Date().toISOString(),
      startedAtUtc: null,
      stoppedAtUtc: null,
      lastExitCode: null,
      lastExitSignal: null,
      restartCount: 0,
      maxRestarts: resolvedTemplate.maxRestarts != null ? resolvedTemplate.maxRestarts : 10,
      pendingRestart: false,
      childProcess: null,
      cpu: null,
      memory: null
    };

    if (overrides.label) service.label = overrides.label;
    if (overrides.env) {
      for (const [key, value] of Object.entries(overrides.env)) {
        service.env[key] = String(value);
      }
    }

    this.services.set(serviceId, service);
    this._spawn(service);
    return serviceId;
  }

  stop(serviceId) {
    const service = this._require(serviceId);
    if (!service.childProcess || service.childProcess.killed || service.status === "stopped" || service.status === "failed") {
      throw new Error(`Service ${serviceId} is not running.`);
    }
    service.status = "stopping";
    service.stoppedAtUtc = new Date().toISOString();
    service.childProcess.kill("SIGTERM");
    return this._serialize(service);
  }

  restart(serviceId) {
    const service = this._require(serviceId);
    if (service.childProcess && !service.childProcess.killed &&
        (service.status === "running" || service.status === "starting" || service.status === "stopping")) {
      service.pendingRestart = true;
      service.status = "stopping";
      service.stoppedAtUtc = new Date().toISOString();
      this.emit("status", { serviceId, status: "stopping" });
      service.childProcess.kill("SIGTERM");
      return this._serialize(service);
    }
    this._prepareRestart(service);
    this._spawn(service);
    return this._serialize(service);
  }

  getStatus(serviceId) {
    const service = this._require(serviceId);
    return this._serialize(service);
  }

  list() {
    return Array.from(this.services.values())
      .sort((a, b) => a.createdAtUtc.localeCompare(b.createdAtUtc))
      .map(s => this._serialize(s));
  }

  remove(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) throw new Error(`Service ${serviceId} not found.`);
    if (service.childProcess && !service.childProcess.killed) {
      service.childProcess.kill("SIGKILL");
    }
    this._clearMetrics(serviceId);
    this.services.delete(serviceId);
  }

  allocatePort() {
    const usedPorts = new Set(
      Array.from(this.services.values())
        .filter(s => s.status !== "stopped" && s.status !== "failed")
        .map(s => s.port)
        .filter(p => p > 0)
    );
    for (let port = this.config.roomPortRange.start; port <= this.config.roomPortRange.end; port++) {
      if (!usedPorts.has(port)) return port;
    }
    throw new Error("No free ports available.");
  }

  _spawn(service) {
    const env = { ...process.env };
    for (const [key, value] of Object.entries(service.env)) {
      env[key] = value;
    }
    const childProcess = spawn(service.executable, service.args, {
      cwd: service.cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    service.childProcess = childProcess;
    service.pid = childProcess.pid || null;

    childProcess.stdout.on("data", chunk => {
      if (service.status === "starting") {
        service.status = "running";
        service.startedAtUtc = new Date().toISOString();
        service.pendingRestart = false;
        this.emit("status", { serviceId: service.serviceId, status: "running", pid: service.pid });
        this._startMetrics(service.serviceId);
      }
      this.logRotator.append(service.serviceId, "stdout", chunk);
      this.emit("log", { serviceId: service.serviceId, stream: "stdout", data: chunk.toString() });
    });

    childProcess.stderr.on("data", chunk => {
      this.logRotator.append(service.serviceId, "stderr", chunk);
      this.emit("log", { serviceId: service.serviceId, stream: "stderr", data: chunk.toString() });
    });

    childProcess.on("error", error => {
      service.status = "failed";
      service.lastExitCode = null;
      service.lastExitSignal = null;
      service.stoppedAtUtc = new Date().toISOString();
      this._clearMetrics(service.serviceId);
      const msg = `${error.stack || error.message}\n`;
      this.logRotator.append(service.serviceId, "stderr", msg);
      this.emit("log", { serviceId: service.serviceId, stream: "stderr", data: msg });
      this.emit("status", { serviceId: service.serviceId, status: "failed", error: error.message });
    });

    childProcess.on("exit", (code, signal) => {
      const shouldRestart = service.pendingRestart && service.restartCount < service.maxRestarts;
      service.lastExitCode = code;
      service.lastExitSignal = signal;
      service.stoppedAtUtc = new Date().toISOString();
      this._clearMetrics(service.serviceId);
      service.childProcess = null;
      service.pid = null;

      if (shouldRestart) {
        service.status = "stopped";
      } else if (service.status === "stopping") {
        service.status = "stopped";
      } else if (code === 0 || signal === "SIGTERM") {
        service.status = "stopped";
      } else {
        service.status = "failed";
      }

      this.emit("status", {
        serviceId: service.serviceId,
        status: service.status,
        code,
        signal,
        restartCount: service.restartCount
      });

      if (shouldRestart) {
        service.pendingRestart = false;
        service.restartCount++;
        this._prepareRestart(service);
        this._spawn(service);
      }
    });
  }

  _prepareRestart(service) {
    service.restartCount++;
    service.status = "starting";
    service.pid = null;
    service.startedAtUtc = null;
    service.stoppedAtUtc = null;
    service.lastExitCode = null;
    service.lastExitSignal = null;
    service.pendingRestart = false;
    service.cpu = null;
    service.memory = null;
  }

  _startMetrics(serviceId) {
    this._clearMetrics(serviceId);
    this._pollMetrics(serviceId);
  }

  _pollMetrics(serviceId) {
    const interval = setInterval(() => {
      const service = this.services.get(serviceId);
      if (!service || !service.childProcess || service.childProcess.killed) {
        this._clearMetrics(serviceId);
        return;
      }
      const pid = service.childProcess.pid;
      if (!pid) return;
      try {
        const usage = process.pidusage ? undefined : undefined;
        this._readProcessMetrics(pid, service);
        this.emit("metrics", {
          serviceId,
          cpu: service.cpu,
          memory: service.memory,
          uptime: service.startedAtUtc ? Math.floor((Date.now() - new Date(service.startedAtUtc).getTime()) / 1000) : null
        });
      } catch (e) {
      }
    }, 5000);
    this._metricsIntervals.set(serviceId, interval);
  }

  _readProcessMetrics(pid, service) {
    if (process.platform === "win32") {
      try {
        const { execFileSync } = require("child_process");
        const out = execFileSync("powershell", [
          "-NoProfile",
          "-Command",
          `Get-Process -Id ${pid} | Select-Object @{N='CPU';E={$_.CPU}}, @{N='PM';E={$_.WorkingSet64}} | ConvertTo-Json`
        ], { timeout: 2000, encoding: "utf8" });
        const data = JSON.parse(out.trim());
        if (data) {
          service.cpu = data.CPU != null ? Math.round(Number(data.CPU) * 100) / 100 : null;
          service.memory = data.PM != null ? Math.round(Number(data.PM) / (1024 * 1024) * 100) / 100 : null;
        }
      } catch (e) {
      }
    } else {
      try {
        const fs = require("fs");
        const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
        const fields = stat.split(" ");
        const utime = parseInt(fields[13], 10) || 0;
        const stime = parseInt(fields[14], 10) || 0;
        const cutime = parseInt(fields[15], 10) || 0;
        const cstime = parseInt(fields[16], 10) || 0;
        const starttime = parseInt(fields[21], 10) || 0;
        const totalTime = utime + stime + cutime + cstime;
        const uptime = fs.readFileSync("/proc/uptime", "utf8").split(" ")[0];
        const systemUptime = parseFloat(uptime) || 1;
        const Hertz = 100;
        const seconds = systemUptime - (starttime / Hertz);
        if (seconds > 0) {
          service.cpu = Math.round((totalTime / Hertz / seconds) * 100 * 100) / 100;
        }
        const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
        const memMatch = status.match(/VmRSS:\s+(\d+)/);
        if (memMatch) {
          service.memory = Math.round(parseInt(memMatch[1], 10) / 1024 * 100) / 100;
        }
      } catch (e) {
      }
    }
  }

  _clearMetrics(serviceId) {
    const interval = this._metricsIntervals.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this._metricsIntervals.delete(serviceId);
    }
  }

  _require(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) throw new Error(`Service ${serviceId} not found.`);
    return service;
  }

  _serialize(service) {
    const uptime = service.startedAtUtc
      ? Math.floor((Date.now() - new Date(service.startedAtUtc).getTime()) / 1000)
      : null;
    return {
      serviceId: service.serviceId,
      templateName: service.templateName,
      label: service.label || "",
      status: service.status,
      pid: service.pid,
      port: service.port > 0 ? service.port : null,
      executable: service.executable,
      args: service.args,
      cwd: service.cwd,
      createdAtUtc: service.createdAtUtc,
      startedAtUtc: service.startedAtUtc,
      stoppedAtUtc: service.stoppedAtUtc,
      lastExitCode: service.lastExitCode,
      lastExitSignal: service.lastExitSignal,
      restartCount: service.restartCount,
      cpu: service.cpu,
      memory: service.memory,
      uptime
    };
  }

  shutdown() {
    for (const [id, interval] of this._metricsIntervals) {
      clearInterval(interval);
    }
    this._metricsIntervals.clear();
    for (const [, service] of this.services) {
      if (service.childProcess && !service.childProcess.killed) {
        service.childProcess.kill("SIGTERM");
      }
    }
  }
}

module.exports = ProcessManager;
