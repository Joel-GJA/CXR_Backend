import React, { useRef, useEffect } from 'react';
import { cn } from '../lib/utils.js';

const H = { sm: 'h-48', md: 'h-80', lg: 'h-[520px]' };

function lineColor(t) {
  const l = t.toLowerCase();
  if (l.includes('error') || l.includes('exception')) return 'text-red-400';
  if (l.includes('warn') || l.includes('[stderr]'))   return 'text-yellow-400';
  if (l.includes('debug'))                            return 'text-slate-600';
  return 'text-slate-400';
}

export default function LogTerminal({ lines = [], height = 'md', autoScroll = true, label = 'output' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, autoScroll]);

  return (
    <div className="rounded-xl overflow-hidden border border-blue-500/10 bg-[#020810]">
      {/* Chrome bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.02] border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-[11px] text-slate-600 font-mono">{label}</span>
      </div>
      {/* Log body */}
      <div ref={ref} className={cn('overflow-y-auto p-4 font-mono text-[12px] leading-relaxed', H[height] || H.md)}>
        {lines.length === 0
          ? <span className="text-slate-700">No output yet...</span>
          : lines.map((line, i) => (
            <div key={i} className={cn('whitespace-pre-wrap break-all', lineColor(line))}>{line}</div>
          ))
        }
      </div>
    </div>
  );
}
