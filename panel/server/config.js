const os   = require('os');
const path = require('path');

function resolvePublicAddress() {
  const env = (process.env.CXR_PUBLIC_ADDRESS || 'auto').trim();
  if (env && env.toLowerCase() !== 'auto') return env;
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    for (const e of entries || []) {
      if (e.family === 'IPv4' && !e.internal) return e.address;
    }
  }
  return '127.0.0.1';
}

const logsDir = path.resolve(__dirname, process.env.CXR_LOGS_DIRECTORY || './logs');

module.exports = {
  // ── Panel ──────────────────────────────────────────────────────────────────
  port:        parseInt(process.env.PANEL_PORT || '4000', 10),
  adminToken:  process.env.CXR_ADMIN_TOKEN || '',

  // ── Host Manager (integrated) ─────────────────────────────────────────────
  publicAddress:  resolvePublicAddress(),
  logsDirectory:  logsDir,
  hostManagerPort: parseInt(process.env.PANEL_PORT || '4000', 10),  // same server
  roomPortRange: {
    start: parseInt(process.env.CXR_ROOM_PORT_START || '7777', 10),
    end:   parseInt(process.env.CXR_ROOM_PORT_END   || '7900', 10),
  },

  // ── Registry (managed child process) ─────────────────────────────────────
  registryPort:   parseInt(process.env.CXR_REGISTRY_PORT || '8080', 10),
  registryScript: path.resolve(__dirname, 'registry', 'server.js'),
  get registryUrl() {
    return `http://127.0.0.1:${this.registryPort}`;
  },

  // ── Supabase ──────────────────────────────────────────────────────────────
  supabaseUrl:  process.env.SUPABASE_URL              || '',
  supabaseKey:  process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // ── PostgreSQL direct (fallback) ──────────────────────────────────────────
  pgConnectionString: process.env.DATABASE_URL || '',

  // ── JSONL fallback ────────────────────────────────────────────────────────
  eventsJsonlPath: path.resolve(__dirname, process.env.EVENTS_JSONL_PATH || './data/events.jsonl'),
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS || '2000', 10),
  maxBatchSize:    parseInt(process.env.MAX_BATCH_SIZE    || '100',  10),
};
