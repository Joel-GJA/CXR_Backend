import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import { hm } from '../api/client.js';

export default function Health() {
  const [health,    setHealth]    = useState(null);
  const [state,     setState]     = useState(null);
  const [registry,  setRegistry]  = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [hostLogs,  setHostLogs]  = useState('');
  const [error,     setError]     = useState('');

  const load = useCallback(async () => {
    const [h, s, reg, tel, hl] = await Promise.allSettled([
      hm.health(),
      hm.state(),
      hm.registryState(),
      hm.telemetry(),
      hm.hostLogs(),
    ]);
    if (h.status   === 'fulfilled') setHealth(h.value);
    else setError(h.reason?.message || 'Cannot reach host manager');
    if (s.status   === 'fulfilled') setState(s.value);
    if (reg.status === 'fulfilled') setRegistry(reg.value);
    if (tel.status === 'fulfilled') setTelemetry(tel.value);
    if (hl.status  === 'fulfilled') setHostLogs(hl.value.text || '');
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);

  function fmt(v) { return v === undefined || v === null ? '—' : String(v); }

  const services    = state ? [] : [];
  const configSummary = state?.connectionHints || null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Health</h1>
        <p className="page-sub">System status, available IPs, registry health.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="two-col">
        {/* Host Manager health */}
        <div className="card">
          <div className="card-title">Host Manager</div>
          {health ? (
            <>
              <div className="kv-row">
                <span className="kv-key">Status</span>
                <span className="kv-val"><StatusBadge status={health.ok ? 'ok' : 'error'} /></span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Service</span>
                <span className="kv-val">{health.service}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Port</span>
                <span className="kv-val">{health.hostManagerPort}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Room Count</span>
                <span className="kv-val">{health.roomCount}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Auth Enabled</span>
                <span className="kv-val">{health.authEnabled ? 'Yes' : 'No'}</span>
              </div>
            </>
          ) : (
            <p className="empty-state">Loading...</p>
          )}
        </div>

        {/* Registry health */}
        <div className="card">
          <div className="card-title">Registry</div>
          {registry ? (
            <>
              <div className="kv-row">
                <span className="kv-key">Status</span>
                <span className="kv-val"><StatusBadge status={registry.ok ? 'ok' : 'error'} /></span>
              </div>
              <div className="kv-row">
                <span className="kv-key">URL</span>
                <span className="kv-val">{registry.url || '—'}</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">Rooms</span>
                <span className="kv-val">{registry.rooms?.length ?? '—'}</span>
              </div>
              {registry.health && (
                <>
                  <div className="kv-row">
                    <span className="kv-key">Stale After</span>
                    <span className="kv-val">{registry.health.staleAfterMs ? `${registry.health.staleAfterMs}ms` : 'disabled'}</span>
                  </div>
                  <div className="kv-row">
                    <span className="kv-key">Recent Events</span>
                    <span className="kv-val">{registry.health.recentEventCount ?? '—'}</span>
                  </div>
                </>
              )}
              {!registry.ok && registry.error && (
                <div className="alert alert-error" style={{ marginTop: 10 }}>{registry.error}</div>
              )}
            </>
          ) : (
            <p className="empty-state">Loading...</p>
          )}
        </div>
      </div>

      {/* Network */}
      {configSummary && (
        <div className="card">
          <div className="card-title">Network</div>
          <div className="kv-row">
            <span className="kv-key">Host Manager URL</span>
            <span className="kv-val">{configSummary.hostManagerUrl}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Available IPs</span>
            <span className="kv-val">{(configSummary.availableAddresses || []).join(', ') || '—'}</span>
          </div>
          <div className="kv-row">
            <span className="kv-key">Remote Registry URL</span>
            <span className="kv-val">{configSummary.xrMultiplayerDebugGui?.remoteRegistryUrl || '—'}</span>
          </div>
          {configSummary.warning && (
            <div className="alert alert-error" style={{ marginTop: 10 }}>{configSummary.warning}</div>
          )}
          {configSummary.curl?.createRoom && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>Quick curl commands</div>
              <pre className="terminal terminal-sm">{configSummary.curl.listRooms}{'\n'}{configSummary.curl.createRoom}</pre>
            </div>
          )}
        </div>
      )}

      {/* Telemetry */}
      {telemetry && Object.keys(telemetry).length > 0 && (
        <div className="card">
          <div className="card-title">Telemetry Snapshot</div>
          <pre className="terminal terminal-sm">{JSON.stringify(telemetry, null, 2)}</pre>
        </div>
      )}

      {/* Host manager log */}
      {hostLogs && (
        <div className="card">
          <div className="card-title">Host Manager Log (tail)</div>
          <pre className="terminal terminal-md">{hostLogs}</pre>
        </div>
      )}
    </div>
  );
}
