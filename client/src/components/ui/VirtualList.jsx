import React, { useState, useRef, useEffect } from 'react';

/**
 * Lightweight VirtualList component.
 * Renders only the visible window slice of long lists (500+ items)
 * to keep DOM node count low and prevent browser render lag.
 */
export default function VirtualList({
    items = [],
    itemHeight = 80,
    containerHeight = 400,
    renderItem,
    className = '',
    overscan = 5
}) {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);

    const handleScroll = (e) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className={`overflow-y-auto relative ${className}`}
            style={{ height: containerHeight }}
        >
            <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
                <div style={{ transform: `translateY(${offsetY}px)`, width: '100%' }}>
                    {visibleItems.map((item, index) => renderItem(item, startIndex + index))}
                </div>
            </div>
        </div>
    );
}
