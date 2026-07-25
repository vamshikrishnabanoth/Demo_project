/**
 * High-performance throttle utility.
 * Prevents high-frequency socket events (e.g. 500 progress updates/sec)
 * from overwhelming the React render queue.
 */
export function throttle(func, wait = 300) {
    let timeout = null;
    let previous = 0;
    let lastArgs = null;

    const throttled = function (...args) {
        const now = Date.now();
        const remaining = wait - (now - previous);
        lastArgs = args;

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            func.apply(this, args);
            lastArgs = null;
        } else if (!timeout) {
            timeout = setTimeout(() => {
                previous = Date.now();
                timeout = null;
                if (lastArgs) {
                    func.apply(this, lastArgs);
                    lastArgs = null;
                }
            }, remaining);
        }
    };

    throttled.cancel = function () {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
        previous = 0;
        lastArgs = null;
    };

    return throttled;
}

export default throttle;
