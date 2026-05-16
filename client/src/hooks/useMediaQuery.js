/**
 * useMediaQuery — reactive media query hook.
 * 
 * Returns true when the query matches and updates on window resize.
 * This fixes the static window.innerWidth pattern used in CinematicBackground
 * and ParticleEngine which doesn't respond to viewport changes.
 * 
 * Usage:
 *   const isMobile = useMediaQuery('(max-width: 767px)');
 *   const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
import { useState, useEffect } from 'react';

export function useMediaQuery(query) {
    const [matches, setMatches] = useState(
        // Evaluate on first render (SSR-safe: check window exists)
        typeof window !== 'undefined'
            ? window.matchMedia(query).matches
            : false
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e) => setMatches(e.matches);

        // Use the modern addEventListner API (addEventListener) with fallback
        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
        } else {
            mql.addListener(handler); // Safari <14 fallback
        }

        // Sync state in case it changed between render and effect
        setMatches(mql.matches);

        return () => {
            if (mql.removeEventListener) {
                mql.removeEventListener('change', handler);
            } else {
                mql.removeListener(handler);
            }
        };
    }, [query]);

    return matches;
}

export default useMediaQuery;
