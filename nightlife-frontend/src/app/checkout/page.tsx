'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import CheckoutForm from '@/components/checkout/CheckoutForm';
import { useCartStore } from '@/stores/cart.store';

// Type definition for checkout result
type CheckoutResult = {
  wompiStatus?: string;
  status?: string;
  transactionId?: string;
  totalPaid?: number;
  actualTotal?: number;
  isFreeCheckout?: boolean;
  paymentMethod?: string;
  email?: string;
  items?: unknown[];
  subtotal?: number;
  serviceFee?: number;
  discounts?: number;
  total?: number;
  declineReason?: string;
  errorCode?: string;
  errorMessage?: string;
  timeoutDuration?: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { clearCart } = useCartStore();

  const handleBack = () => {
    router.back();
  };

  const handleCheckoutSuccess = async (result: unknown) => {
    // Type narrowing for checkout result
    const data = result as Partial<CheckoutResult>;
    // Check the transaction status and redirect accordingly
    const status = data.wompiStatus || data.status || 'APPROVED';
    
    
    // If status is PENDING, redirect to processing page instead of success
    if (status.toUpperCase() === 'PENDING') {
      router.push('/checkout/processing');
      return;
    }
    
    switch (status.toUpperCase()) {
      case 'APPROVED':
        // Store transaction details for success page (in case they weren't already stored)
        if (data.transactionId) {
              const transactionDetails = {
                transactionId: data.transactionId,
                status: 'APPROVED',
                totalPaid: data.totalPaid || data.actualTotal || 0,
                isFreeCheckout: data.isFreeCheckout || false,
                paymentMethod: data.paymentMethod || (data.isFreeCheckout ? 'FREE' : 'CARD'),
            email: data.email || '',
            purchaseDate: new Date().toISOString(),
            items: data.items || [],
            subtotal: data.subtotal || 0,
            serviceFee: data.serviceFee || 0,
            discounts: data.discounts || 0,
            total: data.total || data.actualTotal || 0,
            actualTotal: data.actualTotal || 0
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        
        // Clear cart only for APPROVED transactions
        try {
          await clearCart();
        } catch (cartError) {
          console.error('CheckoutPage - Failed to clear cart for APPROVED transaction:', cartError);
          // Don't fail the checkout if cart clearing fails
        }
        
        router.push('/checkout/success');
        break;
      case 'DECLINED':
        // Store transaction details for declined page
        if (data.transactionId) {
          const transactionDetails = {
            transactionId: data.transactionId,
            status: 'DECLINED',
            totalPaid: data.totalPaid || 0,
            isFreeCheckout: data.isFreeCheckout || false,
            paymentMethod: data.paymentMethod || (data.isFreeCheckout ? 'FREE' : 'CARD'),
            email: data.email || '',
            purchaseDate: new Date().toISOString(),
            items: data.items || [],
            subtotal: data.subtotal || 0,
            serviceFee: data.serviceFee || 0,
            discounts: data.discounts || 0,
            total: data.total || 0,
            declineReason: data.declineReason || 'Fondos insuficientes'
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/checkout/declined');
        break;
      case 'ERROR':
        // Store transaction details for error page
        if (data.transactionId) {
          const transactionDetails = {
            transactionId: data.transactionId,
            status: 'ERROR',
            totalPaid: data.totalPaid || 0,
            isFreeCheckout: data.isFreeCheckout || false,
            paymentMethod: data.paymentMethod || (data.isFreeCheckout ? 'FREE' : 'CARD'),
            email: data.email || '',
            purchaseDate: new Date().toISOString(),
            items: data.items || [],
            subtotal: data.subtotal || 0,
            serviceFee: data.serviceFee || 0,
            discounts: data.discounts || 0,
            total: data.total || 0,
            errorCode: data.errorCode || 'PAYMENT_ERROR',
            errorMessage: data.errorMessage || 'Error interno del procesador de pagos'
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/checkout/error');
        break;
      case 'TIMEOUT':
        // Store transaction details for timeout page
        if (data.transactionId) {
          const transactionDetails = {
            transactionId: data.transactionId,
            status: 'TIMEOUT',
            totalPaid: data.totalPaid || 0,
            isFreeCheckout: data.isFreeCheckout || false,
            paymentMethod: data.paymentMethod || (data.isFreeCheckout ? 'FREE' : 'CARD'),
            email: data.email || '',
            purchaseDate: new Date().toISOString(),
            items: data.items || [],
            subtotal: data.subtotal || 0,
            serviceFee: data.serviceFee || 0,
            discounts: data.discounts || 0,
            total: data.total || 0,
            timeoutDuration: data.timeoutDuration || 30
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/checkout/timeout');
        break;
      default:
        // Default to success page for unknown statuses
        router.push('/checkout/success');
        break;
    }
  };

  const handleCheckoutError = (errorMessage: string) => {
    console.error('Checkout error:', errorMessage);
    // Error is now handled by CheckoutForm component
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 shadow-sm border-b border-slate-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 text-violet-400 hover:text-violet-300 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Volver</span>
            </button>
            
            <h1 className="text-lg sm:text-xl font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-none">
              Finalizar Compra
            </h1>
            
            <div className="w-20"></div> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-3xl mx-auto">
          {/* Checkout Form */}
          <CheckoutForm
            onSuccess={handleCheckoutSuccess}
            onError={handleCheckoutError}
          />
        </div>
      </div>
    </div>
  );
}
