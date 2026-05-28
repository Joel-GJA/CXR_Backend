import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils.js';

const HEIGHTS = { sm: 'h-48', md: 'h-80', lg: 'h-[520px]', xl: 'h-[640px]' };

function colorFor(line) {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('exception') || l.includes('fail')) return 'text-red-400';
  if (l.includes('warn') || l.includes('[stderr]'))                          return 'text-yellow-400';
  if (l.includes('debug') || l.includes('trace'))                            return 'text-slate-500';
  if (l.includes('info') || l.includes('ready') || l.includes('started'))    return 'text-cyan-300';
  return 'text-slate-300';
}

/**
 * Aceternity-style terminal window.
 * Mac-style chrome dots, subtle gradient border, glow on hover,
 * animated line entry, and a typing cursor at the tail.
 */
export default function Terminal({
  lines      = [],
  height     = 'md',
  autoScroll = true,
  label      = 'output',
  showCursor = true,
  className,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoScroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines, autoScroll]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'group relative rounded-xl overflow-hidden',
        // Aceternity-style gradient ring + glow
        'before:absolute before:inset-0 before:rounded-xl before:p-px before:pointer-events-none',
        'before:bg-gradient-to-br before:from-cyan-500/30 before:via-blue-500/10 before:to-purple-500/20',
        'before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)]',
        'before:[mask-composite:exclude]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_40px_rgba(59,130,246,0.25)] transition-shadow duration-300',
        className,
      )}
    >
      <div className="relative bg-[#020810] rounded-xl overflow-hidden">
        {/* Chrome bar */}
        <div className="relative flex items-center px-4 py-2.5 bg-white/[0.025] border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 transition-transform group-hover:scale-110" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 transition-transform group-hover:scale-110 delay-75" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 transition-transform group-hover:scale-110 delay-150" />
          </div>
          <div className="absolute inset-x-0 text-center pointer-events-none">
            <span className="text-[11px] text-slate-500 font-mono select-none">{label}</span>
          </div>
        </div>

        {/* Body */}
        <div
          ref={ref}
          className={cn(
            'relative overflow-y-auto p-4 font-mono text-[12px] leading-relaxed',
            HEIGHTS[height] || HEIGHTS.md,
          )}
        >
          {/* Subtle CRT scanline overlay */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_3px)]" />

          {lines.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-600">
              <span className="text-cyan-500/80">$</span>
              <span>waiting for output…</span>
              {showCursor && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block w-2 h-3.5 bg-cyan-400/80 align-middle"
                />
              )}
            </div>
          ) : (
            <>
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className={cn('whitespace-pre-wrap break-all relative z-10', colorFor(line))}
                >
                  {line}
                </motion.div>
              ))}
              {showCursor && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block w-2 h-3.5 bg-cyan-400/80 align-middle ml-0.5"
                />
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
