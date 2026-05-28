import React from 'react';
import { cn } from '../../lib/utils.js';

const colorMap = {
  blue:    'from-blue-600 to-blue-400',
  green:   'from-emerald-600 to-emerald-400',
  red:     'from-red-600 to-red-400',
  yellow:  'from-yellow-600 to-yellow-400',
  purple:  'from-purple-600 to-purple-400',
};

export function Progress({ value = 0, max = 100, color = 'blue', label, showValue, className }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs text-slate-400">{label}</span>}
          {showValue && <span className="text-xs font-mono text-slate-400">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', colorMap[color] || colorMap.blue)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
