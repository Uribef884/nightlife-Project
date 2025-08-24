/**
 * Device detection utilities for PDF rendering optimization
 * Detects mobile vs desktop to use appropriate PDF viewing strategies
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  userAgent: string;
  platform: string;
}

/**
 * Detect device type based on user agent and screen size
 * Uses multiple detection methods for accuracy
 */
export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    // Server-side default
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      userAgent: '',
      platform: ''
    };
  }

  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  
  // Mobile detection patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
    /Mobile/i,
    /Tablet/i
  ];
  
  // Tablet-specific patterns
  const tabletPatterns = [
    /iPad/i,
    /Android(?!.*Mobile)/i,
    /Tablet/i
  ];
  
  // Check if it's a tablet first (more specific)
  const isTablet = tabletPatterns.some(pattern => pattern.test(userAgent));
  
  // Check if it's mobile (including tablets)
  const isMobile = isTablet || mobilePatterns.some(pattern => pattern.test(userAgent));
  
  // Additional mobile detection using screen size and touch capability
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;
  
  // Consider it mobile if it has touch screen and small screen
  const isSmallScreen = screenWidth <= 768 || screenHeight <= 768;
  const isMobileByScreen = hasTouchScreen && isSmallScreen;
  
  // Final mobile determination
  const finalIsMobile = isMobile || isMobileByScreen;
  
  return {
    isMobile: finalIsMobile,
    isTablet: isTablet,
    isDesktop: !finalIsMobile,
    userAgent,
    platform
  };
}

/**
 * Check if the current device supports embedded PDF viewing
 * Mobile devices often have limited PDF embedding support
 */
export function supportsEmbeddedPDF(): boolean {
  const device = detectDevice();
  
  if (device.isMobile) {
    // Mobile devices often don't support PDF embedding well
    return false;
  }
  
  // Desktop browsers generally support PDF embedding
  return true;
}

/**
 * Check if the current device supports PDF.js rendering
 * PDF.js provides consistent cross-platform PDF viewing
 */
export function supportsPDFJS(): boolean {
  // PDF.js works on all modern browsers
  return typeof window !== 'undefined' && 'PDFJS' in window;
}

/**
 * Get the recommended PDF rendering strategy for the current device
 */
export function getRecommendedPDFStrategy(): 'iframe' | 'pdfjs' | 'download' {
  const device = detectDevice();
  
  if (device.isMobile) {
    // Mobile: Use PDF.js for consistent rendering, fallback to download
    return 'pdfjs';
  }
  
  // Desktop: Use iframe with custom controls
  return 'iframe';
}
