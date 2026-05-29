import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cpu, MemoryStick, HardDrive, Activity, Server, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { hm } from '../api/client.js';
import { cn } from '../lib/utils.js';

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

// ── helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (b == null) return '—';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

function fmtUptime(sec) {
  if (sec == null) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(' ');
}

function pctColor(p) {
  if (p >= 85) return 'text-red-400';
  if (p >= 60) return 'text-yellow-400';
  return 'text-emerald-400';
}

// btop-style block bar built from █ / ░ characters
function Bar({ pct = 0, width = 32 }) {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return (
    <span className="font-mono whitespace-pre">
      <span className="text-slate-600">[</span>
      <span className={pctColor(pct)}>{'█'.repeat(filled)}</span>
      <span className="text-white/[0.08]">{'░'.repeat(width - filled)}</span>
      <span className="text-slate-600">]</span>
      <span className={cn('ml-2 font-bold tabular-nums', pctColor(pct))}>{String(pct).padStart(3, ' ')}%</span>
    </span>
  );
}

// compact per-core mini bar
function CoreBar({ idx, pct }) {
  const width = 10;
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)));
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px]">
      <span className="text-slate-600 w-7">c{String(idx).padStart(2, '0')}</span>
      <span className="text-slate-600">[</span>
      <span className={pctColor(pct)}>{'█'.repeat(filled)}</span>
      <span className="text-white/[0.08]">{'░'.repeat(width - filled)}</span>
      <span className="text-slate-600">]</span>
      <span className={cn('tabular-nums w-9 text-right', pctColor(pct))}>{pct}%</span>
    </div>
  );
}

function Section({ icon: Icon, title, right, children }) {
  return (
    <div className="border border-white/[0.06] rounded-lg overflow-hidden bg-white/[0.015]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <Icon className="w-3.5 h-3.5 text-cyan-400" /> {title}
        </div>
        {right && <div className="text-[11px] font-mono text-slate-500">{right}</div>}
      </div>
      <div className="p-3 font-mono">{children}</div>
    </div>
  );
}

export default function ServerStatus() {
  const [sys, setSys]       = useState(null);
  const [err, setErr]       = useState('');
  const [live, setLive]     = useState(true);
  const [updated, setUpdated] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await hm.system();
      setSys(data);
      setErr('');
      setLive(true);
      setUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setErr(e.message || 'Cannot reach server');
      setLive(false);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, 2000);   // poll every 2s (btop-like refresh)
    return () => clearInterval(timer.current);
  }, [load]);

  const c = sys?.cpu;
  const m = sys?.memory;
  const d = sys?.disk;
  const h = sys?.host;
  const p = sys?.panel;

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Server className="w-6 h-6 text-cyan-400" /> Server Status
          </h1>
          <p className="text-sm text-slate-500 mt-1">Live system resource monitor · refreshes every 2s</p>
        </div>
        <div className="flex items-center gap-2">
          {live
            ? <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full font-semibold"><Wifi className="w-3 h-3" />Live{updated ? ` · ${updated}` : ''}</span>
            : <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full font-semibold"><WifiOff className="w-3 h-3" />Offline</span>
          }
        </div>
      </div>

      {/* Terminal window */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl overflow-hidden border border-cyan-500/15 shadow-[0_8px_40px_rgba(6,182,212,0.12)]"
      >
        {/* chrome */}
        <div className="flex items-center px-4 py-2.5 bg-[#0a0f1a] border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex-1 text-center text-[11px] font-mono text-slate-500">
            {h ? `${h.hostname} — btop` : 'server-status — btop'}
          </div>
          <div className="w-[52px]" />
        </div>

        {/* body */}
        <div className="bg-[#020810] p-4 space-y-3 relative">
          {err && !sys ? (
            <div className="text-red-400 font-mono text-sm py-8 text-center">✗ {err}</div>
          ) : !sys ? (
            <div className="text-slate-600 font-mono text-sm py-8 text-center">loading system stats…</div>
          ) : (
            <div className="relative space-y-3">
              {/* host line */}
              <div className="font-mono text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                <span><span className="text-cyan-400">host</span> {h.hostname}</span>
                <span><span className="text-cyan-400">os</span> {h.platform}/{h.arch}</span>
                <span><span className="text-cyan-400">kernel</span> {h.release}</span>
                <span><span className="text-cyan-400">up</span> {fmtUptime(h.uptime)}</span>
              </div>

              {/* CPU */}
              <Section icon={Cpu} title="CPU" right={`${c.cores} cores · load ${c.loadAvg.join(' ')}`}>
                <div className="text-[10px] text-slate-600 mb-2 truncate">{c.model}</div>
                <div className="mb-3 text-[13px]"><Bar pct={c.overall} width={40} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {c.perCore.map((pct, i) => <CoreBar key={i} idx={i} pct={pct} />)}
                </div>
              </Section>

              {/* Memory + Disk side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Section icon={MemoryStick} title="Memory" right={`${fmtBytes(m.used)} / ${fmtBytes(m.total)}`}>
                  <div className="text-[13px]"><Bar pct={m.usedPct} width={26} /></div>
                  <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                    <span>used <span className="text-slate-300">{fmtBytes(m.used)}</span></span>
                    <span>free <span className="text-slate-300">{fmtBytes(m.free)}</span></span>
                  </div>
                </Section>

                <Section icon={HardDrive} title="Disk" right={d ? `${fmtBytes(d.used)} / ${fmtBytes(d.total)}` : 'n/a'}>
                  {d ? (
                    <>
                      <div className="text-[13px]"><Bar pct={d.usedPct} width={26} /></div>
                      <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                        <span>mount <span className="text-slate-300">{d.mount}</span></span>
                        <span>free <span className="text-slate-300">{fmtBytes(d.free)}</span></span>
                      </div>
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-600">Disk stats unavailable on this platform.</div>
                  )}
                </Section>
              </div>

              {/* Panel process */}
              <Section icon={Activity} title="Panel Process" right={`pid uptime ${fmtUptime(p.uptime)}`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                  <Stat label="Rooms"        value={p.rooms} />
                  <Stat label="Services"     value={p.services} />
                  <Stat label="Node RSS"     value={fmtBytes(p.rss)} />
                  <Stat label="Registry"     value={p.registryUp ? 'up' : 'down'} color={p.registryUp ? 'text-emerald-400' : 'text-red-400'} />
                </div>
              </Section>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Stat({ label, value, color = 'text-white' }) {
  return (
    <div className="rounded-md bg-white/[0.02] border border-white/[0.05] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-slate-600">{label}</div>
      <div className={cn('text-sm font-bold tabular-nums mt-0.5', color)}>{value}</div>
    </div>
  );
}
