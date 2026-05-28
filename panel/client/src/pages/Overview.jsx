import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Boxes, Activity, Database, Package, ArrowRight, RefreshCw, Wifi, WifiOff, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import StatusBadge from '../components/StatusBadge.jsx';
import { hm, events } from '../api/client.js';
import { cn } from '../lib/utils.js';

function useCountUp(target, dur = 900) {
  const [v, setV] = useState(0);
  const raf = useRef();
  useEffect(() => {
    if (!target) { setV(0); return; }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, dur]);
  return v;
}

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };
const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const cardAnim = { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } } };

function StatCard({ label, value, sub, icon: Icon, color = 'blue', to }) {
  const num = useCountUp(typeof value === 'number' ? value : 0);
  const display = typeof value === 'number' ? num : (value ?? '—');
  const colors = {
    blue:   { icon: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    bar: 'from-transparent via-blue-500/50 to-transparent' },
    green:  { icon: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'from-transparent via-emerald-500/50 to-transparent' },
    yellow: { icon: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20',  bar: 'from-transparent via-yellow-500/50 to-transparent' },
    purple: { icon: 'text-purple-400',  bg: 'bg-purple-500/10 border-purple-500/20',  bar: 'from-transparent via-purple-500/50 to-transparent' },
  };
  const c = colors[color] || colors.blue;
  return (
    <motion.div variants={cardAnim} whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="glass relative overflow-hidden cursor-default group"
    >
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${c.bar}`} />
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</div>
          <div className="text-3xl font-extrabold tabular-nums text-white tracking-tight leading-none">
            {display}
          </div>
          <div className="text-xs text-slate-500 mt-1.5 truncate">{sub}</div>
        </div>
        <div className={cn('w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
      </div>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 px-5 pb-4 transition-colors">
          <span>View details</span><ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </motion.div>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a1120] border border-blue-500/20 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function Overview() {
  const [state, setState]           = useState(null);
  const [evtStats, setEvtStats]     = useState(null);
  const [registry, setRegistry]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const refresh = useCallback(async () => {
    try {
      const [s, es, reg] = await Promise.allSettled([hm.state(), events.stats(), hm.registryState()]);
      if (s.status   === 'fulfilled') setState(s.value);
      else setError(s.reason?.message || 'Panel unreachable');
      if (es.status  === 'fulfilled') setEvtStats(es.value);
      if (reg.status === 'fulfilled') setRegistry(reg.value);
      setLastUpdate(new Date().toLocaleTimeString());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 8000); return () => clearInterval(t); }, [refresh]);

  const rooms   = state?.rooms || [];
  const running = rooms.filter(r => r.status === 'running').length;

  const eventChartData = (evtStats?.byType || [])
    .slice(0, 8)
    .map(item => ({
      name: (item.event_type || '').replace(/([A-Z])/g, ' $1').trim(),
      count: parseInt(item.count) || 0,
    }));

  const roomPieData = rooms.length > 0
    ? [
        { name: 'Running', value: running },
        { name: 'Idle',    value: Math.max(0, rooms.length - running) },
      ]
    : [{ name: 'No Rooms', value: 1 }];

  const roomPlayerData = rooms.slice(0, 6).map(r => ({
    name: (r.requestedName || r.roomId || '').slice(0, 10),
    players: r.playerCount ?? 0,
    max: r.maxParticipants ?? 0,
  }));

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            System snapshot{lastUpdate && ` · Updated ${lastUpdate}`}
          </p>
        </div>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </motion.button>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3.5 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}

      {/* Stat cards */}
      <motion.div variants={stagger} initial="initial" animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <StatCard label="Active Rooms"     value={running}                      sub={`${rooms.length} total created`}                                   icon={Boxes}    color="green"  to="/rooms" />
        <StatCard label="Registry Rooms"   value={registry?.rooms?.length ?? 0} sub={registry?.ok ? 'registry online' : 'registry offline'}             icon={Wifi}     color="blue"   to="/hostmanager" />
        <StatCard label="Stored Events"    value={evtStats?.total ?? 0}         sub={evtStats?.backend ?? 'initializing'}                               icon={Database} color="purple" to="/events" />
        <StatCard label="Unity Builds"     value={Object.keys(state?.builds || {}).length} sub="available builds"                                       icon={Package}  color="yellow" to="/hostmanager" />
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Event type bar chart */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass lg:col-span-2"
        >
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Event Distribution</span>
            {evtStats?.total > 0 && (
              <span className="ml-auto text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                {evtStats.total} total
              </span>
            )}
          </div>
          <div className="p-5">
            {eventChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={eventChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                  <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}
                    fill="url(#barGradient)"
                  />
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-600 text-sm">
                No event data yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Room status donut */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass"
        >
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Boxes className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Room Status</span>
          </div>
          <div className="p-5 flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={150} height={150}>
                <PieChart>
                  <Pie
                    data={roomPieData}
                    cx="50%" cy="50%"
                    innerRadius={44} outerRadius={65}
                    startAngle={90} endAngle={-270}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {roomPieData.map((entry, index) => (
                      <Cell key={index} fill={
                        entry.name === 'Running'  ? '#10b981' :
                        entry.name === 'Idle'     ? '#1e293b' :
                        '#1e293b'
                      } />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-white tabular-nums">{running}</span>
                <span className="text-[10px] text-slate-500">running</span>
              </div>
            </div>
            <div className="mt-3 flex gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Running ({running})
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-slate-700" /> Idle ({Math.max(0, rooms.length - running)})
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Room capacity area chart (only if rooms exist) */}
      {roomPlayerData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass mb-6">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Room Capacity</span>
            <span className="text-[10px] text-slate-500 ml-1">players / max slots</span>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={roomPlayerData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
                <Bar dataKey="max"     name="Max"     radius={[3, 3, 0, 0]} fill="rgba(59,130,246,0.15)" />
                <Bar dataKey="players" name="Players" radius={[3, 3, 0, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Running rooms */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-white">Running Rooms</span>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">{rooms.length}</span>
            </div>
            <Link to="/rooms">
              <motion.span whileHover={{ x: 2 }} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
                Manage <ArrowRight className="w-3 h-3" />
              </motion.span>
            </Link>
          </div>
          <div className="p-5">
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
                <Boxes className="w-8 h-8 opacity-30" />
                <span className="text-sm">No rooms running</span>
              </div>
            ) : (
              <div className="space-y-2">
                {rooms.map((r, i) => (
                  <motion.div key={r.roomId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-blue-500/15 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{r.requestedName || r.roomId}</div>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">{r.ip}:{r.port}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{r.playerCount ?? 0}/{r.maxParticipants ?? '?'}</span>
                      <StatusBadge status={r.status} />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Connection info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Wifi className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Connection Info</span>
          </div>
          <div className="p-5 space-y-3">
            {state?.connectionHints ? [
              ['Host Manager', state.connectionHints.hostManagerUrl],
              ['Available IPs', (state.connectionHints.availableAddresses || []).join(', ') || '—'],
              ['Registry URL', state.connectionHints.xrMultiplayerDebugGui?.remoteRegistryUrl || '—'],
              ['Direct Connect', state.connectionHints.xrMultiplayerDebugGui?.directConnectAddress || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 text-sm border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                <span className="text-slate-500 w-28 flex-shrink-0">{k}</span>
                <span className="font-mono text-xs text-slate-300 break-all">{v}</span>
              </div>
            )) : (
              <div className="py-8 text-center text-slate-600 text-sm">Waiting for data...</div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Event stats */}
      {evtStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="glass">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">Persistence Stats</span>
              <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded">{evtStats.backend}</span>
            </div>
            <Link to="/events">
              <motion.span whileHover={{ x: 2 }} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 cursor-pointer">
                View Events <ArrowRight className="w-3 h-3" />
              </motion.span>
            </Link>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-purple-500/5 border border-purple-500/10">
              <div className="text-2xl font-bold text-purple-400 tabular-nums">{evtStats.total}</div>
              <div className="text-xs text-slate-500 mt-1">Total Events</div>
            </div>
            {(evtStats.byType || []).slice(0, 3).map(({ event_type, count }) => (
              <div key={event_type} className="text-center p-4 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="text-2xl font-bold text-white tabular-nums">{count}</div>
                <div className="text-[10px] text-slate-500 mt-1 truncate">{event_type}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
