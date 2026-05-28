import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge.jsx';
import { hm, events } from '../api/client.js';

export default function Overview() {
  const [state,      setState]      = useState(null);
  const [evtStats,   setEvtStats]   = useState(null);
  const [registry,   setRegistry]   = useState(null);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [s, es, reg] = await Promise.allSettled([
        hm.state(),
        events.stats(),
        hm.registryState(),
      ]);
      if (s.status === 'fulfilled') setState(s.value);
      else setError(s.reason?.message || 'Host manager unreachable');
      if (es.status === 'fulfilled') setEvtStats(es.value);
      if (reg.status === 'fulfilled') setRegistry(reg.value);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const rooms    = state?.rooms    || [];
  const running  = rooms.filter(r => r.status === 'running').length;
  const services = [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Overview</h1>
        <p className="page-sub">
          System snapshot — auto-refreshes every 8 s
          {lastUpdate && <> · Last updated {lastUpdate}</>}
        </p>
      </div>

      {error && <div className="alert alert-error">{error} — is the host-manager running on port 3000?</div>}

      {loading && !state && <p className="muted">Loading...</p>}

      {/* Stat cards */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-label">Active Rooms</div>
          <div className={`stat-value ${running > 0 ? 'green' : 'muted'}`}>{running}</div>
          <div className="stat-sub">{rooms.length} total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Registry Rooms</div>
          <div className={`stat-value blue`}>{registry?.rooms?.length ?? '—'}</div>
          <div className="stat-sub">{registry?.ok ? 'registry ok' : 'registry offline'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stored Events</div>
          <div className="stat-value blue">{evtStats?.total ?? '—'}</div>
          <div className="stat-sub">{evtStats?.backend ?? 'initializing'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available Builds</div>
          <div className="stat-value">{Object.keys(state?.builds || {}).length}</div>
          <div className="stat-sub">Unity build(s)</div>
        </div>
      </div>

      <div className="two-col">
        {/* Running rooms */}
        <div className="card">
          <div className="card-title">
            <div className="card-title-left">Running Rooms</div>
            <Link to="/rooms"><button className="btn btn-sm">Manage →</button></Link>
          </div>
          {rooms.length === 0
            ? <p className="empty-state">No rooms running</p>
            : (
              <table className="tbl">
                <thead>
                  <tr><th>Name</th><th>IP:Port</th><th>Status</th><th>Players</th></tr>
                </thead>
                <tbody>
                  {rooms.map(r => (
                    <tr key={r.roomId}>
                      <td>{r.requestedName || r.roomId}</td>
                      <td className="tbl-mono">{r.ip}:{r.port}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.playerCount ?? 0}/{r.maxParticipants ?? '?'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Connection hints */}
        <div className="card">
          <div className="card-title">Connection Info</div>
          {state?.connectionHints ? (
            <div>
              <div className="kv-row">
                <span className="kv-key">Host Manager URL</span>
                <span className="kv-val">{state.connectionHints.hostManagerUrl}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Available IPs</span>
                <span className="kv-val">{(state.connectionHints.availableAddresses || []).join(', ') || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Registry URL</span>
                <span className="kv-val">{state.connectionHints.xrMultiplayerDebugGui?.remoteRegistryUrl || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">First Active Room</span>
                <span className="kv-val">{state.connectionHints.xrMultiplayerDebugGui?.directConnectAddress || '—'}</span>
              </div>
              {state.connectionHints.warning && (
                <div className="alert alert-error" style={{ marginTop: 12, marginBottom: 0 }}>
                  {state.connectionHints.warning}
                </div>
              )}
            </div>
          ) : (
            <p className="empty-state">Waiting for host manager...</p>
          )}
        </div>
      </div>

      {/* Event stats */}
      {evtStats && (
        <div className="card">
          <div className="card-title">
            <div className="card-title-left">Persistence Stats</div>
            <Link to="/events"><button className="btn btn-sm">View Events →</button></Link>
          </div>
          <div className="two-col">
            <div>
              <div className="kv-row"><span className="kv-key">Backend</span><span className="kv-val">{evtStats.backend}</span></div>
              <div className="kv-row"><span className="kv-key">Total Events</span><span className="kv-val">{evtStats.total}</span></div>
              {evtStats.jsonlPath && <div className="kv-row"><span className="kv-key">JSONL File</span><span className="kv-val">{evtStats.jsonlPath}</span></div>}
            </div>
            <div>
              {(evtStats.byType || []).slice(0, 6).map(({ event_type, count }) => (
                <div key={event_type} className="kv-row">
                  <span className="kv-key">{event_type}</span>
                  <span className="kv-val">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
