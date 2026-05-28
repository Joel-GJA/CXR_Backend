import React, { useState, useEffect, useCallback } from 'react';
import { events } from '../api/client.js';

const EVENT_TYPES = [
  'RoomCreated', 'RoomClosed', 'RoomStarted', 'RoomStopped',
  'PlayerJoined', 'PlayerLeft',
  'OwnershipAcquired', 'OwnershipReleased', 'OwnershipTransferred',
  'CalibrationStarted', 'CalibrationCompleted',
  'SessionStarted', 'SessionEnded',
  'ServerStarted', 'ServerStopped',
];

export default function Events() {
  const [evts,       setEvts]       = useState([]);
  const [stats,      setStats]      = useState(null);
  const [replayData, setReplayData] = useState(null);
  const [error,      setError]      = useState('');
  const [msg,        setMsg]        = useState('');
  const [loading,    setLoading]    = useState(false);

  // Filters
  const [filterType,    setFilterType]    = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [filterRoom,    setFilterRoom]    = useState('');

  // Test event form
  const [newEvent, setNewEvent] = useState({
    eventType: 'PlayerJoined',
    sessionId: '',
    roomId:    '',
    participantId: '',
    metadata:  '{}',
  });

  // Replay
  const [replaySessionId, setReplaySessionId] = useState('');

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType)    params.eventType = filterType;
      if (filterSession) params.sessionId = filterSession;
      if (filterRoom)    params.roomId    = filterRoom;
      params.limit = 100;
      const [evtRes, statsRes] = await Promise.allSettled([events.list(params), events.stats()]);
      if (evtRes.status   === 'fulfilled') setEvts(evtRes.value.events || []);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filterType, filterSession, filterRoom]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function sendTestEvent() {
    try {
      let metadata = {};
      try { metadata = JSON.parse(newEvent.metadata); } catch { metadata = {}; }
      const payload = {
        eventType:     newEvent.eventType,
        sessionId:     newEvent.sessionId || undefined,
        roomId:        newEvent.roomId    || undefined,
        participantId: newEvent.participantId || undefined,
        ...metadata,
      };
      await events.write(payload);
      flash('Event written');
      loadEvents();
    } catch (err) { setError(err.message); }
  }

  async function replaySession() {
    if (!replaySessionId) return;
    try {
      const data = await events.replay(replaySessionId);
      setReplayData(data);
    } catch (err) { setError(err.message); }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  function fmtTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString();
  }

  function eventColor(type) {
    if (!type) return 'var(--muted)';
    if (type.includes('Created') || type.includes('Started') || type.includes('Joined')) return 'var(--success)';
    if (type.includes('Closed')  || type.includes('Stopped') || type.includes('Left'))   return 'var(--danger)';
    if (type.includes('Transfer') || type.includes('Calibration'))                        return 'var(--warning)';
    return 'var(--primary)';
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Events</h1>
        <p className="page-sub">Nareen Phase 3 — Persistence pipeline. Event writer with PostgreSQL + JSONL fallback.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg   && <div className="alert alert-success">{msg}</div>}

      {/* Stats */}
      {stats && (
        <div className="stat-row" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value blue">{stats.total}</div>
            <div className="stat-sub">{stats.backend}</div>
          </div>
          {(stats.byType || []).slice(0, 3).map(({ event_type, count }) => (
            <div key={event_type} className="stat-card">
              <div className="stat-label">{event_type}</div>
              <div className="stat-value">{count}</div>
            </div>
          ))}
        </div>
      )}

      <div className="two-col">
        {/* Send test event */}
        <div className="card">
          <div className="card-title">Send Test Event</div>
          <p className="card-subtitle">Manually ingest an event to test the persistence pipeline.</p>
          <div className="form-row" style={{ flexDirection: 'column', gap: 10 }}>
            <div className="form-group">
              <label>Event Type</label>
              <select value={newEvent.eventType} onChange={e => setNewEvent(n => ({ ...n, eventType: e.target.value }))}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Session ID</label>
                <input type="text" value={newEvent.sessionId} onChange={e => setNewEvent(n => ({ ...n, sessionId: e.target.value }))} placeholder="sess_..." />
              </div>
              <div className="form-group">
                <label>Room ID</label>
                <input type="text" value={newEvent.roomId} onChange={e => setNewEvent(n => ({ ...n, roomId: e.target.value }))} placeholder="room_..." />
              </div>
            </div>
            <div className="form-group">
              <label>Participant ID</label>
              <input type="text" value={newEvent.participantId} onChange={e => setNewEvent(n => ({ ...n, participantId: e.target.value }))} placeholder="p_..." />
            </div>
            <div className="form-group">
              <label>Extra Metadata (JSON)</label>
              <input type="text" value={newEvent.metadata} onChange={e => setNewEvent(n => ({ ...n, metadata: e.target.value }))} placeholder='{"objectId": "cube1"}' />
            </div>
            <button className="btn btn-primary" onClick={sendTestEvent}>Write Event</button>
          </div>
        </div>

        {/* Session replay */}
        <div className="card">
          <div className="card-title">Session Replay</div>
          <p className="card-subtitle">Fetch all events for a session ID and view the timeline.</p>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label>Session ID</label>
              <input type="text" value={replaySessionId} onChange={e => setReplaySessionId(e.target.value)} placeholder="sess_..." />
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={replaySession} disabled={!replaySessionId}>Replay</button>
            </div>
          </div>
          {replayData && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {replayData.count} events for session {replayData.sessionId}
              </div>
              <div className="terminal terminal-md">
                {replayData.events.length === 0
                  ? 'No events found for this session.'
                  : replayData.events.map((e, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #21262d', paddingBottom: 4, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>{fmtTime(e.timestamp || e.created_at)}</span>
                      {' '}
                      <span style={{ color: eventColor(e.eventType || e.event_type), fontWeight: 600 }}>
                        {e.eventType || e.event_type}
                      </span>
                      {(e.participantId || e.participant_id) && (
                        <span style={{ color: 'var(--muted)', fontSize: 11 }}> · {e.participantId || e.participant_id}</span>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event list */}
      <div className="card">
        <div className="card-title">
          <div className="card-title-left">Event Feed <span className="pill">{evts.length}</span></div>
          <button className="btn btn-sm" onClick={loadEvents} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Filters */}
        <div className="form-row" style={{ marginBottom: 14 }}>
          <div className="form-group">
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Session ID</label>
            <input type="text" value={filterSession} onChange={e => setFilterSession(e.target.value)} placeholder="sess_..." />
          </div>
          <div className="form-group">
            <label>Room ID</label>
            <input type="text" value={filterRoom} onChange={e => setFilterRoom(e.target.value)} placeholder="room_..." />
          </div>
        </div>

        {evts.length === 0
          ? <p className="empty-state">{loading ? 'Loading...' : 'No events found. Send a test event above.'}</p>
          : (
            <table className="tbl">
              <thead>
                <tr><th>Time</th><th>Type</th><th>Session</th><th>Room</th><th>Participant</th></tr>
              </thead>
              <tbody>
                {evts.map((e, i) => (
                  <tr key={e.id || i}>
                    <td className="tbl-mono">{fmtTime(e.timestamp || e.created_at)}</td>
                    <td>
                      <span style={{ color: eventColor(e.eventType || e.event_type), fontWeight: 600, fontSize: 12 }}>
                        {e.eventType || e.event_type || '—'}
                      </span>
                    </td>
                    <td className="tbl-mono">{e.sessionId || e.session_id || '—'}</td>
                    <td className="tbl-mono">{e.roomId    || e.room_id    || '—'}</td>
                    <td className="tbl-mono">{e.participantId || e.participant_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Schema info */}
      <div className="card">
        <div className="card-title">PostgreSQL Schema</div>
        <p className="card-subtitle">
          Run <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>psql -U postgres -d cxr -f server/db/schema.sql</code> to migrate.
          Set <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>DATABASE_URL</code> env var to enable PG; otherwise falls back to JSONL.
        </p>
        <div className="kv-row"><span className="kv-key">Tables</span><span className="kv-val">rooms, sessions, participants, runtime_events, interaction_events, calibration_events</span></div>
        <div className="kv-row"><span className="kv-key">Append-first</span><span className="kv-val">No UPDATE on event tables — insert only</span></div>
        <div className="kv-row"><span className="kv-key">JSONB metadata</span><span className="kv-val">Extensible payload column on runtime_events</span></div>
        <div className="kv-row"><span className="kv-key">Indexed</span><span className="kv-val">room_id + timestamp, session_id + timestamp, event_type + timestamp</span></div>
      </div>
    </div>
  );
}
