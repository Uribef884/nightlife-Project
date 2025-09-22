/**
 * Debug utilities for payment screens
 * Provides consistent logging and debugging capabilities
 */

export interface PaymentDebugInfo {
  transactionId?: string;
  status?: string;
  totalPaid?: number;
  subtotal?: number;
  serviceFee?: number;
  discounts?: number;
  total?: number;
  actualTotal?: number;
  isFreeCheckout?: boolean;
  paymentMethod?: string;
  email?: string;
  purchaseDate?: string;
  items?: any[];
  errorCode?: string;
  errorMessage?: string;
  declineReason?: string;
  timeoutDuration?: number;
}

export class PaymentDebugger {
  private static instance: PaymentDebugger;
  private isDebugMode: boolean;

  constructor() {
    this.isDebugMode = process.env.NODE_ENV === 'development' || 
                      (typeof window !== 'undefined' && (
                        window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('localhost')
                      ));
  }

  static getInstance(): PaymentDebugger {
    if (!PaymentDebugger.instance) {
      PaymentDebugger.instance = new PaymentDebugger();
    }
    return PaymentDebugger.instance;
  }

  /**
   * Log transaction details with proper formatting
   */
  logTransactionDetails(transactionDetails: PaymentDebugInfo, screenName: string) {
    if (!this.isDebugMode) return;

    console.group(`🔍 ${screenName} - Transaction Details`);
    console.log('📊 Full Transaction Object:', transactionDetails);
    
    // Financial information
    console.log('💰 Financial Summary:');
    console.log('  • Subtotal:', this.formatCurrency(transactionDetails.subtotal));
    console.log('  • Service Fee:', this.formatCurrency(transactionDetails.serviceFee));
    console.log('  • Discounts:', this.formatCurrency(transactionDetails.discounts));
    console.log('  • Total:', this.formatCurrency(transactionDetails.total));
    console.log('  • Actual Total:', this.formatCurrency(transactionDetails.actualTotal));
    console.log('  • Total Paid:', this.formatCurrency(transactionDetails.totalPaid));
    console.log('  • Is Free Checkout:', transactionDetails.isFreeCheckout);

    // Transaction metadata
    console.log('📋 Transaction Metadata:');
    console.log('  • Transaction ID:', transactionDetails.transactionId);
    console.log('  • Status:', transactionDetails.status);
    console.log('  • Payment Method:', transactionDetails.paymentMethod);
    console.log('  • Email:', transactionDetails.email);
    console.log('  • Purchase Date:', transactionDetails.purchaseDate);

    // Items information
    if (transactionDetails.items && transactionDetails.items.length > 0) {
      console.log('🛒 Items:');
      transactionDetails.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.name} (${item.type})`);
        console.log(`     Quantity: ${item.quantity}, Price: ${this.formatCurrency(item.price)}`);
        console.log(`     Club: ${item.clubName}, Date: ${item.date}`);
      });
    }

    // Error information (if applicable)
    if (transactionDetails.errorCode || transactionDetails.errorMessage) {
      console.log('❌ Error Information:');
      console.log('  • Error Code:', transactionDetails.errorCode);
      console.log('  • Error Message:', transactionDetails.errorMessage);
    }

    // Decline information (if applicable)
    if (transactionDetails.declineReason) {
      console.log('🚫 Decline Information:');
      console.log('  • Decline Reason:', transactionDetails.declineReason);
    }

    // Timeout information (if applicable)
    if (transactionDetails.timeoutDuration) {
      console.log('⏰ Timeout Information:');
      console.log('  • Timeout Duration:', transactionDetails.timeoutDuration, 'seconds');
    }

    console.groupEnd();
  }

  /**
   * Log API response for debugging
   */
  logApiResponse(response: any, endpoint: string, screenName: string) {
    if (!this.isDebugMode) return;

    console.group(`🌐 ${screenName} - API Response (${endpoint})`);
    console.log('📡 Response Status:', response.status || 'N/A');
    console.log('📄 Response Data:', response);
    console.log('🔗 Endpoint:', endpoint);
    console.groupEnd();
  }

  /**
   * Log error information
   */
  logError(error: any, context: string, screenName: string) {
    if (!this.isDebugMode) return;

    console.group(`❌ ${screenName} - Error (${context})`);
    console.error('Error Details:', error);
    console.log('Error Context:', context);
    console.log('Error Stack:', error?.stack || 'No stack trace available');
    console.groupEnd();
  }

  /**
   * Log URL parameters
   */
  logUrlParams(searchParams: URLSearchParams, screenName: string) {
    if (!this.isDebugMode) return;

    console.group(`🔗 ${screenName} - URL Parameters`);
    console.log('Full URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
    console.log('Search Params:', Object.fromEntries(searchParams.entries()));
    console.groupEnd();
  }

  /**
   * Log localStorage/sessionStorage data
   */
  logStoredData(storageType: 'localStorage' | 'sessionStorage', key: string, data: any, screenName: string) {
    if (!this.isDebugMode) return;

    console.group(`💾 ${screenName} - ${storageType} Data (${key})`);
    console.log('Storage Type:', storageType);
    console.log('Key:', key);
    console.log('Data:', data);
    console.groupEnd();
  }

  /**
   * Log component lifecycle events
   */
  logLifecycleEvent(event: string, screenName: string, additionalInfo?: any) {
    if (!this.isDebugMode) return;

    console.log(`🔄 ${screenName} - ${event}`, additionalInfo || '');
  }

  /**
   * Format currency for logging
   */
  private formatCurrency(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return 'N/A';
    }
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Validate transaction data completeness
   */
  validateTransactionData(transactionDetails: PaymentDebugInfo, screenName: string): boolean {
    if (!this.isDebugMode) return true;

    const issues: string[] = [];

    if (!transactionDetails.transactionId) {
      issues.push('Missing transaction ID');
    }

    if (!transactionDetails.status) {
      issues.push('Missing status');
    }

    if (transactionDetails.totalPaid === undefined || transactionDetails.totalPaid === null) {
      issues.push('Missing total paid amount');
    }

    if (transactionDetails.subtotal === undefined || transactionDetails.subtotal === null) {
      issues.push('Missing subtotal');
    }

    if (transactionDetails.serviceFee === undefined || transactionDetails.serviceFee === null) {
      issues.push('Missing service fee');
    }

    if (issues.length > 0) {
      console.group(`⚠️ ${screenName} - Data Validation Issues`);
      console.warn('Missing or invalid data:');
      issues.forEach(issue => console.warn(`  • ${issue}`));
      console.log('Transaction Details:', transactionDetails);
      console.groupEnd();
      return false;
    }

    console.log(`✅ ${screenName} - Transaction data validation passed`);
    return true;
  }
}

// Export singleton instance
export const paymentDebugger = PaymentDebugger.getInstance();
