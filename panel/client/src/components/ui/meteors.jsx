import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils.js';

export function Meteors({
  number      = 20,
  minDelay    = 0.2,
  maxDelay    = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle       = 215,
  className,
}) {
  const [meteorStyles, setMeteorStyles] = useState([]);

  useEffect(() => {
    const compute = () => Array.from({ length: number }, () => ({
      top:             '-5%',
      left:            `${Math.floor(Math.random() * window.innerWidth)}px`,
      animationDelay:  `${(Math.random() * (maxDelay - minDelay) + minDelay).toFixed(2)}s`,
      animationDuration: `${Math.floor(Math.random() * (maxDuration - minDuration) + minDuration)}s`,
      '--meteor-angle': `-${angle}deg`,
    }));
    setMeteorStyles(compute());
    // Recompute meteor positions on window resize so they don't drift offscreen
    const onResize = () => setMeteorStyles(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle]);

  return (
    <>
      {meteorStyles.map((style, i) => (
        <span
          key={i}
          style={style}
          className={cn(
            'animate-meteor pointer-events-none absolute w-0.5 h-0.5 rounded-full bg-slate-400 shadow-[0_0_0_1px_#ffffff10]',
            className,
          )}
        >
          {/* Tail */}
          <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-slate-400 to-transparent" />
        </span>
      ))}
    </>
  );
}
