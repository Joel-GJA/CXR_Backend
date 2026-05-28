const os   = require('os');
const path = require('path');
const fs   = require('fs');

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

function scanUnityBuilds(buildsDir) {
  const builds = {};
  if (!fs.existsSync(buildsDir)) return builds;

  let entries;
  try { entries = fs.readdirSync(buildsDir, { withFileTypes: true }); }
  catch (e) { return builds; }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const buildDir = path.join(buildsDir, entry.name);
    let executablePath = null;

    // Check for env-specified executable name first
    const envExe = process.env.CXR_BUILD_EXECUTABLE;
    if (envExe && fs.existsSync(path.join(buildDir, envExe))) {
      executablePath = path.join(buildDir, envExe);
    }

    // Scan for Linux .x86_64 binary or any executable file in the build dir
    if (!executablePath) {
      let files;
      try { files = fs.readdirSync(buildDir, { withFileTypes: true }); }
      catch (e) { continue; }

      // Prefer .x86_64, then .x86, then extensionless executable files
      const candidates = files
        .filter(f => f.isFile())
        .map(f => f.name)
        .filter(n => n.endsWith('.x86_64') || n.endsWith('.x86') || (!n.includes('.') && !n.endsWith('_Data')));

      const preferred = candidates.find(n => n.endsWith('.x86_64'))
        || candidates.find(n => n.endsWith('.x86'))
        || candidates[0];

      if (preferred) {
        executablePath = path.join(buildDir, preferred);
      }
    }

    if (!executablePath) continue;

    const buildId = entry.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    builds[buildId] = {
      executablePath,
      workingDirectory: buildDir,
      name: entry.name,
    };
  }

  return builds;
}

const logsDir    = path.resolve(__dirname, process.env.CXR_LOGS_DIRECTORY    || './logs');
const buildsDir  = path.resolve(__dirname, process.env.CXR_UNITY_BUILDS_DIRECTORY || './unity-builds');
const scannedBuilds = scanUnityBuilds(buildsDir);

if (Object.keys(scannedBuilds).length > 0) {
  console.log(`[config] Found ${Object.keys(scannedBuilds).length} Unity build(s) in ${buildsDir}:`, Object.keys(scannedBuilds));
} else {
  console.warn(`[config] No Unity builds found in ${buildsDir}. Create a subdirectory with a .x86_64 binary to register a build.`);
}

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

  // ── Unity builds (auto-scanned from unity-builds/ or CXR_UNITY_BUILDS_DIRECTORY) ──
  builds:     scannedBuilds,
  buildsDir,
};
