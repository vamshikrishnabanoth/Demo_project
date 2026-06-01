import { lazy, Suspense } from 'react';
import NavigationSkeleton from '../components/NavigationSkeleton';

/**
 * lazyWithSuspense
 * Resolves Framer Motion + React Suspense unmount conflicts by containing
 * the Suspense boundary locally around each page, while adding auto-recovery
 * retry logic for ChunkLoadErrors / failed dynamic imports.
 */
export const lazyWithSuspense = (componentImport, fallback = <NavigationSkeleton />) => {
    const LazyComponent = lazy(async () => {
        try {
            return await componentImport();
        } catch (error) {
            console.error("🔥 [lazyWithSuspense] Dynamic import failed. Attempting auto-recovery...", error);
            
            // Generate a unique storage key based on the import function string
            const importStr = componentImport.toString();
            const lastRetryKey = `last-retry-${importStr.replace(/[^a-zA-Z0-9]/g, '')}`;
            const lastRetry = localStorage.getItem(lastRetryKey);
            const now = Date.now();
            
            // Check if we retried in the last 10 seconds to prevent infinite reload loops
            if (!lastRetry || now - parseInt(lastRetry) > 10000) {
                localStorage.setItem(lastRetryKey, now.toString());
                console.log("🔄 [lazyWithSuspense] Retrying dynamic import in 1.5 seconds...");
                await new Promise(resolve => setTimeout(resolve, 1500));
                try {
                    return await componentImport();
                } catch (retryError) {
                    console.error("🔥 [lazyWithSuspense] Dynamic import retry failed. Force reloading page to fetch fresh assets...", retryError);
                    window.location.reload();
                    return new Promise(() => {}); // Hold rendering while page reloads
                }
            } else {
                console.error("🔥 [lazyWithSuspense] Dynamic import failed repeatedly. Force reloading page...", error);
                window.location.reload();
                return new Promise(() => {}); // Hold rendering while page reloads
            }
        }
    });

    const SuspenseWrappedComponent = (props) => (
        <Suspense fallback={fallback}>
            <LazyComponent {...props} />
        </Suspense>
    );

    // Set displayName for easy debugging
    SuspenseWrappedComponent.displayName = `LazyWithSuspense(${componentImport.toString().slice(0, 40)}...)`;

    return SuspenseWrappedComponent;
};

export default lazyWithSuspense;
