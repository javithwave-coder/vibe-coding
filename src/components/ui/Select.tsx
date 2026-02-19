import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
}

export const Select: React.FC<SelectProps> = ({
    className,
    label,
    error,
    options,
    placeholder,
    ...props
}) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    className={cn(
                        'flex h-10 w-full appearance-none rounded-xl border border-border-default bg-white/[0.03] px-3 py-2 pr-8 text-sm text-text-primary',
                        'focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/50',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                        'transition-all duration-200',
                        error && 'border-red-500/50',
                        className
                    )}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled className="bg-surface-elevated text-text-muted">
                            {placeholder}
                        </option>
                    )}
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value} className="bg-surface-elevated text-text-primary">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
            {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
        </div>
    );
};
