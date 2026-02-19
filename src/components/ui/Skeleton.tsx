import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
    <div
        className={cn(
            'rounded-xl bg-white/[0.03] animate-shimmer',
            className
        )}
    />
);

export const SkeletonCard: React.FC = () => (
    <div className="rounded-2xl glass p-6 space-y-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-20 w-full" />
    </div>
);

export const SkeletonRow: React.FC = () => (
    <div className="flex items-center gap-3 p-4">
        <Skeleton className="w-9 h-9 rounded-full" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/4" />
        </div>
    </div>
);
