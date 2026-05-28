import React, { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils.js';

const morphTime    = 1.5;
const cooldownTime = 0.5;

function useMorphingText(texts) {
  const textIndexRef = useRef(0);
  const morphRef     = useRef(0);
  const cooldownRef  = useRef(0);
  const timeRef      = useRef(new Date());
  const text1Ref     = useRef(null);
  const text2Ref     = useRef(null);

  const setStyles = useCallback((fraction) => {
    const [c1, c2] = [text1Ref.current, text2Ref.current];
    if (!c1 || !c2) return;
    c2.style.filter  = `blur(${Math.min(8 / fraction - 8, 100)}px)`;
    c2.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
    const inv = 1 - fraction;
    c1.style.filter  = `blur(${Math.min(8 / inv - 8, 100)}px)`;
    c1.style.opacity = `${Math.pow(inv, 0.4) * 100}%`;
    c1.textContent = texts[textIndexRef.current % texts.length];
    c2.textContent = texts[(textIndexRef.current + 1) % texts.length];
  }, [texts]);

  const doMorph = useCallback(() => {
    morphRef.current -= cooldownRef.current;
    cooldownRef.current = 0;
    let f = morphRef.current / morphTime;
    if (f > 1) { cooldownRef.current = cooldownTime; f = 1; }
    setStyles(f);
    if (f === 1) textIndexRef.current++;
  }, [setStyles]);

  const doCooldown = useCallback(() => {
    morphRef.current = 0;
    const [c1, c2] = [text1Ref.current, text2Ref.current];
    if (c1 && c2) {
      c2.style.filter = 'none'; c2.style.opacity = '100%';
      c1.style.filter = 'none'; c1.style.opacity = '0%';
    }
  }, []);

  useEffect(() => {
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = new Date();
      const dt = (now.getTime() - timeRef.current.getTime()) / 1000;
      timeRef.current = now;
      cooldownRef.current -= dt;
      if (cooldownRef.current <= 0) doMorph();
      else doCooldown();
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [doMorph, doCooldown]);

  return { text1Ref, text2Ref };
}

function Texts({ texts }) {
  const { text1Ref, text2Ref } = useMorphingText(texts);
  return (
    <>
      <span className="absolute inset-x-0 top-0 m-auto inline-block w-full" ref={text1Ref} />
      <span className="absolute inset-x-0 top-0 m-auto inline-block w-full" ref={text2Ref} />
    </>
  );
}

function SvgFilters() {
  return (
    <svg id="cxr-morph-filters" className="fixed h-0 w-0" preserveAspectRatio="xMidYMid slice">
      <defs>
        <filter id="threshold">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140" />
        </filter>
      </defs>
    </svg>
  );
}

export function MorphingText({ texts, className }) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-3xl text-center font-sans font-bold leading-none',
        className,
      )}
      style={{ filter: 'url(#threshold) blur(0.6px)' }}
    >
      <Texts texts={texts} />
      <SvgFilters />
    </div>
  );
}
