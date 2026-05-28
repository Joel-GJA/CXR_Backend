import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { UploadCloud } from 'lucide-react';
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
 * Aceternity-style file upload — multi-file with animated stacked cards.
 * Pass onChange(files) — receives an array of File objects.
 *
 * `multiple` (default true) — if false, each selection REPLACES the previous file.
 * `resetKey` — change this prop to force-clear the internal file list (e.g. after
 *   a successful upload, parent increments resetKey to wipe stale file cards).
 */
export function FileUpload({ onChange, accept = '*', multiple = true, resetKey, className }) {
  const [files, setFiles] = useState([]);
  const [hovering, setHovering] = useState(false);
  const inputRef = useRef(null);

  // Wipe internal state when parent signals reset
  React.useEffect(() => { setFiles([]); }, [resetKey]);

  const handleFileChange = (newFiles) => {
    const next = multiple ? [...files, ...newFiles] : newFiles.slice(-1);
    setFiles(next);
    onChange?.(next);
  };

  const handleClick = () => inputRef.current?.click();

  return (
    <div className={cn('w-full', className)}>
      <motion.div
        onClick={handleClick}
        whileHover="animate"
        onDragOver={(e) => { e.preventDefault(); setHovering(true); }}
        onDragLeave={() => setHovering(false)}
        onDrop={(e) => {
          e.preventDefault();
          setHovering(false);
          handleFileChange(Array.from(e.dataTransfer.files || []));
        }}
        className="p-10 group/file block rounded-lg cursor-pointer w-full relative overflow-hidden"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          onChange={(e) => handleFileChange(Array.from(e.target.files || []))}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center relative z-10">
          <p className="font-bold text-slate-700 dark:text-slate-200 text-base">
            Upload build
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
            Drag and drop your archive here, or click to browse
          </p>

          <div className="relative w-full mt-10 max-w-xl mx-auto">
            {/* Selected file cards stack */}
            {files.length > 0 &&
              files.map((file, idx) => (
                <motion.div
                  key={'file' + idx}
                  layoutId={idx === 0 ? 'file-upload' : 'file-upload-' + idx}
                  className={cn(
                    'relative overflow-hidden z-40 bg-white dark:bg-neutral-900 flex flex-col items-start justify-start md:h-24 p-4 mt-4 w-full mx-auto rounded-md',
                    'shadow-[0_0_1px_3px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.05)]',
                    'dark:shadow-[0_0_1px_3px_rgba(6,182,212,0.15)]',
                  )}
                >
                  <div className="flex justify-between w-full items-center gap-4">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="text-base text-slate-700 dark:text-slate-100 truncate max-w-xs font-semibold"
                    >
                      {file.name}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="rounded-lg px-2 py-1 w-fit flex-shrink-0 text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] shadow-input"
                    >
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </motion.p>
                  </div>

                  <div className="flex text-sm md:flex-row flex-col items-start md:items-center w-full mt-2 justify-between text-slate-500 dark:text-slate-400">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="px-1 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.04] font-mono text-xs"
                    >
                      {file.type || file.name.split('.').slice(-2).join('.')}
                    </motion.p>

                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      layout
                      className="text-xs"
                    >
                      modified {new Date(file.lastModified).toLocaleDateString()}
                    </motion.p>
                  </div>
                </motion.div>
              ))}

            {/* Centered upload tile */}
            {!files.length && (
              <motion.div
                layoutId="file-upload"
                variants={mainVariant}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={cn(
                  'relative group-hover/file:shadow-2xl z-40 bg-white dark:bg-neutral-900 flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md',
                  'shadow-[0_0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.05)]',
                  'dark:shadow-[0_0_1px_3px_rgba(255,255,255,0.04)]',
                )}
              >
                {hovering ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-slate-600 dark:text-slate-300 flex flex-col items-center gap-1"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider">Drop</span>
                    <UploadCloud className="w-5 h-5 text-cyan-500" />
                  </motion.p>
                ) : (
                  <UploadCloud className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                )}
              </motion.div>
            )}

            {!files.length && (
              <motion.div
                variants={secondaryVariant}
                className="absolute opacity-0 border border-dashed border-cyan-400/60 inset-0 z-30 bg-transparent flex items-center justify-center h-32 mt-4 w-full max-w-[8rem] mx-auto rounded-md"
              />
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

