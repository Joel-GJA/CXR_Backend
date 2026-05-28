import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../components/StatusBadge.jsx';
import LogTerminal from '../components/LogTerminal.jsx';
import { hm } from '../api/client.js';

export default function Services() {
  const [services,   setServices]   = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [svcLogs,    setSvcLogs]    = useState({});
  const [busy,       setBusy]       = useState({});
  const [error,      setError]      = useState('');
  const [msg,        setMsg]        = useState('');
  const [template,   setTemplate]   = useState('');

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.allSettled([hm.listServices(), hm.templates()]);
      if (s.status === 'fulfilled') setServices(s.value.services || []);
      if (t.status === 'fulfilled') {
        const tpls = (t.value.templates || []).filter(tp => tp.type !== 'built-in');
        setTemplates(tpls);
        if (!template && tpls.length > 0) setTemplate(tpls[0].name);
      }
    } catch (err) { setError(err.message); }
  }, [template]);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function startService() {
    if (!template) return;
    setBusy(b => ({ ...b, start: true }));
    try {
      await hm.startService({ template });
      flash('Service started');
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, start: false })); }
  }

  async function stopService(id) {
    setBusy(b => ({ ...b, [id]: 'stop' }));
    try { await hm.stopService(id); flash('Stopped'); load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function restartService(id) {
    setBusy(b => ({ ...b, [id]: 'restart' }));
    try { await hm.restartService(id); flash('Restarted'); load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function deleteService(id) {
    setBusy(b => ({ ...b, [id]: 'delete' }));
    try { await hm.deleteService(id); flash('Removed'); load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function loadLogs(id) {
    try {
      const logs = await hm.serviceLogs(id);
      setSvcLogs(prev => ({ ...prev, [id]: logs }));
    } catch (err) { setError(err.message); }
  }

  function flash(m) { setMsg(m); setTimeout(() => setMsg(''), 3000); }

  function uptime(svc) {
    if (!svc.startedAt) return '—';
    const sec = Math.floor((Date.now() - new Date(svc.startedAt).getTime()) / 1000);
    if (sec < 60)   return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Services</h1>
        <p className="page-sub">Start, stop, and monitor all managed processes.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {msg   && <div className="alert alert-success">{msg}</div>}

      {/* Start service */}
      <div className="card">
        <div className="card-title">Start a Service</div>
        <div className="form-row">
          <div className="form-group">
            <label>Template</label>
            <select value={template} onChange={e => setTemplate(e.target.value)}>
              {templates.length === 0
                ? <option value="">No templates available</option>
                : templates.map(t => <option key={t.name} value={t.name}>{t.name} — {t.description || ''}</option>)
              }
            </select>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={startService} disabled={busy.start || !template}>
              {busy.start ? 'Starting...' : 'Start Service'}
            </button>
          </div>
        </div>
      </div>

      {/* Services list */}
      <div className="card">
        <div className="card-title">
          <div className="card-title-left">Running Services <span className="pill">{services.length}</span></div>
          <button className="btn btn-sm" onClick={load}>Refresh</button>
        </div>
        {services.length === 0
          ? <p className="empty-state">No services running.</p>
          : services.map(svc => (
            <div key={svc.id} style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{svc.name || svc.id}</div>
                  <div className="tbl-mono" style={{ marginTop: 3 }}>
                    PID: {svc.pid || '—'} &nbsp;·&nbsp; Uptime: {uptime(svc)}
                    {svc.restartCount > 0 && <> &nbsp;·&nbsp; Restarts: {svc.restartCount}</>}
                  </div>
                  <div style={{ marginTop: 6 }}><StatusBadge status={svc.status} /></div>
                </div>
                <div className="btn-row">
                  <button className="btn btn-sm" onClick={() => restartService(svc.id)} disabled={!!busy[svc.id]}>
                    {busy[svc.id] === 'restart' ? '...' : 'Restart'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => stopService(svc.id)} disabled={!!busy[svc.id]}>
                    {busy[svc.id] === 'stop' ? '...' : 'Stop'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteService(svc.id)} disabled={!!busy[svc.id]}>
                    {busy[svc.id] === 'delete' ? '...' : 'Remove'}
                  </button>
                  <button className="btn btn-sm" onClick={() => loadLogs(svc.id)}>Logs</button>
                </div>
              </div>
              {svcLogs[svc.id] && (
                <div style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>stdout</div>
                  <LogTerminal lines={(svcLogs[svc.id].stdout || '').split('\n').filter(Boolean)} height="sm" />
                  {svcLogs[svc.id].stderr && (
                    <>
                      <div className="muted" style={{ fontSize: 11, margin: '8px 0 4px' }}>stderr</div>
                      <LogTerminal lines={(svcLogs[svc.id].stderr || '').split('\n').filter(Boolean)} height="sm" />
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        }
      </div>
    </div>
  );
}
