import { motion } from 'framer-motion';

const SkeletonStat = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {[0, 1, 2].map(i => (
                <div key={i} className="glass-panel p-10 rounded-[3rem] border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-8 relative z-10">
                        {/* Icon Skeleton */}
                        <div className="w-20 h-20 rounded-[1.5rem] bg-white/5 shimmer-block" />
                        
                        <div className="space-y-4 flex-1">
                            {/* Label Skeleton */}
                            <div className="h-2 w-24 bg-white/5 rounded-full shimmer-block" />
                            {/* Value Skeleton */}
                            <div className="h-10 w-32 bg-white/10 rounded-xl shimmer-block" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonStat;
