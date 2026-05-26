const { WebSocketServer } = require("ws");

class LogWebSocketServer {
  constructor(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: "/logs" });
    this.clients = new Set();

    this.wss.on("connection", (ws, req) => {
      const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const client = {
        ws,
        filterService: params.get("service") || "",
        filterStream: params.get("stream") || "",
        filterSearch: (params.get("search") || "").toLowerCase(),
        alive: true
      };
      this.clients.add(client);

      ws.on("pong", () => { client.alive = true; });
      ws.on("close", () => { this.clients.delete(client); });
      ws.on("error", () => { this.clients.delete(client); });

      ws.send(JSON.stringify({ type: "connected", message: "Log stream connected" }));
    });

    this._pingInterval = setInterval(() => {
      for (const client of this.clients) {
        if (!client.alive) {
          this.clients.delete(client);
          try { client.ws.terminate(); } catch (e) {}
          continue;
        }
        client.alive = false;
        try { client.ws.ping(); } catch (e) { this.clients.delete(client); }
      }
    }, 30000);
  }

  broadcast(entry) {
    const message = JSON.stringify({
      type: "log",
      serviceId: entry.serviceId,
      stream: entry.stream,
      data: entry.data,
      timestamp: new Date().toISOString()
    });

    for (const client of this.clients) {
      if (client.ws.readyState !== 1) {
        this.clients.delete(client);
        continue;
      }
      if (client.filterService && client.filterService !== entry.serviceId) continue;
      if (client.filterStream && client.filterStream !== entry.stream) continue;
      if (client.filterSearch && !entry.data.toLowerCase().includes(client.filterSearch)) continue;
      try {
        client.ws.send(message);
      } catch (e) {
        this.clients.delete(client);
      }
    }
  }

  broadcastStatus(status) {
    const message = JSON.stringify({ type: "status", ...status, timestamp: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.ws.readyState !== 1) {
        this.clients.delete(client);
        continue;
      }
      try {
        client.ws.send(message);
      } catch (e) {
        this.clients.delete(client);
      }
    }
  }

  close() {
    clearInterval(this._pingInterval);
    for (const client of this.clients) {
      try { client.ws.close(); } catch (e) {}
    }
    this.clients.clear();
    this.wss.close();
  }
}

module.exports = LogWebSocketServer;
