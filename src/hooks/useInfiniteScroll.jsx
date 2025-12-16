import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for infinite scroll using Intersection Observer
 * 
 * @param {Function} callback - Function to call when user scrolls to bottom
 * @param {boolean} hasMore - Whether there are more items to load
 * @param {boolean} loading - Whether currently loading
 * @returns {React.RefObject} - Ref to attach to sentinel element at bottom
 */
export const useInfiniteScroll = (callback, hasMore, loading) => {
    const observerRef = useRef(null);
    const sentinelRef = useRef(null);

    const handleObserver = useCallback((entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loading) {
            console.log('[useInfiniteScroll] Sentinel intersecting - loading more');
            callback();
        }
    }, [callback, hasMore, loading]);

    useEffect(() => {
        const options = {
            root: null, // viewport
            rootMargin: '200px', // Start loading 200px before reaching bottom
            threshold: 0.1,
        };

        observerRef.current = new IntersectionObserver(handleObserver, options);

        if (sentinelRef.current) {
            observerRef.current.observe(sentinelRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [handleObserver]);

    return sentinelRef;
};

export default useInfiniteScroll;
