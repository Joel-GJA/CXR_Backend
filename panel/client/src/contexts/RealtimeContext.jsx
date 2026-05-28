import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const RealtimeCtx = createContext({ subscribe: () => () => {}, connected: false, reconnect: () => {} });

export function RealtimeProvider({ children }) {
  const wsRef     = useRef(null);
  const listenRef = useRef(new Map()); // type → Set<callback>
  const reconnRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    clearTimeout(reconnRef.current);
    if (wsRef.current && wsRef.current.readyState < 2) wsRef.current.close();
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws    = new WebSocket(`${proto}//${location.host}/logs`);
    wsRef.current = ws;
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        listenRef.current.get(msg.type)?.forEach(cb => cb(msg));
        listenRef.current.get('*')?.forEach(cb => cb(msg));
      } catch {}
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnRef.current); wsRef.current?.close(); };
  }, [connect]);

  const subscribe = useCallback((type, cb) => {
    const map = listenRef.current;
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(cb);
    return () => map.get(type)?.delete(cb);
  }, []);

  const reconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
  }, []);

  return (
    <RealtimeCtx.Provider value={{ subscribe, connected, reconnect }}>
      {children}
    </RealtimeCtx.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeCtx);
