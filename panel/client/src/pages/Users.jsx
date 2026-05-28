import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users as UsersIcon, UserPlus, Trash2, Shield, RefreshCw, CheckCircle2, AlertCircle, Key } from 'lucide-react';
import { auth } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Avatar } from '../components/ui/avatar.jsx';
import { Badge }  from '../components/ui/badge.jsx';
import { cn } from '../lib/utils.js';

const page = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.25 } }, exit: { opacity: 0, y: -8, transition: { duration: 0.15 } } };

const ROLES = ['admin', 'operator', 'viewer'];
const ROLE_COLORS = {
  admin:    'bg-blue-500/10 border-blue-500/25 text-blue-400',
  operator: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  viewer:   'bg-yellow-500/10 border-yellow-500/25 text-yellow-400',
};

function Toast({ toasts, remove }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div key={t.id}
            initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
            onClick={() => remove(t.id)}
            className={cn('flex items-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium shadow-xl pointer-events-auto cursor-pointer',
              t.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
            )}
          >
            {t.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const [users,       setUsers]       = useState([]);
  const [toasts,      setToasts]      = useState([]);
  const [showAdd,     setShowAdd]     = useState(false);
  const [newUser,     setNewUser]     = useState({ username: '', password: '', role: 'operator' });
  const [adding,      setAdding]      = useState(false);
  const [changePwFor, setChangePwFor] = useState(null);
  const [newPw,       setNewPw]       = useState('');
  let toastId = React.useRef(0);

  const toast = (msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  const load = useCallback(async () => {
    try { setUsers((await auth.listUsers()).users); }
    catch (e) { toast(e.message, 'error'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await auth.createUser(newUser);
      toast(`User "${newUser.username}" created`);
      setNewUser({ username: '', password: '', role: 'operator' });
      setShowAdd(false);
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally { setAdding(false); }
  };

  const handleDelete = async (username) => {
    try {
      await auth.deleteUser(username);
      toast(`User "${username}" deleted`);
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleRoleChange = async (username, role) => {
    try {
      await auth.updateRole(username, role);
      toast(`Role updated`);
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleChangePw = async (e) => {
    e.preventDefault();
    try {
      await auth.changePassword(changePwFor, newPw);
      toast(`Password updated for "${changePwFor}"`);
      setChangePwFor(null);
      setNewPw('');
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-4xl mx-auto">
      <Toast toasts={toasts} remove={id => setToasts(t => t.filter(x => x.id !== id))} />

      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <UsersIcon className="w-6 h-6 text-blue-400" /> User Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage panel users and their access roles</p>
        </div>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all shadow-glow-blue-sm"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add User
          </motion.button>
        </div>
      </div>

      {/* Add user form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="glass p-5 mb-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><UserPlus className="w-4 h-4 text-blue-400" /> New User</h3>
            <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input value={newUser.username} onChange={e => setNewUser(u => ({ ...u, username: e.target.value }))}
                placeholder="Username" required
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
              />
              <input type="password" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))}
                placeholder="Password" required
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
              />
              <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-all"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="sm:col-span-3 flex gap-2 justify-end">
                <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setShowAdd(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
                >Cancel</motion.button>
                <motion.button type="submit" whileTap={{ scale: 0.96 }} disabled={adding}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-50 transition-all"
                >{adding ? 'Creating…' : 'Create User'}</motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change password modal */}
      <AnimatePresence>
        {changePwFor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setChangePwFor(null)}
          >
            <motion.div initial={{ scale: 0.93, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.93, y: 20 }}
              className="glass p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" /> Change password for <span className="text-blue-400">{changePwFor}</span>
              </h3>
              <form onSubmit={handleChangePw} className="space-y-3">
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                  placeholder="New password" required autoFocus
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setChangePwFor(null)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
                  >Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-400 text-white transition-all"
                  >Update</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users table */}
      <div className="glass overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-white/5">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Users</span>
          <span className="text-xs text-slate-500 ml-1">({users.length})</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {users.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-600">No users found</div>
          )}
          {users.map(u => (
            <motion.div key={u.username} layout
              className="flex items-center justify-between gap-4 px-5 py-3.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar fallback={u.username[0]} badge={true} size="sm" />
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-2">
                    {u.username}
                    {u.username === me?.username && <Badge variant="outline">You</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-600">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ''}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Role selector */}
                <select
                  value={u.role}
                  disabled={u.username === me?.username}
                  onChange={e => handleRoleChange(u.username, e.target.value)}
                  className={cn('text-[11px] font-semibold border rounded-full px-3 py-1 cursor-pointer focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed', ROLE_COLORS[u.role])}
                  style={{ background: 'transparent' }}
                >
                  {ROLES.map(r => <option key={r} value={r} className="bg-[#040810] text-white">{r}</option>)}
                </select>

                {/* Change password */}
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => { setChangePwFor(u.username); setNewPw(''); }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  title="Change password"
                >
                  <Key className="w-3.5 h-3.5" />
                </motion.button>

                {/* Delete */}
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => handleDelete(u.username)}
                  disabled={u.username === me?.username}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Delete user"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Role descriptions */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        {[
          { role: 'admin',    desc: 'Full access — user management, all features'         },
          { role: 'operator', desc: 'Manage rooms, services, builds — no user management' },
          { role: 'viewer',   desc: 'Read-only access to all pages'                       },
        ].map(({ role, desc }) => (
          <div key={role} className={cn('glass p-4 border rounded-xl', ROLE_COLORS[role].replace('bg-', 'border-').split(' ')[0])}>
            <div className={cn('text-xs font-bold mb-1', ROLE_COLORS[role].split(' ').find(c => c.startsWith('text-')))}>{role}</div>
            <div className="text-[11px] text-slate-500">{desc}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
