import React from 'react';
import * as RadixAlertDialog from '@radix-ui/react-alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils.js';

export function AlertDialog({ children, open, onOpenChange }) {
  return (
    <RadixAlertDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RadixAlertDialog.Root>
  );
}

export const AlertDialogTrigger = RadixAlertDialog.Trigger;

export function AlertDialogContent({ children, size = 'default', className }) {
  return (
    <RadixAlertDialog.Portal>
      <RadixAlertDialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-up" />
      <RadixAlertDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'glass rounded-2xl shadow-2xl outline-none',
          'data-[state=open]:animate-fade-up',
          size === 'sm' ? 'w-full max-w-sm p-5' : 'w-full max-w-md p-6',
          className,
        )}
      >
        {children}
      </RadixAlertDialog.Content>
    </RadixAlertDialog.Portal>
  );
}

export function AlertDialogHeader({ children, className }) {
  return <div className={cn('mb-5', className)}>{children}</div>;
}

export function AlertDialogMedia({ children, className }) {
  return (
    <div className={cn('flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-white/5 border border-white/10', className)}>
      {children}
    </div>
  );
}

export function AlertDialogTitle({ children, className }) {
  return (
    <RadixAlertDialog.Title className={cn('text-base font-semibold text-white leading-tight', className)}>
      {children}
    </RadixAlertDialog.Title>
  );
}

export function AlertDialogDescription({ children, className }) {
  return (
    <RadixAlertDialog.Description className={cn('text-sm text-slate-400 mt-1.5 leading-relaxed', className)}>
      {children}
    </RadixAlertDialog.Description>
  );
}

export function AlertDialogFooter({ children, className }) {
  return <div className={cn('flex items-center justify-end gap-2 mt-6', className)}>{children}</div>;
}

export function AlertDialogCancel({ children, className, ...props }) {
  return (
    <RadixAlertDialog.Cancel asChild>
      <button
        className={cn('px-4 py-2 rounded-lg text-sm font-medium border bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all', className)}
        {...props}
      >
        {children}
      </button>
    </RadixAlertDialog.Cancel>
  );
}

export function AlertDialogAction({ children, className, variant = 'default', ...props }) {
  const variants = {
    default:     'bg-blue-500 hover:bg-blue-400 text-white shadow-glow-blue-sm',
    destructive: 'bg-red-500/90 hover:bg-red-500 text-white border border-red-500/50',
    success:     'bg-emerald-500/90 hover:bg-emerald-500 text-white',
  };
  return (
    <RadixAlertDialog.Action asChild>
      <button
        className={cn('px-4 py-2 rounded-lg text-sm font-semibold transition-all', variants[variant] || variants.default, className)}
        {...props}
      >
        {children}
      </button>
    </RadixAlertDialog.Action>
  );
}
