/**
 * Mobile-friendly scroll utilities
 * Handles various mobile browser quirks and inconsistencies
 */

/**
 * Scrolls to the top of the page using multiple methods for maximum compatibility
 * Works on all mobile browsers including iOS Safari, Chrome Mobile, etc.
 */
export function scrollToTop(): void {
  if (typeof window === 'undefined') return;

  // Method 1: Standard smooth scroll
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Method 2: Direct DOM manipulation (fallback for mobile)
  setTimeout(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 100);
  
  // Method 3: Force scroll for stubborn mobile browsers
  setTimeout(() => {
    window.scrollTo(0, 0);
  }, 200);
}

/**
 * Immediate scroll to top (no smooth animation)
 * Useful when you need instant positioning
 */
export function scrollToTopImmediate(): void {
  if (typeof window === 'undefined') return;
  
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Gentle scroll to top - only scrolls if needed and uses smooth animation
 * Useful for tab changes where aggressive scrolling might interfere with content
 */
export function scrollToTopGentle(): void {
  if (typeof window === 'undefined') return;

  // Only scroll if we're not already near the top
  if (window.scrollY > 100) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Fallback for mobile
    setTimeout(() => {
      if (window.scrollY > 50) {
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    }, 150);
  }
}
