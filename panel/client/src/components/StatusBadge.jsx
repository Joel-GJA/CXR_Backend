import React from 'react';
import { cn } from '../lib/utils.js';

const VARIANTS = {
  running:  { dot: 'bg-emerald-400 animate-ping-slow shadow-glow-green', ring: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  ok:       { dot: 'bg-emerald-400 animate-ping-slow shadow-glow-green', ring: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  open:     { dot: 'bg-emerald-400', ring: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  starting: { dot: 'bg-yellow-400 animate-ping-slow',  ring: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25' },
  pending:  { dot: 'bg-yellow-400 animate-ping-slow',  ring: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25' },
  loading:  { dot: 'bg-yellow-400 animate-ping-slow',  ring: 'bg-yellow-400', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25' },
  stopped:  { dot: 'bg-red-400',    ring: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'     },
  stopping: { dot: 'bg-red-400',    ring: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'     },
  error:    { dot: 'bg-red-400',    ring: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'     },
  closed:   { dot: 'bg-red-400',    ring: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'     },
  failed:   { dot: 'bg-red-400',    ring: 'bg-red-400',    text: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25'     },
};

const FALLBACK = { dot: 'bg-slate-500', ring: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' };

export default function StatusBadge({ status }) {
  const s   = (status || 'unknown').toLowerCase();
  const v   = VARIANTS[s] || FALLBACK;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border', v.bg, v.text)}>
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75', v.dot)} />
        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', v.ring)} />
      </span>
      {status || 'unknown'}
    </span>
  );
}
