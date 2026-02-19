import React from 'react';
import { cn } from '../../lib/utils';

interface AvatarProps {
    src?: string | null;
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const gradients = [
    'from-indigo-500 to-purple-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-violet-500 to-fuchsia-500',
];

function getGradient(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
}

function getInitials(name: string): string {
    return name
        .split(' ')
        .map(w => w.charAt(0))
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className }) => {
    const sizes: Record<string, string> = {
        xs: 'w-5 h-5 text-[10px]',
        sm: 'w-7 h-7 text-xs',
        md: 'w-9 h-9 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-20 h-20 text-2xl',
    };

    if (src) {
        return (
            <img
                src={src}
                alt={name}
                className={cn(
                    'rounded-full object-cover shrink-0 bg-secondary',
                    sizes[size],
                    className
                )}
            />
        );
    }

    return (
        <div
            className={cn(
                'rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shrink-0',
                getGradient(name),
                sizes[size],
                className
            )}
            title={name}
        >
            {getInitials(name)}
        </div>
    );
};
