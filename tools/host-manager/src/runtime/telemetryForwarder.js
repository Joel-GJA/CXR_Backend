class TelemetryForwarder {
  constructor(processManager, config) {
    this.processManager = processManager;
    this.config = config;
    this.registryState = null;
    this.snapshot = {
      services: [],
      registry: null,
      host: {
        cpu: null,
        memory: null,
        uptime: null
      },
      updatedAt: null
    };
    this._interval = null;
  }

  start() {
    this._poll();
    this._interval = setInterval(() => this._poll(), 5000);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getSnapshot() {
    return this.snapshot;
  }

  _poll() {
    const now = new Date().toISOString();
    const services = this.processManager.list();
    this.snapshot.services = services;
    this.snapshot.updatedAt = now;

    if (this.config.registryUrl) {
      this._fetchRegistry().then(data => {
        this.snapshot.registry = data;
      }).catch(() => {});
    }
  }

  async _fetchRegistry() {
    try {
      const [health, roomsPayload] = await Promise.all([
        this._fetchJson(`${this.config.registryUrl}/health`),
        this._fetchJson(`${this.config.registryUrl}/rooms`)
      ]);
      return {
        configured: true,
        url: this.config.registryUrl,
        ok: true,
        health,
        rooms: Array.isArray(roomsPayload.rooms) ? roomsPayload.rooms : [],
        error: ""
      };
    } catch (error) {
      return {
        configured: true,
        url: this.config.registryUrl,
        ok: false,
        health: null,
        rooms: [],
        error: error.message
      };
    }
  }

  _fetchJson(urlString) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlString);
      const client = parsedUrl.protocol === "https:" ? require("https") : require("http");
      const request = client.request(parsedUrl, { method: "GET", timeout: 5000 }, response => {
        let body = "";
        response.on("data", chunk => { body += chunk; });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Status ${response.statusCode}`));
            return;
          }
          try { resolve(body.length > 0 ? JSON.parse(body) : {}); }
          catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
        });
      });
      request.on("timeout", () => { request.destroy(new Error("Timeout")); });
      request.on("error", reject);
      request.end();
    });
  }
}

module.exports = TelemetryForwarder;
