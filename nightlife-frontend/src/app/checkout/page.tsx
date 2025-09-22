'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import CheckoutForm from '@/components/checkout/CheckoutForm';

export default function CheckoutPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleCheckoutSuccess = (result: any) => {
    // Check the transaction status and redirect accordingly
    const status = result.wompiStatus || result.status || 'APPROVED';
    
    console.log('CheckoutPage - handleCheckoutSuccess called with:', { result, status });
    
    // If status is PENDING, redirect to processing page instead of success
    if (status.toUpperCase() === 'PENDING') {
      router.push('/payment-processing');
      return;
    }
    
    switch (status.toUpperCase()) {
      case 'APPROVED':
        // Store transaction details for success page (in case they weren't already stored)
        if (result.transactionId) {
          const transactionDetails = {
            transactionId: result.transactionId,
            status: 'APPROVED',
            totalPaid: result.totalPaid || result.actualTotal || 0,
            isFreeCheckout: result.isFreeCheckout || false,
            paymentMethod: result.paymentMethod || 'CARD',
            email: result.email || '',
            purchaseDate: new Date().toISOString(),
            items: result.items || [],
            subtotal: result.subtotal || 0,
            serviceFee: result.serviceFee || 0,
            discounts: result.discounts || 0,
            total: result.total || result.actualTotal || 0,
            actualTotal: result.actualTotal || 0
          };
          console.log('CheckoutPage - Storing APPROVED transaction details:', transactionDetails);
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/payment-success');
        break;
      case 'DECLINED':
        // Store transaction details for declined page
        if (result.transactionId) {
          const transactionDetails = {
            transactionId: result.transactionId,
            status: 'DECLINED',
            totalPaid: result.totalPaid || 0,
            isFreeCheckout: result.isFreeCheckout || false,
            paymentMethod: result.paymentMethod || 'CARD',
            email: result.email || '',
            purchaseDate: new Date().toISOString(),
            items: result.items || [],
            subtotal: result.subtotal || 0,
            serviceFee: result.serviceFee || 0,
            discounts: result.discounts || 0,
            total: result.total || 0,
            declineReason: result.declineReason || 'Fondos insuficientes'
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/payment-declined');
        break;
      case 'ERROR':
        // Store transaction details for error page
        if (result.transactionId) {
          const transactionDetails = {
            transactionId: result.transactionId,
            status: 'ERROR',
            totalPaid: result.totalPaid || 0,
            isFreeCheckout: result.isFreeCheckout || false,
            paymentMethod: result.paymentMethod || 'CARD',
            email: result.email || '',
            purchaseDate: new Date().toISOString(),
            items: result.items || [],
            subtotal: result.subtotal || 0,
            serviceFee: result.serviceFee || 0,
            discounts: result.discounts || 0,
            total: result.total || 0,
            errorCode: result.errorCode || 'PAYMENT_ERROR',
            errorMessage: result.errorMessage || 'Error interno del procesador de pagos'
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/payment-error');
        break;
      case 'TIMEOUT':
        // Store transaction details for timeout page
        if (result.transactionId) {
          const transactionDetails = {
            transactionId: result.transactionId,
            status: 'TIMEOUT',
            totalPaid: result.totalPaid || 0,
            isFreeCheckout: result.isFreeCheckout || false,
            paymentMethod: result.paymentMethod || 'CARD',
            email: result.email || '',
            purchaseDate: new Date().toISOString(),
            items: result.items || [],
            subtotal: result.subtotal || 0,
            serviceFee: result.serviceFee || 0,
            discounts: result.discounts || 0,
            total: result.total || 0,
            timeoutDuration: result.timeoutDuration || 30
          };
          localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
          sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        }
        router.push('/payment-timeout');
        break;
      default:
        // Default to success page for unknown statuses
        router.push('/payment-success');
        break;
    }
  };

  const handleCheckoutError = (errorMessage: string) => {
    console.error('Checkout error:', errorMessage);
    setError(errorMessage);
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
          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <h3 className="text-red-100 font-medium">Error en el Checkout</h3>
              </div>
              <p className="text-red-200 mt-2">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-3 text-sm text-red-300 hover:text-red-200 underline"
              >
                Intentar de nuevo
              </button>
            </div>
          )}

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
