import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import LogTerminal from '../components/LogTerminal.jsx';
import { hm } from '../api/client.js';

export default function Rooms() {
  const [rooms,     setRooms]     = useState([]);
  const [builds,    setBuilds]    = useState({});
  const [registry,  setRegistry]  = useState(null);
  const [orphans,   setOrphans]   = useState([]);
  const [roomLogs,  setRoomLogs]  = useState({});    // roomId → { stdout, stderr }
  const [busy,      setBusy]      = useState({});
  const [error,     setError]     = useState('');
  const [msg,       setMsg]       = useState('');
  const [form,      setForm]      = useState({ requestedName: 'Anatomy Lab', maxParticipants: 8, buildId: '' });

  const load = useCallback(async () => {
    try {
      const [r, b, reg, orp] = await Promise.allSettled([
        hm.listRooms(),
        hm.builds(),
        hm.registryState(),
        hm.orphanRooms(),
      ]);
      if (r.status   === 'fulfilled') setRooms(r.value.rooms || []);
      if (b.status   === 'fulfilled') setBuilds(b.value.builds || {});
      if (reg.status === 'fulfilled') setRegistry(reg.value);
      if (orp.status === 'fulfilled') setOrphans(orp.value.rooms || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function createRoom() {
    try {
      setBusy(b => ({ ...b, create: true }));
      const payload = { ...form, maxParticipants: parseInt(form.maxParticipants, 10) };
      if (!payload.buildId) delete payload.buildId;
      await hm.createRoom(payload);
      flash('Room created');
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, create: false })); }
  }

  async function stopRoom(id) {
    setBusy(b => ({ ...b, [id]: 'stop' }));
    try { await hm.stopRoom(id); flash('Stopped'); load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function restartRoom(id) {
    setBusy(b => ({ ...b, [id]: 'restart' }));
    try { await hm.restartRoom(id); flash('Restarted'); load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function loadRoomLogs(id) {
    try {
      const logs = await hm.roomLogs(id);
      setRoomLogs(prev => ({ ...prev, [id]: logs }));
    } catch (err) { setError(err.message); }
  }

  async function removeOrphan(id) {
    try { await hm.deleteRegistryRoom(id); flash('Removed from registry'); load(); }
    catch (err) { setError(err.message); }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }
  function buildName(id) { return builds[id]?.name || id || 'Default'; }

  const buildOptions = Object.entries(builds);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Rooms</h1>
        <p className="page-sub">Create and manage Unity multiplayer room processes.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg   && <div className="alert alert-success">{msg}</div>}

      {/* Create room */}
      <div className="card">
        <div className="card-title">Create Room</div>
        <div className="form-row">
          <div className="form-group">
            <label>Room Name</label>
            <input type="text" value={form.requestedName} onChange={e => setForm(f => ({ ...f, requestedName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Max Participants</label>
            <input type="number" min="1" max="32" value={form.maxParticipants} onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))} />
          </div>
          {buildOptions.length > 0 && (
            <div className="form-group">
              <label>Build</label>
              <select value={form.buildId} onChange={e => setForm(f => ({ ...f, buildId: e.target.value }))}>
                <option value="">Auto (first available)</option>
                {buildOptions.map(([id, b]) => <option key={id} value={id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={createRoom} disabled={busy.create}>
              {busy.create ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </div>
      </div>

      {/* Running rooms */}
      <div className="card">
        <div className="card-title">
          <div className="card-title-left">Running Rooms <span className="pill">{rooms.length}</span></div>
          <button className="btn btn-sm" onClick={load}>Refresh</button>
        </div>
        {rooms.length === 0
          ? <p className="empty-state">No rooms running. Create one above.</p>
          : rooms.map(room => (
            <div key={room.roomId} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{room.requestedName || room.roomId}</div>
                  <div className="tbl-mono" style={{ marginTop: 3 }}>
                    {room.ip}:{room.port} &nbsp;·&nbsp; {room.playerCount ?? 0}/{room.maxParticipants ?? '?'} players
                    {buildOptions.length > 0 && room.buildId && <> &nbsp;·&nbsp; {buildName(room.buildId)}</>}
                  </div>
                  <div style={{ marginTop: 6 }}><StatusBadge status={room.status} /></div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-sm" onClick={() => restartRoom(room.roomId)} disabled={busy[room.roomId] === 'restart'}>
                    {busy[room.roomId] === 'restart' ? '...' : 'Restart'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => stopRoom(room.roomId)} disabled={busy[room.roomId] === 'stop'}>
                    {busy[room.roomId] === 'stop' ? '...' : 'Stop'}
                  </button>
                  <button className="btn btn-sm" onClick={() => loadRoomLogs(room.roomId)}>Logs</button>
                </div>
              </div>
              {roomLogs[room.roomId] && (
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>stdout</div>
                  <LogTerminal lines={(roomLogs[room.roomId].stdout || '').split('\n').filter(Boolean)} height="sm" />
                  {roomLogs[room.roomId].stderr && (
                    <>
                      <div className="muted" style={{ fontSize: 11, margin: '8px 0 4px' }}>stderr</div>
                      <LogTerminal lines={(roomLogs[room.roomId].stderr || '').split('\n').filter(Boolean)} height="sm" />
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        }
      </div>

      {/* Registry / external rooms */}
      {registry && (
        <div className="card">
          <div className="card-title">
            <div className="card-title-left">
              Registry Rooms <span className="pill">{registry.rooms?.length ?? 0}</span>
            </div>
            <div className="btn-row">
              <StatusBadge status={registry.ok ? 'ok' : 'error'} />
              <span className="mono muted">{registry.url}</span>
            </div>
          </div>
          {!registry.ok
            ? <div className="alert alert-error">{registry.error || 'Registry offline'}</div>
            : registry.rooms?.length === 0
              ? <p className="empty-state">No rooms in registry.</p>
              : (
                <table className="tbl">
                  <thead><tr><th>Name</th><th>IP:Port</th><th>Players</th><th>Status</th><th>Managed?</th><th></th></tr></thead>
                  <tbody>
                    {registry.rooms.map(r => {
                      const isOrphan = orphans.some(o => o.roomId === r.roomId);
                      return (
                        <tr key={r.roomId}>
                          <td>{r.roomName}</td>
                          <td className="tbl-mono">{r.ipAddress}:{r.port}</td>
                          <td>{r.playerCount}/{r.maxPlayers}</td>
                          <td><StatusBadge status={r.status} /></td>
                          <td>{isOrphan ? <span className="badge badge-stopped">Orphan</span> : <span className="badge badge-ok">Managed</span>}</td>
                          <td>
                            {isOrphan && (
                              <button className="btn btn-sm btn-danger" onClick={() => removeOrphan(r.roomId)}>Remove</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
          }
        </div>
      )}
    </div>
  );
}
