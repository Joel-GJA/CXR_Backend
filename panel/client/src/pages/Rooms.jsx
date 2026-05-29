import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Boxes, Plus, RotateCcw, Square, FileText, Users, Wifi, WifiOff, Package, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import StatusBadge from '../components/StatusBadge.jsx';
import LogTerminal from '../components/LogTerminal.jsx';
import { hm, buildsApi } from '../api/client.js';
import { useRealtime }   from '../contexts/RealtimeContext.jsx';
import { cn } from '../lib/utils.js';

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

// Must match config.js: entry.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
const normalizeId = name => name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

function Btn({ onClick, disabled, loading, icon: Icon, children, variant = 'default', sm = false }) {
  const v = {
    default: 'bg-white/[0.06] border-white/10 text-slate-300 hover:text-white hover:bg-white/10',
    primary: 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-glow-blue-sm',
    danger:  'bg-red-500/10 border-red-500/25 text-red-400 hover:bg-red-500/20',
  };
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
  const { subscribe } = useRealtime();
  const [rooms,      setRooms]      = useState([]);
  const [buildList,  setBuildList]  = useState([]);   // merged list of { id, name, path, executable }
  const [registry,   setRegistry]   = useState(null);
  const [roomLogs,   setRoomLogs]   = useState({});
  const [busy,       setBusy]       = useState({});
  const [toast,      setToast]      = useState(null);
  const [form,       setForm]       = useState({ requestedName: 'CXR_room_1', maxParticipants: 8, buildId: '' });
  const [buildsLoading, setBuildsLoading] = useState(true);

  const loadBuilds = useCallback(async () => {
    setBuildsLoading(true);
    try {
      const [hmRes, uploadRes] = await Promise.allSettled([hm.builds(), buildsApi.list()]);

      const merged = {};

      // HM builds are authoritative — IDs here are guaranteed valid for room creation
      if (hmRes.status === 'fulfilled') {
        const hmBuilds = hmRes.value.builds || {};
        Object.entries(hmBuilds).forEach(([id, b]) => {
          merged[id] = {
            id,
            name:          b.name || id,
            path:          b.workingDirectory || b.path || '',
            executable:    b.executablePath   ? b.executablePath.split('/').pop() : '',
            hasExecutable: !!b.executablePath,
          };
        });
      }

      // Upload API fills in anything HM hasn't scanned yet (e.g. just-uploaded build)
      // Only add if it has a binary AND isn't already represented (case-insensitive)
      if (uploadRes.status === 'fulfilled') {
        (uploadRes.value.builds || []).forEach(b => {
          if (!b.executable) return;              // skip builds without a binary
          const id = normalizeId(b.name);         // use same normalisation as server
          if (!merged[id]) {
            merged[id] = {
              id,
              name:          b.name,
              path:          b.path || '',
              executable:    b.executable || '',
              hasExecutable: true,
            };
          }
        });
      }

      // Only list builds that actually have a runnable binary
      const list = Object.values(merged).filter(b => b.hasExecutable);
      setBuildList(list);

      // Keep current selection if still valid, otherwise pick first
      setForm(f => ({
        ...f,
        buildId: list.find(b => b.id === f.buildId) ? f.buildId : (list[0]?.id ?? ''),
      }));
    } finally {
      setBuildsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    const [r, reg] = await Promise.allSettled([hm.listRooms(), hm.registryState()]);
    if (r.status   === 'fulfilled') setRooms(r.value.rooms || []);
    if (reg.status === 'fulfilled') setRegistry(reg.value);
  }, []);

  // Real-time: subscribe to WS state events for instant room updates
  useEffect(() => subscribe('state', msg => {
    if (msg.rooms) setRooms(msg.rooms);
  }), [subscribe]);

  useEffect(() => {
    loadBuilds();
    load();
    // Keep polling as a fallback only (WS handles live updates)
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load, loadBuilds]);

  async function createRoom() {
    setBusy(b => ({ ...b, create: true }));
    try {
      const payload = {
        requestedName:   form.requestedName,
        maxParticipants: parseInt(form.maxParticipants, 10),
        buildId:         form.buildId || undefined,
      };
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

  async function removeRegistryRoom(roomId) {
    setBusy(b => ({ ...b, [`reg-${roomId}`]: true }));
    try {
      await hm.deleteRegistryRoom(roomId);
      flash('Removed from registry');
      load();
    } catch (e) { flash(e.message, 'error'); }
    finally { setBusy(b => ({ ...b, [`reg-${roomId}`]: false })); }
  }

  function flash(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500); }

  const noBuilds = !buildsLoading && buildList.length === 0;

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
        <Btn onClick={() => { loadBuilds(); load(); }} icon={RefreshCw} variant="default">Refresh</Btn>
      </div>

      {/* No builds warning banner */}
      <AnimatePresence>
        {noBuilds && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 mb-6 rounded-xl bg-yellow-500/10 border border-yellow-500/25 text-yellow-400"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">No Unity builds found</div>
              <div className="text-xs text-yellow-400/70 mt-0.5">
                Upload a build on the <a href="/builds" className="underline underline-offset-2 hover:text-yellow-300">Build Upload</a> page,
                or place your Unity Linux headless build folder inside <span className="font-mono">unity-builds/</span> on the server.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Room */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass mb-6">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
          <Plus className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Create Room</span>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">

            {/* Room Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Room Name</label>
              <input type="text" value={form.requestedName}
                onChange={e => setForm(f => ({ ...f, requestedName: e.target.value }))}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Max Players */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500">Max Players</label>
              <input type="number" min="1" max="32" value={form.maxParticipants}
                onChange={e => setForm(f => ({ ...f, maxParticipants: e.target.value }))}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Build selector — always visible */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Unity Build
                {buildsLoading && <span className="text-[9px] text-slate-600 ml-auto">Loading…</span>}
                {!buildsLoading && (
                  <span className={cn('text-[9px] ml-auto font-bold', buildList.length > 0 ? 'text-emerald-400' : 'text-yellow-400')}>
                    {buildList.length} available
                  </span>
                )}
              </label>
              <select
                value={form.buildId}
                onChange={e => setForm(f => ({ ...f, buildId: e.target.value }))}
                disabled={buildsLoading || buildList.length === 0}
                className={cn(
                  'border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all',
                  buildList.length === 0
                    ? 'bg-yellow-500/5 border-yellow-500/25 text-yellow-500/60 cursor-not-allowed'
                    : 'bg-white/[0.04] border-white/10 text-white',
                )}
              >
                {buildList.length === 0 ? (
                  <option value="">— No builds available —</option>
                ) : (
                  buildList.map(b => (
                    <option key={b.id} value={b.id} className="bg-[#040810] text-white">
                      {b.name}{b.executable ? ` ✓` : ' (no binary)'}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Create button */}
            <div>
              <Btn
                onClick={createRoom}
                loading={busy.create}
                disabled={noBuilds || !form.requestedName.trim()}
                icon={Plus}
                variant="primary"
              >
                Create Room
              </Btn>
            </div>
          </div>

          {/* Selected build detail */}
          {form.buildId && buildList.length > 0 && (() => {
            const selected = buildList.find(b => b.id === form.buildId);
            if (!selected) return null;
            return (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-3 px-4 py-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15"
              >
                <Package className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-blue-300">{selected.name}</span>
                  {selected.executable && (
                    <span className="ml-2 text-[11px] text-emerald-400 font-mono">{selected.executable}</span>
                  )}
                  {!selected.executable && (
                    <span className="ml-2 text-[11px] text-yellow-400">no .x86_64 binary detected</span>
                  )}
                  {selected.path && (
                    <div className="text-[10px] font-mono text-slate-600 mt-0.5 truncate">{selected.path}</div>
                  )}
                </div>
              </motion.div>
            );
          })()}
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
                  <div className="p-4 border-b border-white/[0.05]">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-sm font-bold text-white">{room.requestedName || room.roomId}</div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">{room.ip}:{room.port}</div>
                        {room.buildId && (
                          <div className="text-[10px] text-blue-400/70 mt-0.5 flex items-center gap-1">
                            <Package className="w-2.5 h-2.5" /> {room.buildId}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={room.status} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Players</span>
                        <span>{room.playerCount ?? 0}/{room.maxParticipants ?? '?'}</span>
                      </div>
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${((room.playerCount ?? 0) / (room.maxParticipants || 1)) * 100}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 p-3 flex-wrap">
                    {(room.status === 'running' || room.status === 'starting') && (
                      <Btn onClick={() => restartRoom(room.roomId)} loading={busy[room.roomId] === 'restart'} icon={RotateCcw} sm>Restart</Btn>
                    )}
                    {(room.status === 'running' || room.status === 'starting') && (
                      <Btn onClick={() => stopRoom(room.roomId)} loading={busy[room.roomId] === 'stop'} icon={Square} sm variant="danger">Stop</Btn>
                    )}
                    <Btn
                      onClick={() => roomLogs[room.roomId]
                        ? setRoomLogs(p => { const n = { ...p }; delete n[room.roomId]; return n; })
                        : loadRoomLogs(room.roomId)
                      }
                      icon={FileText} sm
                    >
                      {roomLogs[room.roomId] ? 'Hide' : 'Logs'}
                    </Btn>
                  </div>
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
                  <thead>
                    <tr className="text-left border-b border-white/[0.06]">
                      {['Name', 'IP:Port', 'Players', 'Status', ''].map(h => (
                        <th key={h} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registry.rooms.map(r => (
                      <tr key={r.roomId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-4 text-white font-medium">{r.roomName}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-slate-400">{r.ipAddress}:{r.port}</td>
                        <td className="py-3 pr-4 text-slate-400">{r.playerCount}/{r.maxPlayers}</td>
                        <td className="py-3 pr-4"><StatusBadge status={r.status} /></td>
                        <td className="py-3 text-right">
                          <motion.button
                            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                            onClick={() => removeRegistryRoom(r.roomId)}
                            disabled={busy[`reg-${r.roomId}`]}
                            title="Remove from registry"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </motion.button>
                        </td>
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
