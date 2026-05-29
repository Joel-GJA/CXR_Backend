#!/usr/bin/env node
/**
 * CXR session replay / query tool (Phase 3 — Track C, Persistence).
 *
 * Reads stored runtime events and prints a human-readable session timeline.
 * Works against PostgreSQL when DATABASE_URL is set (and `pg` is installed),
 * otherwise falls back to the append-only JSONL file the writer produces.
 *
 * Usage:
 *   node replay.js                          # list recent rooms + sessions
 *   node replay.js --room <room_id>         # timeline for one room
 *   node replay.js --session <session_id>   # timeline for one session
 *   node replay.js --type PlayerJoined      # filter by event type
 *   node replay.js --limit 500              # cap rows (default 200)
 *   node replay.js --file ./events.jsonl    # force a specific JSONL file
 *
 * Env:
 *   DATABASE_URL        postgres connection string (enables DB mode)
 *   EVENTS_JSONL_PATH   override JSONL location (default: panel/server/data/events.jsonl)
 */

const fs   = require('fs');
const path = require('path');

// ── arg parsing ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, def = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const roomFilter    = opt('room');
const sessionFilter = opt('session');
const typeFilter    = opt('type');
const limit         = parseInt(opt('limit', '200'), 10);
const fileArg       = opt('file');

const DEFAULT_JSONL = path.resolve(__dirname, '../../panel/server/data/events.jsonl');

// ── tiny ANSI helpers ──────────────────────────────────────────────────────────
const c = {
  dim:   s => `\x1b[90m${s}\x1b[0m`,
  cyan:  s => `\x1b[36m${s}\x1b[0m`,
  green: s => `\x1b[32m${s}\x1b[0m`,
  yellow:s => `\x1b[33m${s}\x1b[0m`,
  red:   s => `\x1b[31m${s}\x1b[0m`,
  bold:  s => `\x1b[1m${s}\x1b[0m`,
};

function colorType(t) {
  if (/Created|Started|Joined|Acquired|Completed/.test(t)) return c.green(t);
  if (/Closed|Stopped|Left|Released|Ended/.test(t))        return c.red(t);
  if (/Transfer|Calibration/.test(t))                      return c.yellow(t);
  return c.cyan(t);
}

// Normalize an event record from either DB rows or JSONL objects.
function normalize(e) {
  return {
    eventId:   e.event_id   ?? e.eventId   ?? '',
    type:      e.event_type  ?? e.eventType ?? e.type ?? 'unknown',
    source:    e.source      ?? '',
    roomId:    e.room_id      ?? e.roomId    ?? '',
    sessionId: e.session_id   ?? e.sessionId ?? '',
    participant: e.participant_net_id ?? e.participantNetId ?? e.participantId ?? '',
    entity:    e.entity_net_id ?? e.entityNetId ?? '',
    message:   e.message      ?? '',
    at:        e.occurred_at   ?? e.occurredAt ?? e.timestamp ?? '',
  };
}

function printTimeline(events) {
  if (events.length === 0) { console.log(c.dim('  (no matching events)')); return; }
  for (const raw of events) {
    const e = normalize(raw);
    const time = e.at ? new Date(e.at).toISOString().replace('T', ' ').replace('Z', '') : '????-??-?? ??:??:??';
    const who  = e.participant ? c.dim(` p:${e.participant}`) : '';
    const ent  = e.entity ? c.dim(` e:${e.entity}`) : '';
    const room = e.roomId ? c.dim(` [${e.roomId}]`) : '';
    const msg  = e.message ? `  ${c.dim('—')} ${e.message}` : '';
    console.log(`  ${c.dim(time)}  ${colorType(e.type).padEnd(30)}${c.dim(e.source.padEnd(14))}${room}${who}${ent}${msg}`);
  }
  console.log(c.dim(`\n  ${events.length} event(s).`));
}

// ── PostgreSQL mode ─────────────────────────────────────────────────────────────
async function runPg() {
  let Client;
  try { ({ Client } = require('pg')); }
  catch { return false; } // pg not installed → fall back to JSONL

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    if (!roomFilter && !sessionFilter && !typeFilter) {
      console.log(c.bold('\n  Recent rooms'));
      const rooms = await client.query(
        'SELECT room_id, room_name, status, created_at, closed_at FROM rooms ORDER BY created_at DESC LIMIT 20');
      for (const r of rooms.rows) {
        console.log(`  ${c.cyan(r.room_id.padEnd(16))} ${(r.room_name||'').padEnd(20)} ${c.dim(r.status)}  ${c.dim(new Date(r.created_at).toISOString())}`);
      }
      console.log(c.bold('\n  Recent sessions'));
      const sess = await client.query(
        'SELECT session_id, room_id, started_at, ended_at FROM sessions ORDER BY started_at DESC LIMIT 20');
      for (const s of sess.rows) {
        console.log(`  ${c.cyan(String(s.session_id).slice(0,8))}  room ${c.dim(s.room_id||'—')}  ${c.dim(new Date(s.started_at).toISOString())}${s.ended_at?c.dim(' → '+new Date(s.ended_at).toISOString()):''}`);
      }
      console.log(c.dim('\n  Tip: replay a room with  --room <room_id>\n'));
      return true;
    }

    const where = [], params = [];
    if (roomFilter)    { params.push(roomFilter);    where.push(`room_id = $${params.length}`); }
    if (sessionFilter) { params.push(sessionFilter); where.push(`session_id = $${params.length}`); }
    if (typeFilter)    { params.push(typeFilter);    where.push(`event_type = $${params.length}`); }
    params.push(limit);
    const sql = `SELECT * FROM runtime_events ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY occurred_at ASC LIMIT $${params.length}`;
    const res = await client.query(sql, params);
    console.log(c.bold(`\n  Timeline ${roomFilter ? 'room=' + roomFilter : sessionFilter ? 'session=' + sessionFilter : ''}\n`));
    printTimeline(res.rows);
    return true;
  } finally {
    await client.end();
  }
}

// ── JSONL fallback mode ─────────────────────────────────────────────────────────
function runJsonl() {
  const file = fileArg ? path.resolve(fileArg) : (process.env.EVENTS_JSONL_PATH ? path.resolve(process.env.EVENTS_JSONL_PATH) : DEFAULT_JSONL);
  if (!fs.existsSync(file)) {
    console.error(c.red(`\n  No JSONL event file at: ${file}`));
    console.error(c.dim('  Set DATABASE_URL for DB mode, or --file <path>, or run the panel to generate events.\n'));
    process.exit(1);
  }

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
  let raw = [];
  for (const ln of lines) { try { raw.push(JSON.parse(ln)); } catch {} }

  // Filter on normalized fields but keep RAW records (printTimeline normalizes once).
  raw = raw.filter(r => {
    const e = normalize(r);
    if (roomFilter    && e.roomId    !== roomFilter)    return false;
    if (sessionFilter && e.sessionId !== sessionFilter) return false;
    if (typeFilter    && e.type      !== typeFilter)    return false;
    return true;
  });
  raw.sort((a, b) => String(normalize(a).at).localeCompare(String(normalize(b).at)));
  raw = raw.slice(0, limit);

  if (!roomFilter && !sessionFilter && !typeFilter) {
    const rooms = [...new Set(raw.map(r => normalize(r).roomId).filter(Boolean))];
    console.log(c.bold(`\n  JSONL source: `) + c.dim(file));
    console.log(c.bold(`  Rooms seen: `) + (rooms.length ? rooms.map(c.cyan).join(', ') : c.dim('none')));
    console.log(c.dim('  Tip: replay a room with  --room <room_id>\n'));
  }
  console.log(c.bold('  Timeline\n'));
  printTimeline(raw);
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    if (process.env.DATABASE_URL) {
      const ok = await runPg();
      if (ok) return;
      console.error(c.yellow('  `pg` not installed — falling back to JSONL.'));
    }
    runJsonl();
  } catch (err) {
    console.error(c.red(`\n  Replay error: ${err.message}\n`));
    process.exit(1);
  }
})();
