import React, { useState, useEffect, useRef, useCallback } from 'react';

const MAX_LINES = 1000;

export default function Logs() {
  const [lines,       setLines]       = useState([]);
  const [paused,      setPaused]      = useState(false);
  const [wsStatus,    setWsStatus]    = useState('Connecting...');
  const [serviceFilter, setServiceFilter] = useState('');
  const [streamFilter,  setStreamFilter]  = useState('');
  const [search,      setSearch]      = useState('');
  const termRef  = useRef(null);
  const wsRef    = useRef(null);
  const pauseRef = useRef(false);
  const bufRef   = useRef([]);

  pauseRef.current = paused;

  const connect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url   = `${proto}//${window.location.host}/logs`;
    const ws    = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen  = () => setWsStatus('Connected');
    ws.onclose = () => {
      setWsStatus('Disconnected — reconnecting in 3s...');
      setTimeout(connect, 3000);
    };
    ws.onerror = () => setWsStatus('WebSocket error');

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'ws-status') { setWsStatus(`Connected to ${msg.host}`); return; }
        if (msg.type === 'ws-error')  { setWsStatus(`WS error: ${msg.message}`); return; }

        const service = msg.serviceId || msg.roomId || msg.source || 'system';
        const stream  = msg.stream || 'stdout';
        const text    = msg.text || msg.message || msg.line || JSON.stringify(msg);

        if (!pauseRef.current) {
          const line = `[${service}] [${stream}] ${text}`;
          setLines(prev => {
            const next = [...prev, line];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        }
      } catch {
        if (!pauseRef.current) {
          setLines(prev => {
            const next = [...prev, evt.data];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        }
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, [connect]);

  useEffect(() => {
    if (!paused && termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [lines, paused]);

  function lineColor(text) {
    const t = text.toLowerCase();
    if (t.includes('error') || t.includes('exception')) return 'var(--danger)';
    if (t.includes('warn'))   return 'var(--warning)';
    if (t.includes('[stderr]'))return 'var(--warning)';
    return undefined;
  }

  const filtered = lines.filter(line => {
    if (serviceFilter && !line.includes(`[${serviceFilter}]`)) return false;
    if (streamFilter  && !line.includes(`[${streamFilter}]`))  return false;
    if (search        && !line.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const services = [...new Set(lines.map(l => { const m = l.match(/^\[([^\]]+)\]/); return m ? m[1] : null; }).filter(Boolean))];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Live Logs</h1>
        <p className="page-sub">Real-time WebSocket log stream from host-manager.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <span className={`badge ${wsStatus.startsWith('Connected') ? 'badge-ok' : 'badge-stopped'}`}>
            {wsStatus}
          </span>
          <div className="btn-row">
            <button className="btn btn-sm" onClick={() => setPaused(p => !p)}>
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button className="btn btn-sm" onClick={() => setLines([])}>Clear</button>
            <button className="btn btn-sm" onClick={connect}>Reconnect</button>
          </div>
        </div>

        <div className="log-controls">
          <div className="form-group">
            <label>Service</label>
            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
              <option value="">All services</option>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Stream</label>
            <select value={streamFilter} onChange={e => setStreamFilter(e.target.value)}>
              <option value="">All</option>
              <option value="stdout">stdout</option>
              <option value="stderr">stderr</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>Search</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter lines..." />
          </div>
        </div>

        <div
          ref={termRef}
          className="terminal terminal-lg"
        >
          {filtered.length === 0
            ? <span className="muted">{lines.length === 0 ? 'Waiting for logs...' : 'No lines match filter.'}</span>
            : filtered.map((line, i) => (
              <div key={i} style={{ color: lineColor(line) }}>{line}</div>
            ))
          }
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
          {filtered.length} / {lines.length} lines shown{paused ? ' · PAUSED' : ''}
        </div>
      </div>
    </div>
  );
}
