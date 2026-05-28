import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, FolderOpen, Trash2, RefreshCw,
  CheckCircle2, AlertCircle, Package, HardDrive, X,
} from 'lucide-react';
import { buildsApi } from '../api/client.js';
import { FileUpload } from '../components/ui/file-upload.jsx';
import { cn } from '../lib/utils.js';

const page = {
  initial:  { opacity: 0, y: 10 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.25 } },
  exit:     { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0,  scale: 1     }}
            exit={{    opacity: 0, x: 60, scale: 0.92  }}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl pointer-events-auto cursor-pointer',
              t.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                : 'bg-red-500/10 border-red-500/25 text-red-400',
            )}
            onClick={() => remove(t.id)}
          >
            {t.type === 'success'
              ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle  className="w-4 h-4 flex-shrink-0" />
            }
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Build card ────────────────────────────────────────────────────────────────
function BuildCard({ build, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const handleDelete = async () => {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    await onDelete(build.name);
    setDeleting(false);
    setConfirming(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{    opacity: 0, scale: 0.95 }}
      className="glass p-5 flex items-start justify-between gap-4 group"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Package className="w-4 h-4 text-blue-400" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{build.name}</div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">{build.path}</div>
          {build.executable && (
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> {build.executable}
            </div>
          )}
          {!build.executable && (
            <div className="text-[11px] text-yellow-400 mt-1">No .x86_64 binary found yet</div>
          )}
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={handleDelete}
        disabled={deleting}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex-shrink-0',
          confirming
            ? 'bg-red-500/15 border-red-500/30 text-red-400'
            : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/20',
        )}
      >
        {deleting
          ? <RefreshCw className="w-3 h-3 animate-spin" />
          : <Trash2     className="w-3 h-3" />
        }
        {confirming ? 'Confirm?' : 'Delete'}
      </motion.button>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Builds() {
  const [builds,    setBuilds]    = useState([]);
  const [buildsDir, setBuildsDir] = useState('');
  const [file,      setFile]      = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [toasts,    setToasts]    = useState([]);
  const [resetKey,  setResetKey]  = useState(0);
  let toastId = useRef(0);

  const toast = (msg, type = 'success') => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id));

  const loadBuilds = useCallback(async () => {
    try {
      const data = await buildsApi.list();
      setBuilds(data.builds || []);
      setBuildsDir(data.buildsDir || '');
    } catch (e) {
      toast(e.message, 'error');
    }
  }, []);

  useEffect(() => { loadBuilds(); }, [loadBuilds]);

  const handleUpload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    setProgress(0);
    try {
      const result = await buildsApi.upload(file, setProgress);
      toast(result.message || 'Build uploaded successfully!');
      setFile(null);
      setProgress(0);
      setResetKey(k => k + 1);  // clear file cards inside FileUpload
      await loadBuilds();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (name) => {
    try {
      const result = await buildsApi.delete(name);
      toast(result.message || `Deleted "${name}"`);
      await loadBuilds();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const ACCEPTED = '.zip,.rar,.tar.gz,.tgz,.tar';

  return (
    <motion.div variants={page} initial="initial" animate="animate" exit="exit" className="p-8 max-w-5xl mx-auto">
      <Toast toasts={toasts} remove={removeToast} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <UploadCloud className="w-6 h-6 text-blue-400" /> Build Upload
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload a Unity Linux headless build archive — it will be extracted directly into the builds folder.
        </p>
        {buildsDir && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
            <FolderOpen className="w-3.5 h-3.5" /> {buildsDir}
          </div>
        )}
      </div>

      {/* Aceternity-style drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full mx-auto min-h-96 border border-dashed bg-white dark:bg-black border-slate-200 dark:border-neutral-800 rounded-lg mb-6"
      >
        <FileUpload
          accept={ACCEPTED}
          multiple={false}
          resetKey={resetKey}
          onChange={(files) => setFile(files[0] || null)}
        />
      </motion.div>
      <p className="text-[11px] text-center text-slate-500 -mt-3 mb-6">
        Supports <span className="text-blue-400">.zip · .rar · .tar.gz · .tar</span>
      </p>

      {/* Action row */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 mb-8"
          >
            {/* Progress bar */}
            {uploading && (
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            )}
            {uploading && (
              <span className="text-xs font-mono text-blue-400 w-10 text-right">{progress}%</span>
            )}

            {!uploading && (
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => { setFile(null); setResetKey(k => k + 1); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-glow-blue-sm"
            >
              {uploading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Extracting…</>
                : <><UploadCloud className="w-4 h-4" /> Upload & Extract</>
              }
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Builds list */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Package className="w-4 h-4 text-blue-400" />
          Registered Builds
          <span className="text-xs font-normal text-slate-500 ml-1">({builds.length})</span>
        </h2>
        <motion.button
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={loadBuilds}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border bg-white/[0.04] border-white/10 text-slate-400 hover:text-white transition-all"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </motion.button>
      </div>

      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {builds.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass p-10 flex flex-col items-center gap-3 text-center"
            >
              <Package className="w-10 h-10 text-slate-700" />
              <div className="text-sm text-slate-500">No builds yet.</div>
              <div className="text-xs text-slate-600">
                Upload a <span className="text-blue-400">.zip</span> or <span className="text-blue-400">.rar</span> of your Unity Linux headless build above.
              </div>
            </motion.div>
          ) : (
            builds.map(b => (
              <BuildCard key={b.name} build={b} onDelete={handleDelete} />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
