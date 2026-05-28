import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Zap, Boxes, Server, Terminal,
  HeartPulse, Activity, Sun, Moon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { cn } from '../lib/utils.js';

const NAV = [
  { to: '/overview',    icon: LayoutDashboard, label: 'Overview'    },
  { to: '/hostmanager', icon: Zap,             label: 'Host Manager', tag: 'CORE' },
  { to: '/rooms',       icon: Boxes,           label: 'Rooms'       },
  { to: '/services',    icon: Server,          label: 'Services'    },
  { to: '/logs',        icon: Terminal,        label: 'Live Logs'   },
  { to: '/health',      icon: HeartPulse,      label: 'Health'      },
  { to: '/events',      icon: Activity,        label: 'Events'      },
];

const navItem = {
  hidden:  { opacity: 0, x: -16 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.045, duration: 0.28, ease: 'easeOut' } }),
};

export default function Layout({ children }) {
  const { isDark, toggle } = useTheme();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn(
      'flex h-screen overflow-hidden font-sans',
      isDark
        ? 'bg-black text-white'
        : 'bg-slate-100 text-slate-900',
    )}>

      {/* ── Background layers (dark only) ─────────────────────── */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-dot-grid bg-dot-grid opacity-100" />
          <div className="absolute inset-0 bg-blue-radial" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/5 blur-[100px] rounded-full" />
        </div>
      )}

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 252 }}
        transition={{ type: 'spring', stiffness: 340, damping: 32 }}
        className={cn(
          'relative z-20 flex flex-col flex-shrink-0 overflow-hidden',
          isDark
            ? 'bg-[#040810] border-r border-blue-500/10'
            : 'bg-slate-900 border-r border-slate-700',
        )}
      >
        {/* Blue top glow */}
        {isDark && <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-blue-500/6 to-transparent pointer-events-none" />}

        {/* Brand */}
        <div className="relative flex items-center gap-3 px-4 py-5 border-b border-white/5 min-h-[68px]">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 6 }}
            whileTap={{ scale: 0.94 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-glow-blue-sm cursor-pointer"
          >
            <Zap className="w-4 h-4 text-white" />
          </motion.div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }} className="overflow-hidden whitespace-nowrap"
              >
                <div className="text-sm font-bold text-white leading-tight">CXR Ops Panel</div>
                <div className="text-[11px] text-blue-400/60 leading-tight mt-0.5">Phase 3 · Nareen</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Phase badge */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0.8 }} animate={{ opacity: 1, scaleX: 1 }} exit={{ opacity: 0, scaleX: 0.8 }}
              className="px-4 pt-3"
            >
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-3 py-1 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping-slow" />
                <span className="text-[10px] font-bold text-blue-400 tracking-wider uppercase">Phase 3 Active</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav */}
        <nav className="flex-1 px-2 pt-4 pb-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {!collapsed && (
            <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-[0.12em] px-3 pb-2">
              Navigation
            </div>
          )}
          {NAV.map(({ to, icon: Icon, label, tag }, i) => (
            <motion.div key={to} custom={i} variants={navItem} initial="hidden" animate="visible">
              <NavLink
                to={to}
                title={collapsed ? label : undefined}
                className={({ isActive }) => cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group border',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 border-blue-500/20 shadow-glow-blue-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border-transparent',
                )}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-blue-400 rounded-full shadow-glow-blue-sm"
                      />
                    )}
                    <Icon className={cn('w-[17px] h-[17px] flex-shrink-0', isActive ? 'text-blue-400' : '')} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.14 }} className="whitespace-nowrap"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {tag && !collapsed && (
                      <span className="ml-auto text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full tracking-wide">
                        {tag}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 p-2 space-y-0.5">
          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={toggle}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all border border-transparent',
              collapsed && 'justify-center',
            )}
          >
            {isDark
              ? <Sun className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              : <Moon className="w-4 h-4 text-blue-400 flex-shrink-0" />
            }
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Status */}
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-[11px] text-slate-500">Online · Port 4000</span>
            </div>
          )}

          {/* Collapse */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[11px] text-slate-600 hover:text-slate-300 hover:bg-white/[0.04] transition-all',
              collapsed && 'justify-center',
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>Collapse sidebar</span>}
          </motion.button>
        </div>
      </motion.aside>

      {/* ── Main ──────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
