import React from 'react';
import { cn } from '../../lib/utils.js';

const variants = {
  default:     'bg-blue-500/15 text-blue-400 border-blue-500/25',
  secondary:   'bg-slate-500/15 text-slate-300 border-slate-500/25',
  destructive: 'bg-red-500/15 text-red-400 border-red-500/25',
  outline:     'bg-transparent text-slate-300 border-white/20',
  success:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  warning:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  ghost:       'bg-white/5 text-slate-400 border-transparent',
};

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors',
        variants[variant] || variants.default,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
