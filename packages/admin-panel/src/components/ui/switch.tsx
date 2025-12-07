'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only peer"
          {...props}
        />
        <div
          className={cn(
            'w-11 h-6 rounded-full transition-colors duration-150',
            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
            'peer-checked:bg-[var(--accent-primary)] peer-checked:border-[var(--accent-primary)]',
            'peer-focus:ring-2 peer-focus:ring-[var(--accent-primary)] peer-focus:ring-offset-2 peer-focus:ring-offset-[var(--bg-primary)]',
            'peer-disabled:opacity-50 peer-disabled:cursor-not-allowed',
            className
          )}
        >
          <div
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-150',
              'bg-[var(--text-primary)]',
              'peer-checked:translate-x-5'
            )}
          />
        </div>
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
