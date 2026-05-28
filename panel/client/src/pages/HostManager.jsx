import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { hm } from '../api/client.js';

export default function HostManager() {
  const [health,   setHealth]   = useState(null);
  const [regStatus, setRegStatus] = useState(null);
  const [regState,  setRegState]  = useState(null);
  const [builds,   setBuilds]   = useState({});
  const [services, setServices] = useState([]);
  const [busy,     setBusy]     = useState({});
  const [error,    setError]    = useState('');
  const [msg,      setMsg]      = useState('');

  const load = useCallback(async () => {
    const [h, rs, reg, b, sv] = await Promise.allSettled([
      hm.health(),
      hm.registryStatus(),
      hm.registryState(),
      hm.builds(),
      hm.listServices(),
    ]);
    if (h.status   === 'fulfilled') setHealth(h.value);
    else setError(h.reason?.message || 'Panel server unreachable');
    if (rs.status  === 'fulfilled') setRegStatus(rs.value);
    if (reg.status === 'fulfilled') setRegState(reg.value);
    if (b.status   === 'fulfilled') setBuilds(b.value.builds || {});
    if (sv.status  === 'fulfilled') setServices(sv.value.services || []);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  async function doRegistry(action) {
    setBusy(b => ({ ...b, registry: action }));
    try {
      if (action === 'start')   await hm.startRegistry();
      if (action === 'stop')    await hm.stopRegistry();
      if (action === 'restart') await hm.restartRegistry();
      flash(`Registry ${action}ed`);
      setTimeout(load, 800);
    } catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, registry: null })); }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  const regRunning  = regStatus?.running;
  const buildList   = Object.entries(builds);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Host Manager</h1>
        <p className="page-sub">
          Control the registry, view system configuration, and manage the lifecycle of all CXR services
          — all running inside this panel server.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg   && <div className="alert alert-success">{msg}</div>}

      <div className="two-col">
        {/* Panel server health */}
        <div className="card">
          <div className="card-title">Panel Server</div>
          {health ? (
            <>
              <div className="kv-row"><span className="kv-key">Status</span>     <span className="kv-val"><StatusBadge status={health.ok ? 'ok' : 'error'} /></span></div>
              <div className="kv-row"><span className="kv-key">Service</span>     <span className="kv-val">{health.service}</span></div>
              <div className="kv-row"><span className="kv-key">Port</span>        <span className="kv-val">{health.panelPort}</span></div>
              <div className="kv-row"><span className="kv-key">Rooms</span>       <span className="kv-val">{health.roomCount}</span></div>
              <div className="kv-row"><span className="kv-key">Services</span>    <span className="kv-val">{health.serviceCount}</span></div>
              <div className="kv-row"><span className="kv-key">Event Backend</span><span className="kv-val">{health.eventBackend}</span></div>
              <div className="kv-row"><span className="kv-key">Auth</span>        <span className="kv-val">{health.authEnabled ? 'Token required' : 'Open'}</span></div>
            </>
          ) : <p className="empty-state">Loading...</p>}
        </div>

        {/* Registry control */}
        <div className="card">
          <div className="card-title">
            <div className="card-title-left">Registry Service</div>
            <StatusBadge status={regRunning ? 'running' : (regStatus ? 'stopped' : 'unknown')} />
          </div>

          {regStatus && (
            <>
              <div className="kv-row"><span className="kv-key">URL</span>    <span className="kv-val mono">{regStatus.url}</span></div>
              <div className="kv-row"><span className="kv-key">Port</span>   <span className="kv-val">{regStatus.port}</span></div>
              {regStatus.service && (
                <>
                  <div className="kv-row"><span className="kv-key">PID</span>    <span className="kv-val">{regStatus.service.pid || '—'}</span></div>
                  <div className="kv-row"><span className="kv-key">Restarts</span><span className="kv-val">{regStatus.service.restartCount}</span></div>
                </>
              )}
            </>
          )}

          <div className="btn-row" style={{ marginTop: 14 }}>
            {!regRunning ? (
              <button className="btn btn-primary" onClick={() => doRegistry('start')} disabled={busy.registry === 'start'}>
                {busy.registry === 'start' ? 'Starting...' : 'Start Registry'}
              </button>
            ) : (
              <>
                <button className="btn btn-sm" onClick={() => doRegistry('restart')} disabled={!!busy.registry}>
                  {busy.registry === 'restart' ? '...' : 'Restart'}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => doRegistry('stop')} disabled={!!busy.registry}>
                  {busy.registry === 'stop' ? '...' : 'Stop'}
                </button>
              </>
            )}
            <button className="btn btn-sm" onClick={load}>Refresh</button>
          </div>

          {/* Registry rooms */}
          {regState?.ok && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                Registry Rooms <span className="pill">{regState.rooms?.length ?? 0}</span>
              </div>
              {(regState.rooms || []).length === 0
                ? <p className="empty-state" style={{ textAlign: 'left' }}>No rooms registered</p>
                : (regState.rooms || []).map(r => (
                  <div key={r.roomId} className="kv-row">
                    <span className="kv-key">{r.roomName}</span>
                    <span className="kv-val mono">{r.ipAddress}:{r.port} · {r.playerCount}/{r.maxPlayers}</span>
                  </div>
                ))
              }
            </div>
          )}

          {!regState?.ok && regState?.error && (
            <div className="alert alert-info" style={{ marginTop: 10 }}>
              Registry offline: {regState.error}
            </div>
          )}
        </div>
      </div>

      {/* Unity Builds */}
      <div className="card">
        <div className="card-title">
          <div className="card-title-left">Unity Builds <span className="pill">{buildList.length}</span></div>
        </div>
        {buildList.length === 0 ? (
          <div className="alert alert-info">
            No Unity builds found. Drop a headless Unity build into <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>unity-builds/</code> folder next to the panel, or set <code style={{ background: 'var(--surface2)', padding: '1px 5px', borderRadius: 3 }}>CXR_UNITY_BUILDS_DIRECTORY</code> env var.
          </div>
        ) : (
          <table className="tbl">
            <thead><tr><th>ID</th><th>Name</th><th>Executable</th><th>Working Dir</th></tr></thead>
            <tbody>
              {buildList.map(([id, b]) => (
                <tr key={id}>
                  <td className="tbl-mono">{id}</td>
                  <td>{b.name}</td>
                  <td className="tbl-mono">{b.executablePath}</td>
                  <td className="tbl-mono">{b.workingDirectory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* All managed services */}
      <div className="card">
        <div className="card-title">
          <div className="card-title-left">All Services <span className="pill">{services.length}</span></div>
          <button className="btn btn-sm" onClick={load}>Refresh</button>
        </div>
        {services.length === 0 ? (
          <p className="empty-state">No services running. Start the registry above, or create rooms from the Rooms page.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Label</th><th>ID</th><th>Status</th><th>PID</th><th>Port</th><th>Restarts</th><th>Uptime</th></tr></thead>
            <tbody>
              {services.map(s => (
                <tr key={s.serviceId}>
                  <td>{s.label || s.templateName || s.serviceId}</td>
                  <td className="tbl-mono" style={{ fontSize: 11 }}>{s.serviceId}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="tbl-mono">{s.pid || '—'}</td>
                  <td className="tbl-mono">{s.port || '—'}</td>
                  <td>{s.restartCount}</td>
                  <td className="tbl-mono">{s.uptime != null ? `${s.uptime}s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Registry events feed */}
      {regState?.ok && (regState.events || []).length > 0 && (
        <div className="card">
          <div className="card-title">Registry Event Feed <span className="pill">{regState.events.length}</span></div>
          <table className="tbl">
            <thead><tr><th>Time</th><th>Type</th><th>Room</th><th>IP:Port</th></tr></thead>
            <tbody>
              {(regState.events || []).slice(-20).reverse().map((e, i) => (
                <tr key={i}>
                  <td className="tbl-mono">{new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td><span style={{ fontSize: 12, color: e.type === 'room-upsert' ? 'var(--success)' : e.type === 'room-delete' ? 'var(--danger)' : 'var(--muted)' }}>{e.type}</span></td>
                  <td>{e.roomName || '—'}</td>
                  <td className="tbl-mono">{e.ipAddress ? `${e.ipAddress}:${e.port}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
