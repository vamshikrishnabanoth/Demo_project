import React from 'react';
import { motion } from 'framer-motion';

export const ShimmerSkeleton = ({ className = '' }) => (
    <div className={`shimmer-block rounded-2xl ${className}`} />
);

export const CardSkeleton = () => (
    <div className="glass-panel rounded-[2rem] p-8 border border-white/5 space-y-6">
        <div className="flex items-center gap-5">
            <ShimmerSkeleton className="w-14 h-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
                <ShimmerSkeleton className="h-6 w-3/4" />
                <ShimmerSkeleton className="h-4 w-1/2" />
            </div>
            <ShimmerSkeleton className="w-32 h-10 rounded-xl" />
        </div>
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5">
            <ShimmerSkeleton className="h-4" />
            <ShimmerSkeleton className="h-4" />
            <ShimmerSkeleton className="h-4" />
        </div>
    </div>
);

export const ListSkeleton = ({ count = 3 }) => (
    <div className="space-y-6">
        {[...Array(count)].map((_, i) => (
            <CardSkeleton key={i} />
        ))}
    </div>
);
