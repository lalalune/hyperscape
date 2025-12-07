import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  size?: 'sm' | 'md';
}

function Badge({ className, variant = 'default', size = 'md', ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';
  
  const variants = {
    default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]',
    success: 'bg-[rgba(16,185,129,0.15)] text-[var(--color-success)] border border-[var(--color-success)]',
    warning: 'bg-[rgba(245,158,11,0.15)] text-[var(--color-warning)] border border-[var(--color-warning)]',
    error: 'bg-[rgba(239,68,68,0.15)] text-[var(--color-error)] border border-[var(--color-error)]',
    info: 'bg-[rgba(59,130,246,0.15)] text-[var(--color-info)] border border-[var(--color-info)]',
    outline: 'bg-transparent text-[var(--text-secondary)] border border-[var(--border-primary)]',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

export { Badge };
