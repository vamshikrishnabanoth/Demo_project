import { motion } from 'framer-motion';

/**
 * PageLoader — reusable full-page loading skeleton.
 * Use this instead of "Loading..." or a spinning icon.
 * 
 * Matches dashboard layout dimensions to prevent layout shift.
 */

const Shimmer = ({ className = '' }) => (
    <div
        className={`rounded-2xl ${className}`}
        style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
            backgroundSize: '400% 100%',
            animation: 'shimmer 1.5s linear infinite',
        }}
    />
);

/**
 * ContentSkeleton — shows shimmer cards that match page content
 * rows: number of content rows to show
 */
export const ContentSkeleton = ({ rows = 3 }) => (
    <div className="space-y-6" role="status" aria-label="Loading content">
        <span className="sr-only">Loading...</span>
        {/* Page title shimmer */}
        <div className="space-y-3">
            <Shimmer className="h-12 w-64" />
            <Shimmer className="h-4 w-40" />
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Shimmer key={i} className="h-28 rounded-[2rem]" />)}
        </div>
        {/* Content rows */}
        <div className="space-y-4">
            {Array.from({ length: rows }).map((_, i) => (
                <Shimmer key={i} className="h-24 rounded-2xl" style={{ opacity: 1 - i * 0.15 }} />
            ))}
        </div>
    </div>
);

/**
 * InlineLoader — small spinner for buttons and inline states
 */
export const InlineLoader = ({ size = 20, className = '' }) => (
    <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        className={`w-5 h-5 border-2 border-current border-t-transparent rounded-full ${className}`}
        style={{ width: size, height: size }}
        role="status"
        aria-label="Loading"
    />
);

/**
 * PageLoader — full-screen minimal loader for Suspense boundaries
 */
export const PageLoader = () => (
    <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
        role="status"
        aria-label="Loading page"
    >
        <motion.div
            className="flex flex-col items-center gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            {/* Pulsing accent ring */}
            <div className="relative w-12 h-12">
                <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--bg-accent)', opacity: 0.3 }}
                />
                <div
                    className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--bg-accent)', borderTopColor: 'transparent' }}
                />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-white/30">
                Loading
            </p>
        </motion.div>
    </div>
);

export default ContentSkeleton;
