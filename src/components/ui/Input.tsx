import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        'flex h-10 w-full rounded-xl border border-border-default bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
                        'focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/50',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        'transition-all duration-200',
                        error && 'border-red-500/50 focus:ring-red-500/40 focus:border-red-500/50',
                        className
                    )}
                    {...props}
                />
                {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';
