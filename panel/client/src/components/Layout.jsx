import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Zap, Boxes, Server, Terminal,
  HeartPulse, Activity, UploadCloud, Users, LogOut,
  Sun, Moon, ChevronLeft, ChevronRight, Settings2,
} from 'lucide-react';
import { useTheme }  from '../contexts/ThemeContext.jsx';
import { useAuth }   from '../contexts/AuthContext.jsx';
import { Avatar }    from './ui/avatar.jsx';
import { Badge }     from './ui/badge.jsx';
import { cn } from '../lib/utils.js';

const NAV_GROUPS = [
  {
    label: 'Main',
    items: [
      { to: '/overview',    icon: LayoutDashboard, label: 'Overview'      },
      { to: '/hostmanager', icon: Zap,             label: 'Host Manager', tag: 'CORE' },
      { to: '/rooms',       icon: Boxes,           label: 'Rooms'         },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { to: '/services', icon: Server,    label: 'Services'   },
      { to: '/logs',     icon: Terminal,  label: 'Live Logs'  },
      { to: '/health',   icon: HeartPulse, label: 'Health'    },
      { to: '/events',   icon: Activity,  label: 'Events'     },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/builds', icon: UploadCloud, label: 'Build Upload' },
    ],
    adminItems: [
      { to: '/users', icon: Users, label: 'Users', tag: 'ADMIN' },
    ],
  },
];

const itemVariant = {
  hidden:  { opacity: 0, x: -14 },
  visible: (i) => ({ opacity: 1, x: 0, transition: { delay: i * 0.04, duration: 0.24, ease: 'easeOut' } }),
};

function NavItem({ to, icon: Icon, label, tag, idx, collapsed }) {
  return (
    <motion.div custom={idx} variants={itemVariant} initial="hidden" animate="visible">
      <NavLink
        to={to}
        title={collapsed ? label : undefined}
        className={({ isActive }) => cn(
          'relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 group border',
          collapsed && 'justify-center px-0 py-2.5',
          isActive
            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border-transparent',
        )}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.span
                layoutId="nav-pill"
                className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-400 rounded-full shadow-[0_0_8px_#60a5fa66]"
              />
            )}
            <Icon className={cn('w-[16px] h-[16px] flex-shrink-0 transition-colors', isActive ? 'text-blue-400' : 'group-hover:text-white')} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.16 }} className="whitespace-nowrap overflow-hidden"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
            {tag && !collapsed && (
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="ml-auto text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-full tracking-wide"
              >
                {tag}
              </motion.span>
            )}
          </>
        )}
      </NavLink>
    </motion.div>
  );
}

export default function Layout({ children }) {
  const { isDark, toggle } = useTheme();
  const { user, logout }   = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  let globalIdx = 0;

  const isAdmin = user?.role === 'admin';

  return (
    <div className={cn(
      'flex h-screen overflow-hidden font-sans',
      isDark ? 'bg-black text-white' : 'bg-slate-100 text-slate-900',
    )}>

      {/* Background layers */}
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-dot-grid opacity-100" />
          <div className="absolute inset-0 bg-blue-radial" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/5 blur-[100px] rounded-full" />
        </div>
      )}

      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 60 : 240 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className={cn(
          'relative z-20 flex flex-col flex-shrink-0 overflow-hidden',
          isDark
            ? 'bg-[#04080f] border-r border-white/[0.06]'
            : 'bg-slate-900 border-r border-slate-700',
        )}
      >
        {isDark && (
          <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
        )}

        {/* Brand header */}
        <div className="relative flex items-center gap-3 px-3 py-4 border-b border-white/[0.06] min-h-[60px]">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            whileTap={{ scale: 0.94 }}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_#3b82f633] cursor-pointer"
          >
            <Zap className="w-4 h-4 text-white" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.16 }} className="overflow-hidden"
              >
                <div className="text-[13px] font-bold text-white leading-tight whitespace-nowrap">CXR_Backend Panel</div>
                <div className="text-[10px] text-blue-400/60 leading-tight mt-0.5 whitespace-nowrap">Ops · Phase 3</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle in header */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setCollapsed(c => !c)}
            className={cn(
              'flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] transition-all',
              collapsed ? 'mx-auto' : 'ml-auto',
            )}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </motion.button>
        </div>

        {/* Phase badge */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="px-3 pt-3 overflow-hidden"
            >
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1.5 w-fit">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-blue-400/80 tracking-wider uppercase">Phase 3 · Live</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav groups */}
        <nav className="flex-1 px-2 pt-3 pb-2 overflow-y-auto overflow-x-hidden space-y-4">
          {NAV_GROUPS.map(group => {
            const items = [
              ...group.items,
              ...(isAdmin && group.adminItems ? group.adminItems : []),
            ];
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-[9.5px] font-bold text-slate-600 uppercase tracking-[0.13em] px-3 pb-1.5"
                    >
                      {group.label}
                    </motion.div>
                  )}
                </AnimatePresence>
                {collapsed && <div className="my-1 mx-3 h-px bg-white/[0.06]" />}
                <div className="space-y-0.5">
                  {items.map(item => (
                    <NavItem key={item.to} {...item} idx={globalIdx++} collapsed={collapsed} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/[0.06] p-2 space-y-1">

          {/* User card */}
          {user && !collapsed && (
            <div className="rounded-lg border border-white/[0.07] bg-white/[0.025] overflow-hidden mb-1">
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-2.5">
                <Avatar fallback={user.username[0]} badge={true} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-semibold text-white truncate">{user.username}</div>
                  <Badge
                    variant={user.role === 'admin' ? 'default' : user.role === 'operator' ? 'success' : 'warning'}
                    className="mt-0.5 text-[9px] px-1.5 py-0"
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={logout}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[11px] font-semibold text-red-400 hover:bg-red-500/10 border-t border-white/[0.05] transition-all"
              >
                <LogOut className="w-3 h-3" /> Sign out
              </motion.button>
            </div>
          )}

          {/* Collapsed: logout icon only */}
          {user && collapsed && (
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.93 }}
              onClick={logout}
              title={`Sign out (${user.username})`}
              className="w-full flex items-center justify-center py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
            </motion.button>
          )}

          {/* Theme toggle */}
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={toggle}
            title={isDark ? 'Light Mode' : 'Dark Mode'}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-all',
              collapsed && 'justify-center px-0',
            )}
          >
            {isDark
              ? <Sun  className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              : <Moon className="w-3.5 h-3.5 text-blue-400  flex-shrink-0" />
            }
            <AnimatePresence>
              {!collapsed && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                  {isDark ? 'Light Mode' : 'Dark Mode'}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
