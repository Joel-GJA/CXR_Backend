import React, { useCallback, useRef } from 'react';
import { Moon, Sun } from 'lucide-react';
import { flushSync } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { cn } from '../../lib/utils.js';

function collapsed(cx, cy, n) {
  return `polygon(${Array.from({ length: n }, () => `${cx}px ${cy}px`).join(', ')})`;
}

function clipPaths(variant, cx, cy, R, vw, vh) {
  switch (variant) {
    case 'circle':
      return [`circle(0px at ${cx}px ${cy}px)`, `circle(${R}px at ${cx}px ${cy}px)`];
    case 'square': {
      const h = Math.max(cx, vw - cx, cy, vh - cy) * 1.05;
      const end = [`${cx-h}px ${cy-h}px`, `${cx+h}px ${cy-h}px`, `${cx+h}px ${cy+h}px`, `${cx-h}px ${cy+h}px`].join(', ');
      return [collapsed(cx, cy, 4), `polygon(${end})`];
    }
    case 'diamond': {
      const d = R * Math.SQRT2;
      const end = [`${cx}px ${cy-d}px`, `${cx+d}px ${cy}px`, `${cx}px ${cy+d}px`, `${cx-d}px ${cy}px`].join(', ');
      return [collapsed(cx, cy, 4), `polygon(${end})`];
    }
    case 'hexagon': {
      const verts = Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        return `${cx + R * Math.SQRT2 * Math.cos(a)}px ${cy + R * Math.SQRT2 * Math.sin(a)}px`;
      });
      return [collapsed(cx, cy, 6), `polygon(${verts.join(', ')})`];
    }
    case 'star': {
      const ro = R * Math.SQRT2 * 1.03, ri = ro * 0.42;
      const star = (r) => Array.from({ length: 5 }, (_, i) => {
        const oa = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const ia = oa + Math.PI / 5;
        return [`${cx + r * Math.cos(oa)}px ${cy + r * Math.sin(oa)}px`,
                `${cx + ri * Math.cos(ia)}px ${cy + ri * Math.sin(ia)}px`];
      }).flat().join(', ');
      return [`polygon(${star(ro * 0.025)})`, `polygon(${star(ro)})`];
    }
    default:
      return [`circle(0px at ${cx}px ${cy}px)`, `circle(${R}px at ${cx}px ${cy}px)`];
  }
}

export function AnimatedThemeToggler({
  className,
  duration   = 400,
  variant    = 'circle',
  fromCenter = false,
  children,
  ...props
}) {
  const { isDark, toggle } = useTheme();
  const ref = useRef(null);

  const handleToggle = useCallback(() => {
    const btn = ref.current;
    if (!btn) { toggle(); return; }

    const vw = window.visualViewport?.width  ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    let cx, cy;
    if (fromCenter) {
      cx = vw / 2; cy = vh / 2;
    } else {
      const r = btn.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    }
    const maxR = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy));

    if (typeof document.startViewTransition !== 'function') { toggle(); return; }

    const [from, to] = clipPaths(variant, cx, cy, maxR, vw, vh);
    const root = document.documentElement;
    root.dataset.magicuiThemeVt = 'active';
    root.style.setProperty('--magicui-theme-toggle-vt-duration', `${duration}ms`);
    root.style.setProperty('--magicui-theme-vt-clip-from', from);

    const cleanup = () => {
      delete root.dataset.magicuiThemeVt;
      root.style.removeProperty('--magicui-theme-toggle-vt-duration');
      root.style.removeProperty('--magicui-theme-vt-clip-from');
    };

    const transition = document.startViewTransition(() => { flushSync(toggle); });
    transition?.finished?.finally?.(cleanup);
    transition?.ready?.then?.(() => {
      document.documentElement.animate(
        { clipPath: [from, to] },
        { duration, easing: variant === 'star' ? 'linear' : 'ease-in-out', fill: 'forwards', pseudoElement: '::view-transition-new(root)' }
      );
    });
  }, [variant, fromCenter, duration, isDark, toggle]);

  return (
    <button type="button" ref={ref} onClick={handleToggle} className={cn(className)} {...props}>
      {isDark
        ? <Sun  className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
        : <Moon className="w-3.5 h-3.5 text-blue-400  flex-shrink-0" />
      }
      {children}
    </button>
  );
}
