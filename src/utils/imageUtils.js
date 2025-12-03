
/**
 * Validates and sanitizes image URLs.
 * Returns the URL if it's a valid HTTP/HTTPS URL or Data URI.
 * Returns an empty string if the URL is invalid (e.g. local file path).
 * 
 * @param {string} url - The image URL to check
 * @returns {string} - The valid URL or empty string
 */
export const getValidImageUrl = (url) => {
  if (!url) return "";
  
  // Check for string type
  if (typeof url !== 'string') return "";
  
  // Remove quotes if present (some bad data might have them)
  const cleanUrl = url.replace(/^"|"$/g, '');
  
  // Check for valid protocols
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://") || cleanUrl.startsWith("data:image/")) {
    return cleanUrl;
  }
  
  // Reject local paths
  if (cleanUrl.includes("C:/") || cleanUrl.includes("file:///")) {
    return "";
  }
  
  return "";
};


























