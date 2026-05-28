import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Plus, RotateCcw, Square, FileText, Users, Wifi, WifiOff, X } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import LogTerminal from '../components/LogTerminal.jsx';
import { hm } from '../api/client.js';
import { cn } from '../lib/utils.js';

const page  = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

function Btn({ onClick, disabled, loading, icon: Icon, children, variant = 'default', sm = false }) {
  const v = { default: 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:bg-white/10', primary: 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-glow-blue-sm', danger: 'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20' };
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled || loading}
      className={cn('flex items-center gap-1.5 font-semibold border rounded-lg transition-all', sm ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm', v[variant], (disabled || loading) && 'opacity-40 cursor-not-allowed')}
    >
      <Icon className={cn(sm ? 'w-3 h-3' : 'w-3.5 h-3.5', loading && 'animate-spin')} />
      {children}
    </motion.button>
  );
}

export default function Rooms() {
  const [rooms,    setRooms]    = useState([]);
  const [builds,   setBuilds]   = useState({});
  const [registry, setRegistry] = useState(null);
  const [roomLogs, setRoomLogs] = useState({});
  const [busy,     setBusy]     = useState({});
  const [toast,    setToast]    = useState(null);
  const [form,     setForm]     = useState({ requestedName: 'Anatomy Lab', maxParticipants: 8, buildId: '' });

  const load = useCallback(async () => {
    const [r, b, reg] = await Promise.allSettled([hm.listRooms(), hm.builds(), hm.registryState()]);
    if (r.status   === 'fulfilled') setRooms(r.value.rooms || []);
    if (b.status   === 'fulfilled') setBuilds(b.value.builds || {});
    if (reg.status === 'fulfilled') setRegistry(reg.value);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  async function createRoom() {
    setBusy(b => ({ ...b, create: true }));
    try {
      const payload = { ...form, maxParticipants: parseInt(form.maxParticipants, 10) };
      if (!payload.buildId) delete payload.buildId;
      await hm.createRoom(payload);
      flash('Room created successfully', 'success');
      load();
    } catch (e) { flash(e.message, 'error'); }
    finally { setBusy(b => ({ ...b, create: false })); }
  }

  async function stopRoom(id) {
    setBusy(b => ({ ...b, [id]: 'stop' }));
    try { await hm.stopRoom(id); flash('Room stopped'); load(); }
    catch (e) { flash(e.message, 'error'); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function restartRoom(id) {
    setBusy(b => ({ ...b, [id]: 'restart' }));
    try { await hm.restartRoom(id); flash('Room restarted'); load(); }
    catch (e) { flash(e.message, 'error'); }
    finally { setBusy(b => ({ ...b, [id]: null })); }
  }

  async function loadRoomLogs(id) {
    try { const logs = await hm.roomLogs(id); setRoomLogs(p => ({ ...p, [id]: logs })); }
    catch (e) { flash(e.message, 'error'); }
  }

  function flash(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }
  const buildOpts = Object.entries(builds);

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

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-blue-400" /> Rooms
          </h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage Unity multiplayer rooms</p>
        </div>
      </div>

      {/* Create Room */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass mb-6">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
          <Plus className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Create Room</span>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Room Name</label>
              <input type="text" value={form.requestedName}
                onChange={e => setForm(f => ({ ...f, requestedName: e.target.value }))}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all w-48"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Max Players</label>
              <input type="number" min="1" max="32" value={form.maxParticipants}
                onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all w-28"
              />
            </div>
            {buildOpts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-500">Build</label>
                <select value={form.buildId} onChange={e => setForm(f => ({ ...f, buildId: e.target.value }))}
                  className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value="">Auto (first available)</option>
                  {buildOpts.map(([id, b]) => <option key={id} value={id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <Btn onClick={createRoom} loading={busy.create} icon={Plus} variant="primary">Create Room</Btn>
          </div>
        </div>
      </motion.div>

      {/* Room cards */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold text-white">Running Rooms</span>
          <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{rooms.length}</span>
        </div>
        {rooms.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-slate-600 glass"
          >
            <Boxes className="w-10 h-10 opacity-25" />
            <span className="text-sm">No rooms running — create one above</span>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {rooms.map((room, i) => (
                <motion.div key={room.roomId}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass group"
                >
                  {/* Room top */}
                  <div className="p-4 border-b border-white/[0.05]">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-sm font-bold text-white">{room.requestedName || room.roomId}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{room.ip}:{room.port}</div>
                      </div>
                      <StatusBadge status={room.status} />
                    </div>
                    {/* Players bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Players</span>
                        <span>{room.playerCount ?? 0}/{room.maxParticipants ?? '?'}</span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }} animate={{ width: `${((room.playerCount ?? 0) / (room.maxParticipants || 1)) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Room actions */}
                  <div className="flex gap-2 p-3 flex-wrap">
                    <Btn onClick={() => restartRoom(room.roomId)} loading={busy[room.roomId] === 'restart'} icon={RotateCcw} sm>Restart</Btn>
                    <Btn onClick={() => stopRoom(room.roomId)}    loading={busy[room.roomId] === 'stop'}    icon={Square}    sm variant="danger">Stop</Btn>
                    <Btn onClick={() => roomLogs[room.roomId] ? setRoomLogs(p => { const n = {...p}; delete n[room.roomId]; return n; }) : loadRoomLogs(room.roomId)} icon={FileText} sm>
                      {roomLogs[room.roomId] ? 'Hide' : 'Logs'}
                    </Btn>
                  </div>
                  {/* Logs inline */}
                  <AnimatePresence>
                    {roomLogs[room.roomId] && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-3 pb-3">
                        <LogTerminal lines={(roomLogs[room.roomId].stdout || '').split('\n').filter(Boolean)} height="sm" label={`${room.requestedName || room.roomId} · stdout`} />
                        {roomLogs[room.roomId].stderr && (
                          <div className="mt-2">
                            <LogTerminal lines={(roomLogs[room.roomId].stderr || '').split('\n').filter(Boolean)} height="sm" label="stderr" />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Registry rooms */}
      {registry && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass">
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              {registry.ok ? <Wifi className="w-4 h-4 text-blue-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
              <span className="text-sm font-semibold text-white">Registry Rooms</span>
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full">{registry.rooms?.length ?? 0}</span>
            </div>
            <span className="text-xs font-mono text-slate-500">{registry.url}</span>
          </div>
          <div className="p-5">
            {!registry.ok ? (
              <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-sm text-red-400">{registry.error || 'Registry offline'}</div>
            ) : (registry.rooms || []).length === 0 ? (
              <p className="text-sm text-slate-600 text-center py-6">No rooms in registry.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left border-b border-white/[0.06]">
                    {['Name','IP:Port','Players','Status'].map(h => <th key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-3 pr-4">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {registry.rooms.map(r => (
                      <tr key={r.roomId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-4 text-white font-medium">{r.roomName}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-400">{r.ipAddress}:{r.port}</td>
                        <td className="py-3 pr-4 text-slate-400">{r.playerCount}/{r.maxPlayers}</td>
                        <td className="py-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
