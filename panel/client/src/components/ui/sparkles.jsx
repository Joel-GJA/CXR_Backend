import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils.js';

/**
 * Lightweight canvas-based sparkles, API-compatible with @tabler/sparkles.
 * Renders twinkling particles that drift slowly upward.
 */
export function SparklesCore({
  id,
  className,
  background       = 'transparent',
  minSize          = 0.4,
  maxSize          = 1.2,
  particleDensity  = 100,
  particleColor    = '#FFFFFF',
  speed            = 0.4,
}) {
  const canvasRef    = useRef(null);
  const particlesRef = useRef([]);
  const rafRef       = useRef(null);
  const sizeRef      = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w   = parent.clientWidth;
      const h   = parent.clientHeight;
      sizeRef.current = { w, h, dpr };
      canvas.width        = w * dpr;
      canvas.height       = h * dpr;
      canvas.style.width  = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Compute particle count from density (per ~10k px²)
      const area  = (w * h) / 10000;
      const count = Math.max(20, Math.floor((particleDensity / 100) * area));

      particlesRef.current = Array.from({ length: count }, () => spawn(w, h, minSize, maxSize, speed));
    };

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    resize();

    const tick = () => {
      if (!running) return;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      if (background && background !== 'transparent') {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, w, h);
      }

      for (const p of particlesRef.current) {
        // Slow drift upward + slight horizontal sway
        p.y -= p.vy;
        p.x += Math.sin(p.life * 0.05) * 0.15;
        p.life++;
        // Twinkle: opacity oscillates with phase
        const twinkle = 0.5 + 0.5 * Math.sin(p.life * p.twinkleSpeed + p.phase);
        const opacity = p.baseOpacity * twinkle;

        ctx.beginPath();
        ctx.fillStyle = withAlpha(particleColor, opacity);
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Respawn if it drifts off the top or fades fully
        if (p.y < -p.size * 2) {
          Object.assign(p, spawn(w, h, minSize, maxSize, speed));
          p.y = h + p.size;
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [background, minSize, maxSize, particleDensity, particleColor, speed]);

  return (
    <canvas
      ref={canvasRef}
      id={id}
      className={cn('absolute inset-0', className)}
      aria-hidden="true"
    />
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function spawn(w, h, minSize, maxSize, speed) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    size: minSize + Math.random() * (maxSize - minSize),
    vy: 0.05 + Math.random() * speed,
    baseOpacity: 0.3 + Math.random() * 0.7,
    twinkleSpeed: 0.02 + Math.random() * 0.06,
    phase: Math.random() * Math.PI * 2,
    life: Math.floor(Math.random() * 1000),
  };
}

function withAlpha(hex, alpha) {
  // Accepts #RGB, #RRGGBB, or already-rgba; returns rgba(r,g,b,alpha)
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
