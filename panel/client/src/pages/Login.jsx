import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Meteors }      from '../components/ui/meteors.jsx';
import { MorphingText } from '../components/ui/morphing-text.jsx';
import { SparklesCore } from '../components/ui/sparkles.jsx';
import { cn } from '../lib/utils.js';

const ROLE_COLORS = { admin: 'text-blue-400', operator: 'text-emerald-400', viewer: 'text-yellow-400' };

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-dot-grid bg-dot-grid opacity-100" />
      <div className="absolute inset-0 bg-blue-radial" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/8 blur-[120px] rounded-full" />

      {/* Meteor shower */}
      <Meteors number={22} minDuration={3} maxDuration={9} className="bg-cyan-300 shadow-[0_0_0_1px_#06b6d420]" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="relative"
          >
            {/* Glow effect behind banner */}
            <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-2xl scale-110 pointer-events-none" />
            <motion.img
              src="/cxr-banner.png"
              alt="CXR"
              animate={{ filter: ['drop-shadow(0 0 8px rgba(6,182,212,0.4))', 'drop-shadow(0 0 20px rgba(6,182,212,0.7))', 'drop-shadow(0 0 8px rgba(6,182,212,0.4))'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-72 rounded-2xl object-contain"
            />
          </motion.div>
          <div className="text-center w-full">
            <MorphingText
              texts={['Backend Panel', 'Operations Hub', 'XR Multiplayer', 'Real-time Ops']}
              className="h-10 text-[22px] text-cyan-300/90 tracking-wide"
            />
          </div>

          {/* Sparkles strip with gradient lines */}
          <div className="w-full h-24 relative -mt-2">
            {/* Cyan/indigo gradient lines */}
            <div className="absolute inset-x-12 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 mx-auto blur-sm" />
            <div className="absolute inset-x-12 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4 mx-auto" />
            <div className="absolute inset-x-24 top-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent h-[5px] w-1/2 mx-auto blur-sm" />
            <div className="absolute inset-x-24 top-0 bg-gradient-to-r from-transparent via-cyan-400 to-transparent h-px w-1/2 mx-auto" />

            <SparklesCore
              background="transparent"
              minSize={0.4}
              maxSize={1}
              particleDensity={900}
              particleColor="#67e8f9"
              className="w-full h-full"
            />

            {/* Radial mask to soften edges */}
            <div className="absolute inset-0 w-full h-full bg-black [mask-image:radial-gradient(220px_120px_at_top,transparent_20%,white)]" />
          </div>
        </div>

        {/* Card */}
        <div className="glass p-7">
          <h2 className="text-base font-semibold text-white mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Username</label>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-blue-500/5 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-glow-blue-sm mt-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <LogIn className="w-4 h-4" />
              }
              {loading ? 'Signing in…' : 'Sign in'}
            </motion.button>
          </form>

          <div className="mt-5 pt-5 border-t border-white/5">
            <p className="text-[11px] text-slate-600 text-center">
              Roles: <span className={ROLE_COLORS.admin}>admin</span> · <span className={ROLE_COLORS.operator}>operator</span> · <span className={ROLE_COLORS.viewer}>viewer</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
