import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Play, Square, RotateCcw, RefreshCw, Server, Package, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogMedia } from '../components/ui/alert-dialog.jsx';
import { useAlert } from '../contexts/AlertContext.jsx';
import { hm } from '../api/client.js';
import { useRealtime } from '../contexts/RealtimeContext.jsx';
import { cn } from '../lib/utils.js';

const page    = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

function ActionBtn({ onClick, disabled, loading, icon: Icon, children, variant = 'default' }) {
  const variants = {
    default: 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:bg-white/10',
    primary: 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-glow-blue-sm',
    danger:  'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
  };
  return (
    <motion.button
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      onClick={onClick} disabled={disabled || loading}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
        variants[variant],
        (disabled || loading) && 'opacity-40 cursor-not-allowed',
      )}
    >
      {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {children}
    </motion.button>
  );
}

function KVRow({ label, value }) {
  return (
    <div className="flex gap-4 items-baseline py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-slate-500 w-28 flex-shrink-0 font-medium">{label}</span>
      <span className="text-xs font-mono text-slate-300 break-all">{value ?? '—'}</span>
    </div>
  );
}

export default function HostManager() {
  const { warn, success: alertSuccess, alert: alertError } = useAlert();
  const { subscribe } = useRealtime();
  const [health,    setHealth]    = useState(null);
  const [regStatus, setRegStatus] = useState(null);
  const [regState,  setRegState]  = useState(null);
  const [builds,    setBuilds]    = useState({});
  const [services,  setServices]  = useState([]);
  const [busy,      setBusy]      = useState({});
  const [toast,     setToast]     = useState(null);
  const [showSvcs,  setShowSvcs]  = useState(true);
  const [stopConfirm, setStopConfirm] = useState(false);

  const load = useCallback(async () => {
    const [h, rs, reg, b, sv] = await Promise.allSettled([
      hm.health(), hm.registryStatus(), hm.registryState(), hm.builds(), hm.listServices(),
    ]);
    if (h.status   === 'fulfilled') setHealth(h.value);
    if (rs.status  === 'fulfilled') setRegStatus(rs.value);
    if (reg.status === 'fulfilled') setRegState(reg.value);
    if (b.status   === 'fulfilled') setBuilds(b.value.builds || {});
    if (sv.status  === 'fulfilled') setServices(sv.value.services || []);
  }, []);

  // Real-time: instant service/registry/room updates via WebSocket state events
  useEffect(() => subscribe('state', msg => {
    if (msg.services !== undefined) setServices(msg.services);
    if (msg.registryRunning !== undefined) {
      setRegStatus(prev => prev ? { ...prev, running: msg.registryRunning } : { running: msg.registryRunning });
    }
    if (msg.rooms !== undefined) {
      // Update health room count from live state
      setHealth(prev => prev ? { ...prev, roomCount: msg.roomCount, serviceCount: msg.serviceCount } : prev);
    }
  }), [subscribe]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  async function doReg(action) {
    setBusy(b => ({ ...b, reg: action }));
    try {
      if (action === 'start')   await hm.startRegistry();
      if (action === 'stop')    await hm.stopRegistry();
      if (action === 'restart') await hm.restartRegistry();
      showToast(`Registry ${action}ed`, 'success');
      alertSuccess(`Registry ${action}ed`);
      // Poll every second for 6s so the UI reflects the new state quickly
      let ticks = 0;
      const poll = setInterval(async () => {
        await load();
        if (++ticks >= 6) clearInterval(poll);
      }, 1000);
    } catch (e) { showToast(e.message, 'error'); alertError(e.message); }
    finally { setBusy(b => ({ ...b, reg: null })); }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const regRunning = regStatus?.running;
  const buildList  = Object.entries(builds);

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-7xl mx-auto">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -16, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -16, x: '-50%' }}
            className={cn(
              'fixed top-6 left-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold border shadow-card',
              toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' : 'bg-red-500/15 border-red-500/25 text-red-400',
            )}
          >{toast.msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="w-6 h-6 text-blue-400" /> Host Manager
          </h1>
          <p className="text-sm text-slate-500 mt-1">Control the registry and manage all CXR services</p>
        </div>
        <ActionBtn onClick={load} icon={RefreshCw} variant="default">Refresh</ActionBtn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Panel server */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Panel Server</span>
            {health && <StatusBadge status={health.ok ? 'ok' : 'error'} />}
          </div>
          <div className="p-5">
            {health ? (
              <>
                <KVRow label="Service"      value={health.service} />
                <KVRow label="Port"         value={health.panelPort} />
                <KVRow label="Rooms"        value={health.roomCount} />
                <KVRow label="Services"     value={health.serviceCount} />
                <KVRow label="Event Backend" value={health.eventBackend} />
                <KVRow label="Auth"         value={health.authEnabled ? 'Token required' : 'Open'} />
              </>
            ) : <div className="py-6 text-center text-slate-600 text-sm">Loading...</div>}
          </div>
        </motion.div>

        {/* Registry control */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Registry Service</span>
            </div>
            {regStatus && <StatusBadge status={regRunning ? 'running' : 'stopped'} />}
          </div>
          <div className="p-5">
            {regStatus && (
              <>
                <KVRow label="URL"      value={regStatus.url} />
                <KVRow label="Port"     value={regStatus.port} />
                {regStatus.service && (
                  <>
                    <KVRow label="PID"      value={regStatus.service.pid} />
                    <KVRow label="Restarts" value={regStatus.service.restartCount} />
                  </>
                )}
              </>
            )}

            {/* Big control buttons */}
            <div className="flex gap-3 mt-5 flex-wrap">
              {!regRunning ? (
                <ActionBtn onClick={() => doReg('start')} loading={busy.reg === 'start'} icon={Play} variant="primary">
                  Start Registry
                </ActionBtn>
              ) : (
                <>
                  <ActionBtn onClick={() => doReg('restart')} loading={busy.reg === 'restart'} icon={RotateCcw} variant="default">Restart</ActionBtn>
                  <ActionBtn onClick={() => setStopConfirm(true)} loading={busy.reg === 'stop'} icon={Square} variant="danger">Stop</ActionBtn>
                </>
              )}
            </div>

            {/* Registry rooms */}
            {regState?.ok && (
              <div className="mt-5 pt-4 border-t border-white/5">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  Registry Rooms
                  <span className="text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{regState.rooms?.length ?? 0}</span>
                </div>
                {(regState.rooms || []).length === 0
                  ? <p className="text-xs text-slate-600">No rooms registered</p>
                  : (regState.rooms || []).map(r => (
                    <div key={r.roomId} className="flex justify-between text-xs py-2 border-b border-white/[0.04] last:border-0">
                      <span className="text-slate-300 font-medium">{r.roomName}</span>
                      <span className="font-mono text-slate-500">{r.ipAddress}:{r.port} · {r.playerCount}/{r.maxPlayers}</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Unity Builds */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass mb-6">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
          <Package className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-semibold text-white">Unity Builds</span>
          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-full">{buildList.length}</span>
        </div>
        <div className="p-5">
          {buildList.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-sm text-blue-400">
              <Package className="w-4 h-4 flex-shrink-0" />
              Drop a headless Unity build into <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-xs">unity-builds/</code> or set <code className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-xs">CXR_UNITY_BUILDS_DIRECTORY</code>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-white/[0.06]">{['ID','Name','Executable'].map(h => <th key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-3 pr-4">{h}</th>)}</tr></thead>
                <tbody>
                  {buildList.map(([id, b]) => (
                    <tr key={id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-500">{id}</td>
                      <td className="py-3 pr-4 text-white font-medium">{b.name}</td>
                      <td className="py-3 font-mono text-xs text-slate-400 truncate max-w-xs">{b.executablePath}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Services */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass">
        <button onClick={() => setShowSvcs(s => !s)}
          className="flex items-center justify-between w-full px-5 pt-5 pb-4 border-b border-white/5"
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">All Services</span>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{services.length}</span>
          </div>
          {showSvcs ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
        <AnimatePresence>
          {showSvcs && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="p-5">
                {services.length === 0 ? (
                  <p className="text-sm text-slate-600 text-center py-6">No services running. Start the registry or create rooms.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left border-b border-white/[0.06]">
                          {['Label','Status','PID','Port','Restarts','Uptime'].map(h => (
                            <th key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {services.map(s => (
                          <tr key={s.serviceId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 pr-4 text-white font-medium">{s.label || s.serviceId}</td>
                            <td className="py-3 pr-4"><StatusBadge status={s.status} /></td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">{s.pid || '—'}</td>
                            <td className="py-3 pr-4 font-mono text-xs text-slate-500">{s.port || '—'}</td>
                            <td className="py-3 pr-4 text-slate-400">{s.restartCount}</td>
                            <td className="py-3 font-mono text-xs text-slate-500">{s.uptime != null ? `${s.uptime}s` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stop Registry Confirm Dialog */}
      <AlertDialog open={stopConfirm} onOpenChange={setStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-500/10 border-red-500/20">
              <Square className="w-6 h-6 text-red-400" />
            </AlertDialogMedia>
            <AlertDialogTitle>Stop Registry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop the registry server. Active rooms will no longer be discoverable by clients until the registry is restarted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => { setStopConfirm(false); doReg('stop'); }}>
              Stop Registry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </motion.div>
  );
}
