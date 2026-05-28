import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { cn } from '../../lib/utils.js';

export function Checkbox({ checked, indeterminate, onChange, disabled, label, description, className }) {
  const state = indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked';
  return (
    <label className={cn('flex items-start gap-3 cursor-pointer group', disabled && 'opacity-50 cursor-not-allowed', className)}>
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={!!checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
        />
        <motion.div
          whileTap={{ scale: 0.9 }}
          className={cn(
            'w-4 h-4 rounded flex items-center justify-center border transition-all duration-150',
            state !== 'unchecked'
              ? 'bg-blue-500 border-blue-500 shadow-glow-blue-sm'
              : 'bg-white/[0.04] border-white/20 group-hover:border-blue-500/50',
          )}
        >
          <AnimatePresence mode="wait">
            {state === 'checked' && (
              <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.12 }}>
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </motion.span>
            )}
            {state === 'indeterminate' && (
              <motion.span key="minus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.12 }}>
                <Minus className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      {(label || description) && (
        <div className="min-w-0">
          {label && <div className="text-sm text-white leading-tight">{label}</div>}
          {description && <div className="text-xs text-slate-500 mt-0.5">{description}</div>}
        </div>
      )}
    </label>
  );
}
