// Frontend URL validation utility for external ads
// This mirrors the backend validation but runs on the client side

// Blacklist of known dangerous/malicious domains
const BLOCKED_DOMAINS = [
  // Common malicious domains
  "malware.com",
  "phishing-site.com",
  "scam-website.com",
  "fake-bank.com",
  "virus-download.com",
  "malicious-ads.com",
  "spam-site.com",
  "fraud-website.com",
  "hack-attempt.com",
  "data-stealer.com",
  
  // Common suspicious patterns
  "bit.ly", // Shortened URLs can be dangerous
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  
  // Local/internal domains that shouldn't be external
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "10.0.0.0",
  "192.168.0.0",
  "172.16.0.0"
];

// Suspicious patterns in URLs
const DANGEROUS_PATTERNS = [
  /javascript:/i,
  /data:/i,
  /vbscript:/i,
  /file:/i,
  /ftp:/i,
  /mailto:/i,
  /tel:/i,
  /sms:/i,
  /<script/i,
  /onclick/i,
  /onload/i,
  /onerror/i,
  /eval\(/i,
  /document\./i,
  /window\./i
];

export interface UrlValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedUrl?: string;
}

export function validateExternalUrl(url: string): UrlValidationResult {
  try {
    // Basic URL format validation
    const urlObj = new URL(url);
    
    // Check protocol
    if (!["https:", "http:"].includes(urlObj.protocol)) {
      return {
        isValid: false,
        error: "Only HTTP and HTTPS protocols are allowed"
      };
    }
    
    // Check domain against blacklist
    const hostname = urlObj.hostname.toLowerCase();
    const isBlocked = BLOCKED_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });
    
    if (isBlocked) {
      return {
        isValid: false,
        error: `Domain '${hostname}' is blocked for security reasons`
      };
    }
    
    // Check for dangerous patterns in the entire URL
    const fullUrl = urlObj.toString();
    const hasDangerousPattern = DANGEROUS_PATTERNS.some(pattern => pattern.test(fullUrl));
    
    if (hasDangerousPattern) {
      return {
        isValid: false,
        error: "URL contains potentially dangerous content"
      };
    }
    
    // Check for suspicious query parameters
    const suspiciousParams = ['javascript', 'data', 'vbscript', 'onclick', 'onload', 'onerror'];
    const hasSuspiciousParams = suspiciousParams.some(param => 
      urlObj.searchParams.has(param) || urlObj.search.includes(param)
    );
    
    if (hasSuspiciousParams) {
      return {
        isValid: false,
        error: "URL contains suspicious parameters"
      };
    }
    
    // Basic domain validation - must have a valid TLD
    const domainParts = hostname.split('.');
    if (domainParts.length < 2 || domainParts[domainParts.length - 1].length < 2) {
      return {
        isValid: false,
        error: "Invalid domain format"
      };
    }
    
    // Sanitize URL by removing potentially dangerous query parameters
    const sanitizedUrl = sanitizeUrl(urlObj);
    
    return {
      isValid: true,
      sanitizedUrl
    };
    
  } catch {
    return {
      isValid: false,
      error: "Invalid URL format"
    };
  }
}

// Helper function to sanitize URL by removing dangerous parameters
function sanitizeUrl(urlObj: URL): string {
  const sanitizedParams = new URLSearchParams();
  
  // Only keep safe query parameters
  for (const [key, value] of urlObj.searchParams) {
    const lowerKey = key.toLowerCase();
    const lowerValue = value.toLowerCase();
    
    // Skip dangerous parameters
    if (lowerKey.includes('javascript') || 
        lowerKey.includes('data') || 
        lowerKey.includes('vbscript') ||
        lowerKey.includes('onclick') ||
        lowerKey.includes('onload') ||
        lowerKey.includes('onerror') ||
        lowerValue.includes('javascript') ||
        lowerValue.includes('data:') ||
        lowerValue.includes('vbscript:')) {
      continue;
    }
    
    sanitizedParams.append(key, value);
  }
  
  const sanitizedSearch = sanitizedParams.toString();
  return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}${sanitizedSearch ? `?${sanitizedSearch}` : ''}`;
}

// Helper function to check if a URL is external
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Check if it's a local/internal domain
    const hostname = urlObj.hostname.toLowerCase();
    const isLocal = hostname.includes('localhost') || 
                   hostname.includes('127.0.0.1') ||
                   hostname.includes('nightlife') ||
                   hostname.includes('yourdomain.com') || // Replace with your actual domain
                   hostname.startsWith('192.168.') ||
                   hostname.startsWith('10.') ||
                   hostname.startsWith('172.');
    
    return !isLocal;
  } catch {
    return false;
  }
}

// Secure link handler for external URLs
export function createSecureExternalLink(url: string): string {
  const validation = validateExternalUrl(url);
  if (!validation.isValid) {
    console.warn('Invalid external URL:', validation.error);
    return '#';
  }
  
  return validation.sanitizedUrl || url;
}
