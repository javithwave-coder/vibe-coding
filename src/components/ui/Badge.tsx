import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger';
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = 'default', ...props }) => {
    const variants: Record<string, string> = {
        default: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
        secondary: 'bg-white/5 text-text-secondary border-border-default',
        outline: 'bg-transparent text-text-secondary border-border-default',
        success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
        danger: 'bg-red-500/15 text-red-400 border-red-500/20',
    };

    return (
        <div
            className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                variants[variant],
                className
            )}
            {...props}
        />
    );
};
