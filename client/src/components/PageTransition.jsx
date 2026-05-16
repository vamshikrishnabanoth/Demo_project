import { motion } from 'framer-motion';

/**
 * Page transition variants — production grade.
 *
 * Philosophy:
 *  - Exit is FAST (120ms) — old page leaves quickly, never blocks the new one
 *  - Enter is SMOOTH (280ms) — new content reveals with natural easing
 *  - Y movement is subtle (10px) — enough to feel directional, never distracting
 *  - Scale is micro (0.995) — adds depth without being obvious
 *  - GPU-only properties: opacity, transform (never layout-triggering properties)
 */

// Standard transition — used for most page navigations
const standardVariants = {
    initial: {
        opacity: 0,
        y: 10,
        scale: 0.995,
        filter: 'blur(4px)',
    },
    enter: {
        opacity: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        transition: {
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1], // Custom spring-like ease
            opacity:  { duration: 0.2 },
            filter:   { duration: 0.2 },
        },
    },
    exit: {
        opacity: 0,
        y: -6,
        scale: 1.005,
        filter: 'blur(2px)',
        transition: {
            duration: 0.12,
            ease: [0.4, 0, 1, 1], // Fast accelerating ease for exit
        },
    },
};

// Fade-only — for heavy pages (live room, quiz attempt) where transform might shift layout
const fadeVariants = {
    initial: { opacity: 0 },
    enter:   { opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } },
    exit:    { opacity: 0, transition: { duration: 0.12, ease: 'easeIn'  } },
};

// Slide-up — for modal-like pages (leaderboard, results)
const slideUpVariants = {
    initial: { opacity: 0, y: 20 },
    enter:   { opacity: 1, y: 0,  transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, y: -10, transition: { duration: 0.15, ease: [0.4, 0, 1, 1]    } },
};

/**
 * PageTransition
 * Wraps a page with the standard transition. GPU-accelerated.
 */
export const PageTransition = ({ children }) => (
    <motion.div
        variants={standardVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{
            willChange: 'opacity, transform',
            // Prevent layout shifts during transition
            position: 'relative',
            width: '100%',
        }}
    >
        {children}
    </motion.div>
);

/**
 * FadeTransition
 * For heavy/complex pages — just fades, no transform.
 */
export const FadeTransition = ({ children }) => (
    <motion.div
        variants={fadeVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{ willChange: 'opacity', width: '100%' }}
    >
        {children}
    </motion.div>
);

/**
 * SlideUpTransition
 * For destination pages like Leaderboard that feel like arrivals.
 */
export const SlideUpTransition = ({ children }) => (
    <motion.div
        variants={slideUpVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{ willChange: 'opacity, transform', width: '100%' }}
    >
        {children}
    </motion.div>
);

export default PageTransition;
