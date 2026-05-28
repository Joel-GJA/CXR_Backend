const fs     = require('fs');
const path   = require('path');
const config = require('../config');

class EventWriter {
  constructor() {
    this.supabase    = null;
    this.pg          = null;
    this.backend     = 'jsonl';
    this.buffer      = [];
    this.inMemory    = [];
    this.maxInMemory = 2000;
    this.flushTimer  = null;
    this._initDone   = this._init();
  }

  async _init() {
    // ── Priority 1: Supabase ────────────────────────────────────────────────
    if (config.supabaseUrl && config.supabaseKey) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
        const { error } = await this.supabase.from('runtime_events').select('id').limit(1);
        if (error && error.code !== 'PGRST116') throw new Error(error.message);
        this.backend = 'supabase';
        console.log(`[EventWriter] Supabase connected → ${config.supabaseUrl}`);
      } catch (err) {
        console.log(`[EventWriter] Supabase unavailable (${err.message})`);
        this.supabase = null;
      }
    }

    // ── Priority 2: PostgreSQL direct ───────────────────────────────────────
    if (this.backend === 'jsonl' && config.pgConnectionString) {
      try {
        const { Pool } = require('pg');
        this.pg = new Pool({ connectionString: config.pgConnectionString });
        await this.pg.query('SELECT 1');
        this.backend = 'postgresql';
        console.log('[EventWriter] PostgreSQL connected');
      } catch (err) {
        console.log(`[EventWriter] PostgreSQL unavailable (${err.message})`);
        this.pg = null;
      }
    }

    // ── Priority 3: JSONL fallback ──────────────────────────────────────────
    if (this.backend === 'jsonl') {
      console.log(`[EventWriter] Using JSONL fallback → ${config.eventsJsonlPath}`);
      this._ensureJsonlDir();
      this._loadJsonl();
    }

    this.flushTimer = setInterval(() => this._flush().catch(console.error), config.flushIntervalMs);
  }

  _ensureJsonlDir() {
    const dir = path.dirname(config.eventsJsonlPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _loadJsonl() {
    try {
      if (!fs.existsSync(config.eventsJsonlPath)) return;
      const lines = fs.readFileSync(config.eventsJsonlPath, 'utf8').split('\n').filter(Boolean);
      this.inMemory = lines.slice(-this.maxInMemory).map((l) => JSON.parse(l));
    } catch (err) {
      console.error('[EventWriter] Failed to load JSONL:', err.message);
    }
  }

  write(event) {
    const normalized = {
      id:        `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.buffer.push(normalized);
    if (this.buffer.length >= config.maxBatchSize) this._flush().catch(console.error);
    return normalized;
  }

  writeMany(events) {
    events.forEach((e) => this.write(e));
    return Promise.resolve();
  }

  async _flush() {
    if (this.buffer.length === 0) return;
    const batch = this.buffer.splice(0, this.buffer.length);
    await this._initDone;
    if      (this.backend === 'supabase')    await this._writeToSupabase(batch);
    else if (this.backend === 'postgresql')  await this._writeToPg(batch);
    else                                          this._writeToJsonl(batch);
  }

  async _writeToSupabase(events) {
    const rows = events.map((evt) => ({
      id:             evt.id,
      event_type:     evt.eventType || evt.type || 'unknown',
      session_id:     evt.sessionId     || null,
      room_id:        evt.roomId        || null,
      participant_id: evt.participantId || null,
      payload:        evt,
      created_at:     evt.timestamp,
    }));
    const { error } = await this.supabase.from('runtime_events').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error('[EventWriter] Supabase write failed, falling back to JSONL:', error.message);
      this._writeToJsonl(events);
    }
  }

  async _writeToPg(events) {
    const client = await this.pg.connect();
    try {
      await client.query('BEGIN');
      for (const evt of events) {
        await client.query(
          `INSERT INTO runtime_events (id, event_type, session_id, room_id, participant_id, payload, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [evt.id, evt.eventType || evt.type || 'unknown', evt.sessionId || null,
           evt.roomId || null, evt.participantId || null, JSON.stringify(evt), evt.timestamp]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[EventWriter] PG write failed:', err.message);
      this._writeToJsonl(events);
    } finally { client.release(); }
  }

  _writeToJsonl(events) {
    try {
      this._ensureJsonlDir();
      fs.appendFileSync(config.eventsJsonlPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
      this.inMemory.push(...events);
      if (this.inMemory.length > this.maxInMemory) this.inMemory = this.inMemory.slice(-this.maxInMemory);
    } catch (err) {
      console.error('[EventWriter] JSONL write failed:', err.message);
    }
  }

  async query({ sessionId, eventType, roomId, limit = 100, offset = 0 } = {}) {
    await this._initDone;
    if      (this.backend === 'supabase')   return this._querySupabase({ sessionId, eventType, roomId, limit, offset });
    else if (this.backend === 'postgresql') return this._queryPg({ sessionId, eventType, roomId, limit, offset });
    return this._queryInMemory({ sessionId, eventType, roomId, limit, offset });
  }

  async _querySupabase({ sessionId, eventType, roomId, limit, offset }) {
    let q = this.supabase.from('runtime_events').select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (sessionId) q = q.eq('session_id',  sessionId);
    if (eventType) q = q.eq('event_type',  eventType);
    if (roomId)    q = q.eq('room_id',     roomId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  }

  async _queryPg({ sessionId, eventType, roomId, limit, offset }) {
    const conds = []; const vals = []; let i = 1;
    if (sessionId) { conds.push(`session_id=$${i++}`);  vals.push(sessionId); }
    if (eventType) { conds.push(`event_type=$${i++}`);  vals.push(eventType); }
    if (roomId)    { conds.push(`room_id=$${i++}`);     vals.push(roomId);    }
    const where  = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const result = await this.pg.query(
      `SELECT * FROM runtime_events ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );
    return result.rows;
  }

  _queryInMemory({ sessionId, eventType, roomId, limit, offset }) {
    const all = [...this.inMemory, ...this.buffer];
    let res   = all;
    if (sessionId) res = res.filter((e) => e.sessionId === sessionId);
    if (eventType) res = res.filter((e) => (e.eventType || e.type) === eventType);
    if (roomId)    res = res.filter((e) => e.roomId === roomId);
    return Promise.resolve(res.slice().reverse().slice(offset, offset + limit));
  }

  async stats() {
    await this._initDone;
    if (this.backend === 'supabase') {
      const { data, error } = await this.supabase.rpc('event_type_counts').catch(() => ({ data: null, error: true }));
      if (!error && data) {
        const total = data.reduce((s, r) => s + r.count, 0);
        return { total, byType: data, backend: 'supabase' };
      }
    }
    if (this.backend === 'postgresql') {
      const r = await this.pg.query(`SELECT event_type, COUNT(*)::int AS count FROM runtime_events GROUP BY event_type ORDER BY count DESC`);
      return { total: r.rows.reduce((s, row) => s + row.count, 0), byType: r.rows, backend: 'postgresql' };
    }
    const all    = [...this.inMemory, ...this.buffer];
    const byType = {};
    all.forEach((e) => { const t = e.eventType || e.type || 'unknown'; byType[t] = (byType[t] || 0) + 1; });
    return {
      total:    all.length,
      byType:   Object.entries(byType).map(([event_type, count]) => ({ event_type, count })),
      backend:  'jsonl',
      jsonlPath: config.eventsJsonlPath,
    };
  }

  async stop() {
    clearInterval(this.flushTimer);
    await this._flush().catch(console.error);
    if (this.pg) await this.pg.end();
  }
}

module.exports = new EventWriter();
