import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, XCircle, CheckCircle2, Info, X, BellOff, Bell } from 'lucide-react';
import { useAlert } from '../contexts/AlertContext.jsx';
import { cn } from '../lib/utils.js';

const CONFIG = {
  error:   { icon: XCircle,        color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/25',     bar: 'bg-red-500'     },
  warning: { icon: AlertTriangle,  color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/25', bar: 'bg-yellow-400' },
  success: { icon: CheckCircle2,   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25', bar: 'bg-emerald-400' },
  info:    { icon: Info,           color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/25',    bar: 'bg-blue-400'    },
};

export default function AlertSystem() {
  const { alerts, dismiss, muted, setMuted } = useAlert();

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {/* Mute toggle */}
      <div className="flex justify-end pointer-events-auto mb-1">
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setMuted(m => !m)}
          title={muted ? 'Unmute alerts' : 'Mute alerts'}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all',
            muted
              ? 'bg-slate-700/80 border-white/10 text-slate-400'
              : 'bg-[#040810]/80 border-white/10 text-slate-500 hover:text-slate-300',
          )}
        >
          {muted ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
          {muted ? 'Muted' : 'Alerts on'}
        </motion.button>
      </div>

      <AnimatePresence mode="sync">
        {alerts.map(alert => {
          const { icon: Icon, color, bg, bar } = CONFIG[alert.type] || CONFIG.info;
          return (
            <motion.div
              key={alert.id}
              layout
              initial={{ opacity: 0, x: 80, scale: 0.9  }}
              animate={{ opacity: 1, x: 0,  scale: 1    }}
              exit={{    opacity: 0, x: 80, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn('relative pointer-events-auto rounded-xl border overflow-hidden backdrop-blur-md shadow-xl', bg)}
            >
              {/* Left accent bar */}
              <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', bar)} />

              <div className="flex items-start gap-3 px-4 py-3 pl-5">
                <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', color)} />
                <div className="flex-1 min-w-0">
                  {alert.title && (
                    <div className="text-xs font-semibold text-white mb-0.5">{alert.title}</div>
                  )}
                  <div className="text-xs text-slate-300 leading-relaxed break-words">{alert.msg}</div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => dismiss(alert.id)}
                  className="flex-shrink-0 text-slate-500 hover:text-white transition-colors mt-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
