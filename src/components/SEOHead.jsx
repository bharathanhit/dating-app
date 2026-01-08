import { useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * SEOHead Component
 * Dynamically updates page meta tags for SEO optimization
 * Supports Open Graph and Twitter Card tags for social media sharing
 */
const SEOHead = ({
    title = 'BiChat - Find Your Perfect Match | Modern Dating & Connection App',
    description = 'Discover meaningful connections on BiChat. The best modern dating app to browse profiles, chat with matches, and find your perfect partner safely.',
    keywords = 'dating app, online dating, find love, relationships, matches, singles, dating site, meet people, romance, connections, BiChat, private chat, secure dating',
    image = 'https://bi-chat.online/og-image-optimized.png',
    url = 'https://bi-chat.online/',
    type = 'website',
    noindex = false,
    author = 'BiChat',
    schema = null,
}) => {
    useEffect(() => {
        // Update document title
        document.title = title;

        // Helper function to update or create meta tags
        const updateMetaTag = (selector, attribute, value) => {
            let element = document.querySelector(selector);
            if (!element) {
                element = document.createElement('meta');
                if (selector.includes('property')) {
                    element.setAttribute('property', selector.replace('meta[property="', '').replace('"]', ''));
                } else {
                    element.setAttribute('name', selector.replace('meta[name="', '').replace('"]', ''));
                }
                document.head.appendChild(element);
            }
            element.setAttribute(attribute, value);
        };

        // Update basic meta tags
        updateMetaTag('meta[name="description"]', 'content', description);
        updateMetaTag('meta[name="keywords"]', 'content', keywords);
        updateMetaTag('meta[name="author"]', 'content', author);

        // Google site verification
        updateMetaTag('meta[name="google-site-verification"]', 'content', 'ovk5mr7LQPVDea9XpWNXH3Int0muNDsGt09Cf_LaSPU');

        // Update robots meta tag for indexing control
        if (noindex) {
            updateMetaTag('meta[name="robots"]', 'content', 'noindex, nofollow');
        } else {
            const robotsTag = document.querySelector('meta[name="robots"]');
            if (robotsTag) {
                robotsTag.remove();
            }
        }

        // Update Open Graph tags
        updateMetaTag('meta[property="og:title"]', 'content', title);
        updateMetaTag('meta[property="og:description"]', 'content', description);
        updateMetaTag('meta[property="og:image"]', 'content', image);
        updateMetaTag('meta[property="og:url"]', 'content', url);
        updateMetaTag('meta[property="og:type"]', 'content', type);

        // Update Twitter Card tags
        updateMetaTag('meta[name="twitter:title"]', 'content', title);
        updateMetaTag('meta[name="twitter:description"]', 'content', description);
        updateMetaTag('meta[name="twitter:image"]', 'content', image);
        updateMetaTag('meta[name="twitter:url"]', 'content', url);

        // Update canonical URL
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', url);

        // Inject structured data (JSON-LD)
        if (schema) {
            let script = document.querySelector('script[type="application/ld+json"][data-generated="true"]');
            if (!script) {
                script = document.createElement('script');
                script.setAttribute('type', 'application/ld+json');
                script.setAttribute('data-generated', 'true');
                document.head.appendChild(script);
            }
            script.textContent = JSON.stringify(schema);
        }
    }, [title, description, keywords, image, url, type, noindex, author, schema]);

    // This component doesn't render anything
    return null;
};

SEOHead.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    keywords: PropTypes.string,
    image: PropTypes.string,
    url: PropTypes.string,
    type: PropTypes.string,
    noindex: PropTypes.bool,
    author: PropTypes.string,
    schema: PropTypes.object,
};

export default SEOHead;
