import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Send, History, Filter, RefreshCw, Database, Zap, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { events } from '../api/client.js';
import { cn } from '../lib/utils.js';

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

const EVENT_TYPES = [
  'RoomCreated','RoomClosed','RoomStarted','RoomStopped',
  'PlayerJoined','PlayerLeft',
  'OwnershipAcquired','OwnershipReleased','OwnershipTransferred',
  'CalibrationStarted','CalibrationCompleted',
  'SessionStarted','SessionEnded','ServerStarted','ServerStopped',
];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0a1120] border border-blue-500/20 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className="font-bold text-purple-400">{payload[0]?.value} events</p>
    </div>
  );
};

const BAR_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

function evtColor(type) {
  if (!type) return 'text-slate-500';
  if (type.includes('Created') || type.includes('Started') || type.includes('Joined') || type.includes('Acquired'))
    return 'text-emerald-400';
  if (type.includes('Closed') || type.includes('Stopped') || type.includes('Left') || type.includes('Released'))
    return 'text-red-400';
  if (type.includes('Transfer') || type.includes('Calibration'))
    return 'text-yellow-400';
  return 'text-blue-400';
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString();
}

export default function Events() {
  const [evts,          setEvts]          = useState([]);
  const [stats,         setStats]         = useState(null);
  const [replayData,    setReplayData]    = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [toast,         setToast]         = useState(null);
  const [filterType,    setFilterType]    = useState('');
  const [filterSession, setFilterSession] = useState('');
  const [filterRoom,    setFilterRoom]    = useState('');
  const [replaySessId,  setReplaySessId]  = useState('');
  const [newEvent, setNewEvent] = useState({
    eventType: 'PlayerJoined', sessionId: '', roomId: '', participantId: '', metadata: '{}',
  });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filterType)    params.eventType = filterType;
      if (filterSession) params.sessionId = filterSession;
      if (filterRoom)    params.roomId    = filterRoom;
      const [evtRes, statsRes] = await Promise.allSettled([events.list(params), events.stats()]);
      if (evtRes.status   === 'fulfilled') setEvts(evtRes.value.events || []);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
    } finally { setLoading(false); }
  }, [filterType, filterSession, filterRoom]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  async function sendEvent() {
    try {
      let metadata = {};
      try { metadata = JSON.parse(newEvent.metadata); } catch {}
      await events.write({ eventType: newEvent.eventType, sessionId: newEvent.sessionId || undefined, roomId: newEvent.roomId || undefined, participantId: newEvent.participantId || undefined, ...metadata });
      flash('Event written successfully');
      loadEvents();
    } catch (e) { flash(e.message, 'error'); }
  }

  async function replaySession() {
    if (!replaySessId) return;
    try {
      const data = await events.replay(replaySessId);
      setReplayData(data);
    } catch (e) { flash(e.message, 'error'); }
  }

  function flash(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }

  const inputCls = 'bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all w-full';

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

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Activity className="w-6 h-6 text-blue-400" /> Events
        </h1>
        <p className="text-sm text-slate-500 mt-1">Phase 3 persistence pipeline — PostgreSQL + JSONL fallback</p>
      </div>

      {/* Event distribution chart */}
      {stats && (stats.byType || []).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass mb-6">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Event Type Distribution</span>
            <span className="ml-auto text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
              {stats.total} total
            </span>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={(stats.byType || []).slice(0, 10).map((item, i) => ({
                  name: (item.event_type || '').replace(/([A-Z])/g, ' $1').trim(),
                  count: parseInt(item.count) || 0,
                  color: BAR_COLORS[i % BAR_COLORS.length],
                }))}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(stats.byType || []).slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Events', value: stats.total, color: 'purple', icon: Database },
            ...(stats.byType || []).slice(0, 3).map(({ event_type, count }) => ({
              label: event_type, value: count, color: 'blue', icon: Zap,
            })),
          ].map(({ label, value, color, icon: Icon }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="glass p-4 text-center group hover:scale-[1.02] transition-transform cursor-default"
            >
              <div className={cn('text-2xl font-extrabold tabular-nums', color === 'purple' ? 'text-purple-400' : 'text-blue-400')}>{value}</div>
              <div className="text-[11px] text-slate-500 mt-1 truncate">{label}</div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Send test event */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <Send className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Send Test Event</span>
          </div>
          <div className="p-5 space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Event Type</label>
              <select value={newEvent.eventType} onChange={e => setNewEvent(n => ({ ...n, eventType: e.target.value }))} className={inputCls}>
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Session ID</label>
                <input type="text" value={newEvent.sessionId} onChange={e => setNewEvent(n => ({ ...n, sessionId: e.target.value }))} placeholder="sess_..." className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Room ID</label>
                <input type="text" value={newEvent.roomId} onChange={e => setNewEvent(n => ({ ...n, roomId: e.target.value }))} placeholder="room_..." className={inputCls} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Participant ID</label>
              <input type="text" value={newEvent.participantId} onChange={e => setNewEvent(n => ({ ...n, participantId: e.target.value }))} placeholder="p_..." className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Metadata JSON</label>
              <input type="text" value={newEvent.metadata} onChange={e => setNewEvent(n => ({ ...n, metadata: e.target.value }))} placeholder='{"objectId":"cube1"}' className={inputCls} />
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={sendEvent}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-glow-blue-sm"
            >
              <Send className="w-4 h-4" /> Write Event
            </motion.button>
          </div>
        </motion.div>

        {/* Session replay */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass">
          <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
            <History className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white">Session Replay</span>
          </div>
          <div className="p-5">
            <div className="flex gap-3 mb-4">
              <input type="text" value={replaySessId} onChange={e => setReplaySessId(e.target.value)} placeholder="Session ID (sess_...)" className={cn(inputCls, 'flex-1')} />
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={replaySession} disabled={!replaySessId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold disabled:opacity-40 transition-all"
              >
                <History className="w-4 h-4" /> Replay
              </motion.button>
            </div>
            {replayData && (
              <div>
                <div className="text-xs text-slate-500 mb-2">{replayData.count} events for <span className="font-mono text-slate-400">{replayData.sessionId}</span></div>
                <div className="rounded-xl overflow-hidden border border-blue-500/10 bg-[#020810]">
                  <div className="flex gap-1.5 px-4 py-2 bg-white/[0.02] border-b border-white/5">
                    <span className="w-2 h-2 rounded-full bg-red-500/70" />
                    <span className="w-2 h-2 rounded-full bg-yellow-500/70" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                  </div>
                  <div className="p-4 h-60 overflow-y-auto font-mono text-[11px] space-y-1">
                    {replayData.events.length === 0 ? (
                      <span className="text-slate-700">No events found.</span>
                    ) : replayData.events.map((e, i) => (
                      <div key={i} className="flex gap-3">
                        <span className="text-slate-600 flex-shrink-0">{fmtTime(e.timestamp || e.created_at)}</span>
                        <span className={cn('font-bold', evtColor(e.eventType || e.event_type))}>{e.eventType || e.event_type}</span>
                        {(e.participantId || e.participant_id) && <span className="text-slate-600">{e.participantId || e.participant_id}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Event feed */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass">
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">Event Feed</span>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{evts.length}</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/40 transition-all"
            >
              <option value="">All types</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" value={filterSession} onChange={e => setFilterSession(e.target.value)} placeholder="Session..." className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all w-32" />
            <input type="text" value={filterRoom}    onChange={e => setFilterRoom(e.target.value)}    placeholder="Room..."    className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all w-32" />
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={loadEvents}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} /> Refresh
            </motion.button>
          </div>
        </div>
        <div className="p-5">
          {evts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-slate-600">
              <Activity className="w-9 h-9 opacity-25" />
              <span className="text-sm">{loading ? 'Loading…' : 'No events found — send a test event above'}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-white/[0.06]">
                    {['Time','Type','Session','Room','Participant'].map(h => (
                      <th key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {evts.map((e, i) => (
                      <motion.tr key={e.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">{fmtTime(e.timestamp || e.created_at)}</td>
                        <td className="py-3 pr-4">
                          <span className={cn('text-[11px] font-bold', evtColor(e.eventType || e.event_type))}>
                            {e.eventType || e.event_type || '—'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-slate-500 max-w-[120px] truncate">{e.sessionId || e.session_id || '—'}</td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-slate-500 max-w-[100px] truncate">{e.roomId || e.room_id || '—'}</td>
                        <td className="py-3 font-mono text-[11px] text-slate-500 max-w-[100px] truncate">{e.participantId || e.participant_id || '—'}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
