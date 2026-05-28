const express    = require('express');
const http       = require('http');
const path       = require('path');
const fs         = require('fs');
const cors       = require('cors');
const config     = require('./config');

// ── Ash's host-manager modules (integrated directly) ─────────────────────────
const ProcessManager     = require('./hm/processManager');
const RoomManager        = require('./hm/roomManager');
const LogRotator         = require('./hm/logRotator');
const LogWebSocketServer = require('./hm/webSocketServer');

// ── Nareen's event writer ────────────────────────────────────────────────────
const writer = require('./db/writer');

// ── Shared utils ─────────────────────────────────────────────────────────────
const { sendJson, sendError, readJsonBody, getRouteMatch } = (() => {
  try { return require('./hm/http'); } catch (_) {
    // inline fallback if Ash's http util isn't present
    return {
      sendJson:     (res, code, obj) => { res.status(code).json(obj); },
      sendError:    (res, code, msg) => { res.status(code).json({ error: msg }); },
      readJsonBody: (req) => new Promise((resolve) => { let b = ''; req.on('data', d => b += d); req.on('end', () => resolve(b ? JSON.parse(b) : {})); }),
      getRouteMatch: () => ({ matched: false, params: {} }),
    };
  }
})();

// ── Init host-manager subsystem ──────────────────────────────────────────────
fs.mkdirSync(config.logsDirectory, { recursive: true });
fs.mkdirSync(path.dirname(config.eventsJsonlPath), { recursive: true });

const logRotator     = new LogRotator(config.logsDirectory);
const processManager = new ProcessManager(config, logRotator);
const roomManager    = new RoomManager(config, processManager);
const recentRequests = [];

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── Auth middleware ───────────────────────────────────────────────────────────
function isAuthorized(req) {
  if (!config.adminToken) return true;
  const hdr = req.headers['x-cxr-admin-token'];
  if (typeof hdr === 'string' && hdr === config.adminToken) return true;
  const auth = req.headers['authorization'];
  return typeof auth === 'string' && auth === `Bearer ${config.adminToken}`;
}

function authMiddleware(req, res, next) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// ────────────────────────────────────────────────────────────────────────────
// ROOMS
// ────────────────────────────────────────────────────────────────────────────
app.get('/rooms', authMiddleware, (req, res) => {
  res.json({ rooms: roomManager.listRooms() });
});

app.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const room = await roomManager.createRoom(req.body);
    res.status(201).json(room);
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/rooms/:id', authMiddleware, (req, res) => {
  const room = roomManager.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'room not found' });
  res.json(room);
});

app.post('/rooms/:id/stop', authMiddleware, (req, res) => {
  try { res.json(roomManager.stopRoom(req.params.id)); }
  catch (err) { res.status(409).json({ error: err.message }); }
});

app.post('/rooms/:id/restart', authMiddleware, (req, res) => {
  try { res.json(roomManager.restartRoom(req.params.id)); }
  catch (err) { res.status(409).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
// SERVICES (direct process manager)
// ────────────────────────────────────────────────────────────────────────────
app.get('/services', authMiddleware, (req, res) => {
  res.json({ services: processManager.list() });
});

app.post('/services', authMiddleware, async (req, res) => {
  try {
    const { executable, args = [], cwd, env = {}, label, needsPort } = req.body;
    if (!executable) return res.status(400).json({ error: 'executable is required' });
    const id = await processManager.start({ executable, args, cwd: cwd || process.cwd(), env, needsPort }, { label });
    res.status(201).json(processManager.getStatus(id));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.get('/services/:id', authMiddleware, (req, res) => {
  try { res.json(processManager.getStatus(req.params.id)); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.post('/services/:id/stop', authMiddleware, (req, res) => {
  try { res.json(processManager.stop(req.params.id)); }
  catch (err) { res.status(err.message.includes('not found') ? 404 : 409).json({ error: err.message }); }
});

app.post('/services/:id/restart', authMiddleware, (req, res) => {
  try { res.json(processManager.restart(req.params.id)); }
  catch (err) { res.status(err.message.includes('not found') ? 404 : 409).json({ error: err.message }); }
});

app.delete('/services/:id', authMiddleware, (req, res) => {
  try { processManager.remove(req.params.id); res.json({ ok: true }); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
// REGISTRY MANAGEMENT — start/stop registry as a managed process
// ────────────────────────────────────────────────────────────────────────────
let registryServiceId = null;

app.get('/api/registry/status', authMiddleware, async (req, res) => {
  const running = registryServiceId ? processManager.list().find(s => s.serviceId === registryServiceId) : null;
  res.json({
    running:   !!(running && running.status === 'running'),
    serviceId: registryServiceId,
    url:       config.registryUrl,
    port:      config.registryPort,
    service:   running || null,
  });
});

app.post('/api/registry/start', authMiddleware, async (req, res) => {
  try {
    if (registryServiceId) {
      const svc = processManager.list().find(s => s.serviceId === registryServiceId);
      if (svc && (svc.status === 'running' || svc.status === 'starting')) {
        return res.json({ ok: true, message: 'Registry already running', service: svc });
      }
    }
    const id = await processManager.start({
      executable:   'node',
      args:         [config.registryScript],
      cwd:          path.dirname(config.registryScript),
      env:          {
        CXR_REGISTRY_PORT:    String(config.registryPort),
        CXR_REGISTRY_STALE_MS: '0',
        CXR_ADMIN_TOKEN:      config.adminToken,
      },
      needsPort:    false,
      maxRestarts:  10,
    }, { label: 'room-registry', serviceId: `registry-${Date.now()}` });
    registryServiceId = id;
    res.json({ ok: true, serviceId: id, url: config.registryUrl });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/registry/stop', authMiddleware, (req, res) => {
  if (!registryServiceId) return res.json({ ok: true, message: 'Registry not running' });
  try {
    processManager.stop(registryServiceId);
    res.json({ ok: true });
  } catch (err) { res.status(409).json({ error: err.message }); }
});

app.post('/api/registry/restart', authMiddleware, (req, res) => {
  if (!registryServiceId) return res.status(404).json({ error: 'Registry not started yet. Use /api/registry/start first.' });
  try {
    const svc = processManager.restart(registryServiceId);
    res.json({ ok: true, service: svc });
  } catch (err) { res.status(409).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
// REGISTRY STATE (fetch from registry service)
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/registry-state', authMiddleware, async (req, res) => {
  res.json(await fetchRegistryState());
});

app.get('/api/registry-orphans', authMiddleware, async (req, res) => {
  const state    = await fetchRegistryState();
  if (!state.ok) return res.json({ rooms: [] });
  const managed  = roomManager.listRooms();
  const orphans  = (state.rooms || []).filter(r => !managed.some(m => m.port === r.port || m.roomId === r.roomId));
  res.json({ rooms: orphans });
});

app.delete('/api/registry/rooms/:id', authMiddleware, async (req, res) => {
  try {
    await roomManager.deleteRegistryRoom(decodeURIComponent(req.params.id));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/registry/auto-clean', authMiddleware, async (req, res) => {
  // stub — auto-clean not critical for panel
  res.json({ ok: true, cleaned: 0 });
});

// ────────────────────────────────────────────────────────────────────────────
// HEALTH & STATE
// ────────────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok:              true,
    service:         'cxr-nareen-panel',
    panelPort:       config.port,
    roomCount:       roomManager.listRooms().length,
    serviceCount:    processManager.list().length,
    registryRunning: !!(registryServiceId && processManager.list().find(s => s.serviceId === registryServiceId && s.status === 'running')),
    authEnabled:     !!config.adminToken,
    eventBackend:    writer.backend || 'initializing',
  });
});

app.get('/api/state', authMiddleware, (req, res) => {
  const rooms    = roomManager.listRooms();
  const running  = rooms.filter(r => r.status === 'running' || r.status === 'starting');
  const avail    = getAvailableIPs();
  res.json({
    rooms,
    builds:          roomManager.listBuilds(),
    connectionHints: {
      hostManagerUrl:        `http://${config.publicAddress}:${config.port}`,
      availableAddresses:    avail,
      registryUrl:           config.registryUrl,
      xrMultiplayerDebugGui: {
        directConnectAddress: running[0] ? `${running[0].ip}:${running[0].port}` : '',
        remoteRegistryUrl:    config.registryUrl,
      },
      curl: {
        listRooms:  `curl http://${config.publicAddress}:${config.port}/rooms`,
        createRoom: `curl -X POST http://${config.publicAddress}:${config.port}/rooms -H "Content-Type: application/json" -d "{\\"requestedName\\":\\"Lab\\",\\"maxParticipants\\":8}"`,
      },
    },
    auth: { enabled: !!config.adminToken },
  });
});

app.get('/api/telemetry', authMiddleware, (req, res) => {
  const services = processManager.list();
  res.json({
    timestamp:    new Date().toISOString(),
    roomCount:    roomManager.listRooms().length,
    serviceCount: services.length,
    services:     services.map(s => ({ id: s.serviceId, status: s.status, cpu: s.cpu, memory: s.memory, uptime: s.uptime })),
  });
});

app.get('/builds', authMiddleware, (req, res) => {
  res.json({ builds: roomManager.listBuilds() });
});

app.get('/api/request-activity', authMiddleware, (req, res) => {
  res.json({ requests: recentRequests.slice(-60), roomActivity: roomManager.getRecentActivity(60) });
});

// ────────────────────────────────────────────────────────────────────────────
// LOGS
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/logs/host-manager', authMiddleware, (req, res) => {
  res.json({ text: readTail(roomManager.hostLogPath, 400) });
});

app.get('/api/logs/rooms/:id', authMiddleware, (req, res) => {
  const room = roomManager.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'room not found' });
  res.json({
    stdout: logRotator.readTail(req.params.id, 'stdout', 220),
    stderr: logRotator.readTail(req.params.id, 'stderr', 220),
  });
});

app.get('/api/logs/services/:id', authMiddleware, (req, res) => {
  try {
    processManager.getStatus(req.params.id);
    res.json({
      stdout: logRotator.readTail(req.params.id, 'stdout', 220),
      stderr: logRotator.readTail(req.params.id, 'stderr', 220),
    });
  } catch (err) { res.status(404).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
// EVENTS (Nareen's persistence)
// ────────────────────────────────────────────────────────────────────────────
app.use('/api/events', require('./routes/events'));

// ────────────────────────────────────────────────────────────────────────────
// REACT BUILD (production)
// ────────────────────────────────────────────────────────────────────────────
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(503).json({ error: 'React build not found. Run: cd client && npm run build' });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// HTTP + WebSocket server
// ────────────────────────────────────────────────────────────────────────────
const server    = http.createServer(app);
const logWsServer = new LogWebSocketServer(server);

processManager.on('log',    (entry)  => logWsServer.broadcast(entry));
processManager.on('status', (status) => logWsServer.broadcastStatus(status));

// Record request activity
app.use((req, _res, next) => {
  recentRequests.push({ timestamp: new Date().toISOString(), method: req.method, path: req.path });
  if (recentRequests.length > 200) recentRequests.shift();
  next();
});

server.listen(config.port, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║  CXR Nareen Panel  —  Phase 3 (All-in-One)  ║');
  console.log(`  ║  http://localhost:${config.port}                      ║`);
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Public address : ${config.publicAddress}`);
  console.log(`  Room ports     : ${config.roomPortRange.start}–${config.roomPortRange.end}`);
  console.log(`  Logs directory : ${config.logsDirectory}`);
  console.log(`  Event backend  : ${config.supabaseUrl ? 'Supabase' : config.pgConnectionString ? 'PostgreSQL' : 'JSONL (set SUPABASE_URL or DATABASE_URL)'}`);
  console.log('');
  console.log('  Start registry from the Host Manager page or:');
  console.log(`  POST http://localhost:${config.port}/api/registry/start`);
  console.log('');
});

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
async function fetchRegistryState() {
  const url = config.registryUrl;
  try {
    const [health, rooms, events] = await Promise.all([
      fetchJson(`${url}/health`),
      fetchJson(`${url}/rooms`),
      fetchJson(`${url}/events?limit=50`).catch(() => ({ events: [], requestCounts: {} })),
    ]);
    return { configured: true, url, ok: true, health, rooms: rooms.rooms || [], events: events.events || [], requestCounts: events.requestCounts || {}, error: '' };
  } catch (err) {
    return { configured: true, url, ok: false, health: null, rooms: [], events: [], requestCounts: {}, error: err.message };
  }
}

function fetchJson(urlString) {
  return new Promise((resolve, reject) => {
    const u   = new URL(urlString);
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request(u, { method: 'GET', timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function readTail(filePath, maxLines) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return '';
    const fd   = fs.openSync(filePath, 'r');
    const buf  = Buffer.alloc(Math.min(stat.size, 65536));
    const read = fs.readSync(fd, buf, 0, buf.length, Math.max(0, stat.size - buf.length));
    fs.closeSync(fd);
    const lines = buf.toString('utf8', 0, read).split(/\r?\n/);
    return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
  } catch { return ''; }
}

function getAvailableIPs() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  const addrs  = [];
  for (const entries of Object.values(ifaces)) {
    for (const e of entries || []) {
      if (e.family === 'IPv4' && !e.internal) addrs.push(e.address);
    }
  }
  return addrs;
}

// ────────────────────────────────────────────────────────────────────────────
// Graceful shutdown
// ────────────────────────────────────────────────────────────────────────────
async function shutdown() {
  console.log('\n[Panel] Shutting down...');
  processManager.setCrashRecovery(false);
  processManager.shutdown();
  roomManager.shutdown();
  logWsServer.close();
  await writer.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 6000);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);
