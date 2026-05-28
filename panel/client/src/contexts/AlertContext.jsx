import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const AlertContext = createContext(null);

// Generates a short beep using Web Audio API — no external file needed
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'error') {
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'warning') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(360, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(); osc.stop(ctx.currentTime + 0.2);
    }
  } catch (_) {}
}

let _id = 0;

export function AlertProvider({ children }) {
  const [alerts, setAlerts]       = useState([]);
  const [muted,  setMuted]        = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const dismiss = useCallback((id) => {
    setAlerts(a => a.filter(x => x.id !== id));
  }, []);

  const push = useCallback((msg, type = 'info', opts = {}) => {
    const id = ++_id;
    if (!mutedRef.current) playSound(type);
    setAlerts(prev => [...prev.slice(-9), { id, msg, type, title: opts.title, persistent: opts.persistent || false }]);
    if (!opts.persistent) {
      const ttl = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
      setTimeout(() => dismiss(id), opts.ttl || ttl);
    }
    return id;
  }, [dismiss]);

  const alert   = useCallback((msg, opts) => push(msg, 'error',   opts), [push]);
  const warn    = useCallback((msg, opts) => push(msg, 'warning', opts), [push]);
  const success = useCallback((msg, opts) => push(msg, 'success', opts), [push]);
  const info    = useCallback((msg, opts) => push(msg, 'info',    opts), [push]);

  return (
    <AlertContext.Provider value={{ alerts, push, alert, warn, success, info, dismiss, muted, setMuted }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() { return useContext(AlertContext); }
