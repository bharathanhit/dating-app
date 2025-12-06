import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for lazy loading images
 * Uses Intersection Observer API to load images only when they're in viewport
 * 
 * @param {string} src - The image source URL
 * @param {string} placeholder - Optional placeholder image URL
 * @returns {object} - { imageSrc, isLoading, isInView }
 */
export const useLazyLoad = (src, placeholder = '') => {
    const [imageSrc, setImageSrc] = useState(placeholder);
    const [isLoading, setIsLoading] = useState(true);
    const [isInView, setIsInView] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        if (!src) {
            setIsLoading(false);
            return;
        }

        // Create intersection observer
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        // Load the image
                        const img = new Image();
                        img.src = src;
                        img.onload = () => {
                            setImageSrc(src);
                            setIsLoading(false);
                        };
                        img.onerror = () => {
                            setImageSrc(placeholder || 'https://via.placeholder.com/400x400?text=Error');
                            setIsLoading(false);
                        };
                        // Stop observing after loading
                        if (imgRef.current) {
                            observer.unobserve(imgRef.current);
                        }
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before entering viewport
                threshold: 0.01,
            }
        );

        // Start observing
        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        // Cleanup
        return () => {
            if (imgRef.current) {
                observer.unobserve(imgRef.current);
            }
        };
    }, [src, placeholder]);

    return { imageSrc, isLoading, isInView, imgRef };
};

/**
 * LazyImage component with built-in lazy loading
 * 
 * @param {object} props - Component props
 * @param {string} props.src - Image source URL
 * @param {string} props.alt - Image alt text
 * @param {string} props.placeholder - Optional placeholder image
 * @param {object} props.style - Optional inline styles
 * @param {string} props.className - Optional CSS class
 */
export const LazyImage = ({ src, alt, placeholder, style, className, ...props }) => {
    const { imageSrc, isLoading, imgRef } = useLazyLoad(src, placeholder);

    return (
        <img
            ref={imgRef}
            src={imageSrc}
            alt={alt}
            style={{
                ...style,
                opacity: isLoading ? 0.6 : 1,
                transition: 'opacity 0.3s ease-in-out',
            }}
            className={className}
            loading="lazy" // Native lazy loading as fallback
            {...props}
        />
    );
};

export default useLazyLoad;
