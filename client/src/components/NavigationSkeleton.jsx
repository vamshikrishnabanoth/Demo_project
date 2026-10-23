import { motion } from 'framer-motion';

/**
 * NavigationSkeleton
 * Shown by Suspense while a lazy page chunk is downloading.
 * Matches the real layout dimensions to prevent layout shift.
 * 
 * Has two layouts:
 *  - "dashboard" (default): navbar + content shimmer
 *  - "fullscreen": centered spinner (login, role selection)
 */

// Shimmer animation
const shimmer = {
    animate: {
        backgroundPosition: ['200% 0', '-200% 0'],
    },
    transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
    },
};

const ShimmerBlock = ({ className = '', style = {} }) => (
    <motion.div
        {...shimmer}
        className={`rounded-2xl ${className}`}
        style={{
            background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
            backgroundSize: '400% 100%',
            ...style,
        }}
    />
);

// Dashboard skeleton — navbar + content cards
const DashboardSkeleton = () => (
    <div
        className="min-h-screen flex flex-col bg-white"
    >
        {/* Navbar skeleton */}
        <div
            className="h-20 border-b border-slate-200 sticky top-0 z-50 flex items-center px-8 gap-8 bg-white/80 backdrop-blur-md"
        >
            {/* Logo */}
            <ShimmerBlock className="h-10 w-32" />
            {/* Nav links */}
            <div className="hidden md:flex gap-4">
                <ShimmerBlock className="h-9 w-20" />
                <ShimmerBlock className="h-9 w-24" />
            </div>
            {/* Right side */}
            <div className="ml-auto flex items-center gap-3">
                <ShimmerBlock className="h-7 w-14 rounded-full" />
                <ShimmerBlock className="h-9 w-9 rounded-2xl" />
                <ShimmerBlock className="h-9 w-9 rounded-2xl" />
            </div>
        </div>

        {/* Page content skeleton */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-10 space-y-8">
            {/* Page title */}
            <div className="space-y-3">
                <ShimmerBlock className="h-14 w-64" />
                <ShimmerBlock className="h-4 w-40" />
            </div>

            {/* Stat cards row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <ShimmerBlock key={i} className="h-32" style={{ borderRadius: '2rem' }} />
                ))}
            </div>

            {/* Main content block */}
            <ShimmerBlock className="h-64 w-full" style={{ borderRadius: '2.5rem' }} />
        </div>
    </div>
);

// Fullscreen skeleton — login / role selection
const FullscreenSkeleton = () => (
    <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
    >
        <motion.div
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            className="flex flex-col items-center gap-4"
        >
            {/* Logo shimmer */}
            <ShimmerBlock className="h-16 w-16 rounded-2xl" />
            <ShimmerBlock className="h-8 w-48" />
            <ShimmerBlock className="h-4 w-32" />
        </motion.div>
    </div>
);

/**
 * NavigationSkeleton
 * Picks the right skeleton based on the current pathname.
 */
const NavigationSkeleton = () => {
    const path = window.location.pathname;

    const isFullscreen = ['/login', '/select-role', '/'].some(p => path === p)
        || path.startsWith('/live-room')
        || path.startsWith('/quiz');

    return isFullscreen ? <FullscreenSkeleton /> : <DashboardSkeleton />;
};

export default NavigationSkeleton;
