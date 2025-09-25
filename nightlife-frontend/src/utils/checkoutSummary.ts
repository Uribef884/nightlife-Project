// Checkout Summary Storage Utility
// Captures the correct pricing data at checkout time for use in payment pages

export interface CheckoutSummary {
  total: number;           // Subtotal (costo de productos)
  operationalCosts: number; // Service fee (tarifa de servicio)
  actualTotal: number;     // Total amount
  items?: any[];           // Optional items array
  timestamp: number;       // When this was captured
}

const CHECKOUT_SUMMARY_KEY = 'checkoutSummary';

/**
 * Store the checkout summary with correct pricing data
 * This should be called when the user clicks "Completar Compra"
 */
export function storeCheckoutSummary(): void {
  if (typeof window === 'undefined') return;
  
  // Get the unified summary from window (set by cart store)
  const windowSummaries = (window as any).cartSummaries;
  const unifiedSummary = windowSummaries?.unified;
  
  
  if (unifiedSummary) {
    const checkoutSummary: CheckoutSummary = {
      total: unifiedSummary.total || 0,
      operationalCosts: unifiedSummary.operationalCosts || 0,
      actualTotal: unifiedSummary.actualTotal || 0,
      items: unifiedSummary.items || [],
      timestamp: Date.now()
    };
    
    // Store in localStorage
    localStorage.setItem(CHECKOUT_SUMMARY_KEY, JSON.stringify(checkoutSummary));
  } else {
    console.warn('CheckoutSummary: No unified summary available to store');
  }
}

/**
 * Get the stored checkout summary
 * Returns null if not found or expired
 */
export function getCheckoutSummary(): CheckoutSummary | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(CHECKOUT_SUMMARY_KEY);
    
    if (!stored) {
      return null;
    }
    
    const summary: CheckoutSummary = JSON.parse(stored);
    
    // Check if summary is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (Date.now() - summary.timestamp > maxAge) {
      localStorage.removeItem(CHECKOUT_SUMMARY_KEY);
      return null;
    }
    
    return summary;
  } catch (error) {
    console.error('CheckoutSummary: Error parsing stored summary', error);
    localStorage.removeItem(CHECKOUT_SUMMARY_KEY);
    return null;
  }
}

/**
 * Clear the stored checkout summary
 * Should be called after successful payment or when starting a new checkout
 */
export function clearCheckoutSummary(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CHECKOUT_SUMMARY_KEY);
}

/**
 * Check if we have a valid checkout summary
 */
export function hasCheckoutSummary(): boolean {
  return getCheckoutSummary() !== null;
}
