import React, { useState } from 'react';
import { cn } from '../../lib/utils.js';

const sizes = { sm: 'w-7 h-7 text-xs', default: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-lg' };

export function Avatar({ src, alt, fallback, size = 'default', badge, badgeClassName, className }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className={cn('relative inline-flex flex-shrink-0', sizes[size], className)}>
      <div className={cn(
        'w-full h-full rounded-full overflow-hidden flex items-center justify-center font-semibold select-none',
        'bg-gradient-to-br from-blue-500/30 to-blue-700/20 border border-blue-500/25 text-blue-300',
      )}>
        {src && !imgError
          ? <img src={src} alt={alt} onError={() => setImgError(true)} className="w-full h-full object-cover" />
          : <span>{fallback || (alt?.[0] ?? '?').toUpperCase()}</span>
        }
      </div>
      {badge !== undefined && (
        <span className={cn(
          'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#040810]',
          badge ? 'bg-emerald-400' : 'bg-slate-500',
          badgeClassName,
        )} />
      )}
    </div>
  );
}

export function AvatarGroup({ children, max, className }) {
  const kids = React.Children.toArray(children);
  const shown = max ? kids.slice(0, max) : kids;
  const extra = max && kids.length > max ? kids.length - max : 0;
  return (
    <div className={cn('flex -space-x-2', className)}>
      {shown.map((child, i) => (
        <div key={i} className="ring-2 ring-[#040810] rounded-full">{child}</div>
      ))}
      {extra > 0 && (
        <div className="w-9 h-9 rounded-full ring-2 ring-[#040810] bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
          +{extra}
        </div>
      )}
    </div>
  );
}
