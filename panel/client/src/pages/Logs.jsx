import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Terminal, Pause, Play, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useRealtime } from '../contexts/RealtimeContext.jsx';
import { cn } from '../lib/utils.js';

const MAX_LINES = 1000;
const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

function lineColor(t) {
  const l = t.toLowerCase();
  if (l.includes('error') || l.includes('exception')) return 'text-red-400';
  if (l.includes('warn') || l.includes('[stderr]'))   return 'text-yellow-400';
  if (l.includes('debug'))                            return 'text-slate-600';
  return 'text-slate-400';
}

export default function Logs() {
  const { subscribe, connected, reconnect } = useRealtime();
  const [lines,         setLines]         = useState([]);
  const [paused,        setPaused]        = useState(false);
  const [serviceFilter, setServiceFilter] = useState('');
  const [streamFilter,  setStreamFilter]  = useState('');
  const [search,        setSearch]        = useState('');
  const termRef  = useRef(null);
  const pauseRef = useRef(false);
  pauseRef.current = paused;

  // Subscribe to log events from the shared WebSocket
  useEffect(() => subscribe('log', msg => {
    if (pauseRef.current) return;
    const service = msg.serviceId || msg.roomId || msg.source || 'system';
    const stream  = msg.stream || 'stdout';
    const text    = msg.data || msg.text || msg.message || JSON.stringify(msg);
    setLines(prev => {
      const next = [...prev, `[${service}] [${stream}] ${text.trimEnd()}`];
      return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
    });
  }), [subscribe]);

  useEffect(() => {
    if (!paused && termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [lines, paused]);

  const services = [...new Set(lines.map(l => { const m = l.match(/^\[([^\]]+)\]/); return m?.[1] ?? null; }).filter(Boolean))];
  const filtered = lines.filter(line => {
    if (serviceFilter && !line.startsWith(`[${serviceFilter}]`))                    return false;
    if (streamFilter  && !line.includes(`[${streamFilter}]`))                       return false;
    if (search        && !line.toLowerCase().includes(search.toLowerCase()))         return false;
    return true;
  });

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Terminal className="w-6 h-6 text-blue-400" /> Live Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time WebSocket stream from all managed processes</p>
        </div>
        <div className="flex items-center gap-2">
          {connected
            ? <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-semibold"><Wifi className="w-3 h-3" />Live</span>
            : <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full font-semibold"><WifiOff className="w-3 h-3" />Disconnected</span>
          }
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass">
        {/* Controls */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-5 pb-4 border-b border-white/5">
          <div className="flex flex-wrap gap-3">
            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/40 transition-all"
            >
              <option value="">All services</option>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={streamFilter} onChange={e => setStreamFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/40 transition-all"
            >
              <option value="">All streams</option>
              <option value="stdout">stdout</option>
              <option value="stderr">stderr</option>
            </select>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..."
              className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all w-44"
            />
          </div>
          <div className="flex gap-2">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setPaused(p => !p)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                paused ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
              )}
            >
              {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {paused ? 'Resume' : 'Pause'}
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={() => setLines([])}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={reconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Reconnect
            </motion.button>
          </div>
        </div>

        {/* Terminal */}
        <div className="rounded-b-xl overflow-hidden bg-[#020810]">
          <div ref={termRef} className="h-[560px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed">
            {filtered.length === 0 ? (
              <span className="text-slate-700">{lines.length === 0 ? 'Waiting for logs…' : 'No lines match filter.'}</span>
            ) : (
              filtered.map((line, i) => <div key={i} className={cn('whitespace-pre-wrap break-all', lineColor(line))}>{line}</div>)
            )}
          </div>
          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-t border-white/5 text-[11px] text-slate-600">
            <span>{filtered.length} / {lines.length} lines{paused ? ' · PAUSED' : ''}</span>
            <span>{connected ? 'WebSocket connected' : 'Reconnecting…'}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
