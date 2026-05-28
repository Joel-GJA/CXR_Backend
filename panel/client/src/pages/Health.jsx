import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { HeartPulse, Server, Radio, Globe, Activity } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import { hm } from '../api/client.js';
import { useRealtime } from '../contexts/RealtimeContext.jsx';
import { cn } from '../lib/utils.js';

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

function KVRow({ label, value, children }) {
  return (
    <div className="flex gap-4 items-baseline py-2.5 border-b border-white/[0.05] last:border-0">
      <span className="text-xs text-slate-500 w-32 flex-shrink-0 font-medium">{label}</span>
      <span className="text-xs font-mono text-slate-300 break-all">{children ?? value ?? '—'}</span>
    </div>
  );
}

function Section({ title, icon: Icon, iconColor = 'text-blue-400', children, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="glass">
      <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
        <Icon className={cn('w-4 h-4', iconColor)} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  );
}

export default function Health() {
  const { subscribe } = useRealtime();
  const [health,    setHealth]    = useState(null);
  const [state,     setState]     = useState(null);
  const [registry,  setRegistry]  = useState(null);
  const [telemetry, setTelemetry] = useState(null);
  const [hostLogs,  setHostLogs]  = useState('');
  const [error,     setError]     = useState('');

  const load = useCallback(async () => {
    const [h, s, reg, tel, hl] = await Promise.allSettled([
      hm.health(), hm.state(), hm.registryState(), hm.telemetry(), hm.hostLogs(),
    ]);
    if (h.status   === 'fulfilled') setHealth(h.value);
    else setError(h.reason?.message || 'Cannot reach panel server');
    if (s.status   === 'fulfilled') setState(s.value);
    if (reg.status === 'fulfilled') setRegistry(reg.value);
    if (tel.status === 'fulfilled') setTelemetry(tel.value);
    if (hl.status  === 'fulfilled') setHostLogs(hl.value.text || '');
  }, []);

  // Real-time: update room/service counts from live WS state
  useEffect(() => subscribe('state', msg => {
    setHealth(prev => prev ? { ...prev, roomCount: msg.roomCount, serviceCount: msg.serviceCount } : prev);
    if (msg.services) setTelemetry(prev => prev ? { ...prev, services: msg.services } : prev);
  }), [subscribe]);

  // Poll less often — WS handles live updates; poll for registry state (external HTTP)
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  const hints = state?.connectionHints;

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <HeartPulse className="w-6 h-6 text-blue-400" /> Health
        </h1>
        <p className="text-sm text-slate-500 mt-1">System status, network info, and diagnostics</p>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 p-3.5 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >{error}</motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Panel Server" icon={Server} delay={0.05}>
          {health ? (
            <>
              <KVRow label="Status"><StatusBadge status={health.ok ? 'ok' : 'error'} /></KVRow>
              <KVRow label="Service"     value={health.service} />
              <KVRow label="Port"        value={health.hostManagerPort || health.panelPort} />
              <KVRow label="Rooms"       value={health.roomCount} />
              <KVRow label="Auth"        value={health.authEnabled ? 'Token required' : 'Open'} />
              <KVRow label="Unity Builds" value={health.buildCount !== undefined ? `${health.buildCount} registered` : '—'} />
              {health.buildsDir && (
                <KVRow label="Builds Dir"  value={health.buildsDir} />
              )}
            </>
          ) : <p className="text-sm text-slate-600 py-4">Loading...</p>}
        </Section>

        <Section title="Registry" icon={Radio} delay={0.1}>
          {registry ? (
            <>
              <KVRow label="Status"><StatusBadge status={registry.ok ? 'ok' : 'error'} /></KVRow>
              <KVRow label="URL"    value={registry.url} />
              <KVRow label="Rooms"  value={registry.rooms?.length} />
              {registry.health && (
                <>
                  <KVRow label="Stale After"    value={registry.health.staleAfterMs ? `${registry.health.staleAfterMs}ms` : 'disabled'} />
                  <KVRow label="Recent Events"  value={registry.health.recentEventCount} />
                </>
              )}
              {!registry.ok && registry.error && (
                <div className="mt-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400">{registry.error}</div>
              )}
            </>
          ) : <p className="text-sm text-slate-600 py-4">Loading...</p>}
        </Section>
      </div>

      {hints && (
        <Section title="Network" icon={Globe} iconColor="text-emerald-400" delay={0.15}>
          <KVRow label="Host Manager"  value={hints.hostManagerUrl} />
          <KVRow label="Available IPs" value={(hints.availableAddresses || []).join(', ') || '—'} />
          <KVRow label="Registry URL"  value={hints.xrMultiplayerDebugGui?.remoteRegistryUrl || '—'} />
          {hints.warning && <div className="mt-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-xs text-yellow-400">{hints.warning}</div>}
          {hints.curl?.createRoom && (
            <div className="mt-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quick curl</div>
              <div className="rounded-xl overflow-hidden border border-blue-500/10 bg-[#020810]">
                <div className="flex gap-1.5 px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                </div>
                <pre className="p-4 text-[11px] font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">{hints.curl.listRooms}{'\n'}{hints.curl.createRoom}</pre>
              </div>
            </div>
          )}
        </Section>
      )}

      {telemetry && Object.keys(telemetry).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass mt-6">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Telemetry Snapshot</span>
          </div>
          <div className="rounded-b-xl overflow-hidden bg-[#020810]">
            <pre className="p-5 text-[11px] font-mono text-slate-400 max-h-64 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(telemetry, null, 2)}</pre>
          </div>
        </motion.div>
      )}

      {hostLogs && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass mt-6">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Server className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Server Log (tail)</span>
          </div>
          <div className="rounded-b-xl overflow-hidden bg-[#020810]">
            <pre className="p-5 text-[11px] font-mono text-slate-400 max-h-72 overflow-y-auto whitespace-pre-wrap">{hostLogs}</pre>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
