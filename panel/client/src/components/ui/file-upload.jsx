import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileArchive, X } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const mainVariant = {
  initial: { x: 0, y: 0 },
  animate: { x: 20, y: -20, opacity: 0.9 },
};

const secondaryVariant = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
};

/**
 * Aceternity-style file upload.
 * - Animated dot-grid background
 * - Drag-and-drop OR click to browse
 * - Tilt + lift animation when a file is hovered over the zone
 * - Selected file appears as a sleek floating card
 */
export function FileUpload({
  onChange,
  accept   = '*',
  file     = null,
  onClear,
  className,
}) {
  const inputRef = useRef(null);
  const [hovering, setHovering] = useState(false);

  const handleFiles = (f) => { if (f) onChange?.(f); };

  return (
    <div className={cn('w-full', className)}>
      <motion.div
        onClick={() => !file && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setHovering(true); }}
        onDragLeave={() => setHovering(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHovering(false);
          handleFiles(e.dataTransfer.files?.[0]);
        }}
        whileHover={file ? {} : 'animate'}
        className={cn(
          'relative group/upload p-10 rounded-2xl cursor-pointer overflow-hidden transition-all duration-300',
          'border border-dashed',
          hovering
            ? 'border-cyan-400/70 bg-cyan-500/[0.08]'
            : file
              ? 'border-emerald-500/40 bg-emerald-500/[0.04] cursor-default'
              : 'border-slate-400/20 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:border-blue-500/40',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files?.[0])}
        />

        {/* Animated grid background */}
        <GridPattern active={hovering || !!file} />

        <div className="relative flex flex-col items-center justify-center gap-4 z-10">
          <p className={cn(
            'font-bold text-base',
            file ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-100',
          )}>
            {file ? 'Ready to upload' : hovering ? 'Drop your build here' : 'Upload Unity build'}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
            {file
              ? 'Click upload to extract this archive into the builds directory'
              : <>Drag and drop your build archive, or <span className="text-blue-500 dark:text-blue-400 font-semibold">click to browse</span></>
            }
          </p>

          <div className="relative w-full mt-4 max-w-xl mx-auto">
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="relative overflow-hidden flex items-center gap-3 z-30 bg-white dark:bg-[#0a1120] flex-row rounded-xl px-4 py-3 mx-auto w-full max-w-md shadow-[0_4px_24px_rgba(59,130,246,0.18)] border border-cyan-500/30"
                >
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                    <FileArchive className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <motion.p
                      layout
                      className="text-sm font-semibold text-slate-900 dark:text-white truncate"
                    >
                      {file.name}
                    </motion.p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <span className="text-[11px] font-mono text-blue-500 dark:text-cyan-400/80">
                        {(file.type || file.name.split('.').slice(-2).join('.')).slice(0, 30) || 'archive'}
                      </span>
                    </div>
                  </div>
                  {onClear && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.94 }}
                      onClick={(e) => { e.stopPropagation(); onClear(); }}
                      className="flex-shrink-0 w-7 h-7 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-all"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="cta"
                  layoutId="file-upload-cta"
                  variants={mainVariant}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={cn(
                    'relative group-hover/upload:shadow-xl z-40 bg-white dark:bg-[#0a1120] flex items-center justify-center h-20 mt-4 w-full max-w-[8rem] mx-auto rounded-md',
                    'shadow-[0_0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.05)]',
                    'dark:shadow-[0_0_1px_3px_rgba(255,255,255,0.04)]',
                  )}
                >
                  {hovering ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-slate-500 dark:text-slate-400 flex flex-col items-center gap-1"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider">Drop</span>
                      <UploadCloud className="w-5 h-5" />
                    </motion.p>
                  ) : (
                    <UploadCloud className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                  )}
                </motion.div>
              )}

              {!file && (
                <motion.div
                  key="cta-shadow"
                  variants={secondaryVariant}
                  className="absolute opacity-0 border border-dashed border-cyan-400/60 inset-0 z-30 bg-transparent flex items-center justify-center h-20 mt-4 w-full max-w-[8rem] mx-auto rounded-md"
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function GridPattern({ active }) {
  const columns = 41;
  const rows    = 11;
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-shrink-0 flex-wrap justify-center items-center gap-x-px gap-y-px scale-105">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return (
            <div
              key={`${col}-${row}`}
              className={cn(
                'w-10 h-10 flex shrink-0 rounded-[2px]',
                active
                  ? (index % 2 === 0
                      ? 'bg-cyan-400/[0.04] dark:bg-cyan-400/[0.06]'
                      : 'bg-blue-500/[0.04] dark:bg-blue-500/[0.06] shadow-[0_0_1px_3px_rgba(6,182,212,0.05)_inset]')
                  : (index % 2 === 0
                      ? 'bg-slate-200/30 dark:bg-white/[0.015]'
                      : 'bg-slate-100/40 dark:bg-white/[0.025] shadow-[0_0_1px_3px_rgba(255,255,255,0.04)_inset]'),
              )}
            />
          );
        }),
      )}
    </div>
  );
}
