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

const ShimmerBlock = ({ className = '' }) => (
    <motion.div
        {...shimmer}
        className={`rounded-2xl ${className}`}
        style={{
            background: 'linear-gradient(90deg, var(--glass-bg) 25%, rgba(255,255,255,0.06) 50%, var(--glass-bg) 75%)',
            backgroundSize: '400% 100%',
        }}
    />
);

// Dashboard skeleton — navbar + content cards
const DashboardSkeleton = () => (
    <div
        className="min-h-screen flex flex-col"
        style={{ background: 'var(--bg-primary)' }}
    >
        {/* Navbar skeleton */}
        <div
            className="h-16 sm:h-20 border-b sticky top-0 z-50 flex items-center px-3 sm:px-6 md:px-8 gap-4 justify-between"
            style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'var(--border-color)',
                backdropFilter: 'blur(20px)',
            }}
        >
            {/* Logo */}
            <div className="flex items-center gap-3">
                <ShimmerBlock className="h-8 sm:h-9 w-28 sm:w-36 rounded-xl" />
                {/* Nav links */}
                <div className="hidden lg:flex gap-2 ml-4">
                    <ShimmerBlock className="h-8 w-20 rounded-xl" />
                    <ShimmerBlock className="h-8 w-24 rounded-xl" />
                </div>
            </div>
            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-3">
                <ShimmerBlock className="h-6 sm:h-7 w-12 sm:w-16 rounded-full" />
                <ShimmerBlock className="h-8 w-8 sm:w-28 rounded-xl" />
                <ShimmerBlock className="h-8 w-8 sm:w-20 rounded-xl" />
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
