import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Play, Square, RotateCcw, Trash2, FileText, RefreshCw } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import LogTerminal from '../components/LogTerminal.jsx';
import { hm } from '../api/client.js';
import { cn } from '../lib/utils.js';

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

function Btn({ onClick, disabled, loading, icon: Icon, children, variant = 'default', sm = false }) {
  const v = { default: 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:bg-white/10', primary: 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-glow-blue-sm', danger: 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20' };
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled || loading}
      className={cn('flex items-center gap-1.5 font-semibold border rounded-lg transition-all', sm ? 'px-2.5 py-1 text-[11px]' : 'px-4 py-2 text-sm', v[variant], (disabled || loading) && 'opacity-40 cursor-not-allowed')}
    >
      <Icon className={cn(sm ? 'w-3 h-3' : 'w-3.5 h-3.5', loading && 'animate-spin')} />
      {children}
    </motion.button>
  );
}

function uptime(svc) {
  if (!svc.startedAt) return '—';
  const sec = Math.floor((Date.now() - new Date(svc.startedAt).getTime()) / 1000);
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

export default function Services() {
  const [services,  setServices]  = useState([]);
  const [templates, setTemplates] = useState([]);
  const [svcLogs,   setSvcLogs]   = useState({});
  const [busy,      setBusy]      = useState({});
  const [toast,     setToast]     = useState(null);
  const [template,  setTemplate]  = useState('');

  const load = useCallback(async () => {
    const [s, t] = await Promise.allSettled([hm.listServices(), hm.templates()]);
    if (s.status === 'fulfilled') setServices(s.value.services || []);
    if (t.status === 'fulfilled') {
      const tpls = (t.value.templates || []).filter(tp => tp.type !== 'built-in');
      setTemplates(tpls);
      if (!template && tpls.length > 0) setTemplate(tpls[0].name);
    }
  }, [template]);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function startService() {
    if (!template) return;
    setBusy(b => ({ ...b, start: true }));
    try { await hm.startService({ template }); flash('Service started'); load(); }
    catch (e) { flash(e.message, 'error'); }
    finally { setBusy(b => ({ ...b, start: false })); }
  }

  async function stopSvc(id)    { act(id, 'stop',    () => hm.stopService(id),    'Stopped'); }
  async function restartSvc(id) { act(id, 'restart', () => hm.restartService(id), 'Restarted'); }
  async function deleteSvc(id)  { act(id, 'delete',  () => hm.deleteService(id),  'Removed'); }

  async function act(id, key, fn, msg) {
    setBusy(b => ({ ...b, [id]: key }));
    try { await fn(); flash(msg); load(); }
    catch (e) { flash(e.message, 'error'); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function loadLogs(id) {
    try { const logs = await hm.serviceLogs(id); setSvcLogs(p => ({ ...p, [id]: logs })); }
    catch (e) { flash(e.message, 'error'); }
  }

  function flash(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-7xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -16, x: '-50%' }}
            className={cn('fixed top-6 left-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border shadow-card',
              toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-red-500/15 border-red-500/25 text-red-400'
            )}
          >{toast.msg}</motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Server className="w-6 h-6 text-blue-400" /> Services
          </h1>
          <p className="text-sm text-slate-500 mt-1">Start, stop, and monitor all managed processes</p>
        </div>
        <Btn onClick={load} icon={RefreshCw} variant="default">Refresh</Btn>
      </div>

      {/* Start service */}
      {templates.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass mb-6">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Play className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Start a Service</span>
          </div>
          <div className="p-5 flex items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Template</label>
              <select value={template} onChange={e => setTemplate(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
              >
                {templates.map(t => <option key={t.name} value={t.name}>{t.name}{t.description ? ` — ${t.description}` : ''}</option>)}
              </select>
            </div>
            <Btn onClick={startService} loading={busy.start} disabled={!template} icon={Play} variant="primary">Start Service</Btn>
          </div>
        </motion.div>
      )}

      {/* Service list */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
          <Server className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Running Services</span>
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{services.length}</span>
        </div>
        <div className="p-5">
          {services.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-600">
              <Server className="w-9 h-9 opacity-25" />
              <span className="text-sm">No services running</span>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {services.map((svc, i) => (
                  <motion.div key={svc.id || svc.serviceId}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-blue-500/10 transition-colors overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 flex-wrap gap-3">
                      <div className="flex items-center gap-4 flex-wrap">
                        <StatusBadge status={svc.status} />
                        <div>
                          <div className="text-sm font-bold text-white">{svc.name || svc.id}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            PID: {svc.pid || '—'} · Uptime: {uptime(svc)}{svc.restartCount > 0 ? ` · Restarts: ${svc.restartCount}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Btn onClick={() => restartSvc(svc.id)} loading={busy[svc.id] === 'restart'} icon={RotateCcw} sm>Restart</Btn>
                        <Btn onClick={() => stopSvc(svc.id)}    loading={busy[svc.id] === 'stop'}    icon={Square}    sm variant="danger">Stop</Btn>
                        <Btn onClick={() => deleteSvc(svc.id)}  loading={busy[svc.id] === 'delete'}  icon={Trash2}    sm variant="danger">Remove</Btn>
                        <Btn onClick={() => svcLogs[svc.id] ? setSvcLogs(p => { const n={...p}; delete n[svc.id]; return n; }) : loadLogs(svc.id)} icon={FileText} sm>
                          {svcLogs[svc.id] ? 'Hide' : 'Logs'}
                        </Btn>
                      </div>
                    </div>
                    <AnimatePresence>
                      {svcLogs[svc.id] && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-4 pb-4">
                          <LogTerminal lines={(svcLogs[svc.id].stdout || '').split('\n').filter(Boolean)} height="sm" label={`${svc.name || svc.id} · stdout`} />
                          {svcLogs[svc.id].stderr && <div className="mt-2"><LogTerminal lines={(svcLogs[svc.id].stderr || '').split('\n').filter(Boolean)} height="sm" label="stderr" /></div>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
