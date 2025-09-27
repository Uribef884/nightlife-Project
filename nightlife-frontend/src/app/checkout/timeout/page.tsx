'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Clock,
  ArrowLeft,
  RefreshCw,
  CreditCard,
  Mail,
  Phone,
  ExternalLink,
  Timer
} from 'lucide-react';
import { useUser } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { getCheckoutSummary } from '@/utils/checkoutSummary';

// Simple transaction details type
type TransactionDetails = {
  transactionId: string;
  status: string;
  totalPaid: number;
  isFreeCheckout: boolean;
  paymentMethod: string;
  email: string;
  purchaseDate: string;
  items: unknown[];
  subtotal: number;
  serviceFee: number;
  discounts: number;
  total: number;
  actualTotal?: number;
  declineReason?: string;
  timeoutDuration?: number;
  errorCode?: string;
  errorMessage?: string;
};

export default function PaymentTimeoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { } = useCartStore();

  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactionDetails = useCallback(async (transactionId: string) => {
    try {
      // Fetch transaction details from backend API
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      const response = await fetch(`${apiUrl}/checkout/unified/status/${transactionId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction details: ${response.status}`);
      }

      const data = await response.json();
      
      // Use simple transaction details mapping
      const transactionDetails: TransactionDetails = {
        transactionId: data.transactionId || transactionId,
        status: data.status || 'TIMEOUT',
        totalPaid: data.totalPaid || data.amount || 0,
        isFreeCheckout: Boolean(data.isFreeCheckout),
        paymentMethod: data.paymentMethod || 'CARD',
        email: data.customerEmail || user?.email || 'usuario@ejemplo.com',
        purchaseDate: data.createdAt || new Date().toISOString(),
        items: data.items || [],
        subtotal: data.subtotal || 0,
        serviceFee: data.serviceFee || 0,
        discounts: data.discounts || 0,
        total: data.total || data.amount || 0,
        actualTotal: data.actualTotal,
        declineReason: data.declineReason,
        timeoutDuration: data.timeoutDuration,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      };
      
      setTransactionDetails(transactionDetails);
    } catch (err) {
      console.error('Error fetching transaction details:', err);
      setError('Error al cargar los detalles de la transacción');
    }
  }, [user?.email]);

  useEffect(() => {
    
    // Get transaction details from URL params, localStorage, or sessionStorage
    const transactionId = searchParams.get('transactionId');
    const storedDetails = localStorage.getItem('lastTransactionDetails') || sessionStorage.getItem('lastTransactionDetails');

    
    
    if (storedDetails) {
      try {
        const details = JSON.parse(storedDetails);
        
        
        // Use checkout summary for correct pricing, fallback to stored details
        const checkoutSummary = getCheckoutSummary();
        let transactionDetails = details;
        
        if (checkoutSummary) {
          console.log('PaymentTimeout: Using checkout summary for correct pricing', checkoutSummary);
          
          // Update transaction details with correct pricing from checkout summary
          transactionDetails = {
            ...details,
            subtotal: checkoutSummary.total,
            serviceFee: checkoutSummary.operationalCosts,
            total: checkoutSummary.actualTotal,
            totalPaid: checkoutSummary.actualTotal,
            actualTotal: checkoutSummary.actualTotal,
          };
        } else {
          console.log('PaymentTimeout: No checkout summary available, using stored details');
        }
        
        // Log transaction details for debugging
        
        
        
        // Successfully parsed transaction details
        setTransactionDetails(transactionDetails);
        // Clear the stored details after displaying (with delay to prevent race conditions)
        setTimeout(() => {
          localStorage.removeItem('lastTransactionDetails');
          sessionStorage.removeItem('lastTransactionDetails');
        }, 2000);
      } catch (err) {
        console.error("Error:", err);
        setError('Error al cargar los detalles de la transacción');
      }
    } else if (transactionId) {
      // If we have a transaction ID but no stored details, try to fetch them
      
      fetchTransactionDetails(transactionId);
    } else {
      // No transaction data available
      
      setError('No se encontraron detalles de la transacción');
    }

    setLoading(false);
  }, [searchParams, fetchTransactionDetails, user?.email]);

  const formatPrice = (price: number | undefined | null) => {
    const validPrice = price && !isNaN(price) ? price : 0;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(validPrice);
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Fecha no disponible';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Fecha inválida';
      
      return date.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const handleRetryPayment = () => {
    router.push('/checkout');
  };

  const handleViewCart = () => {
    router.push('/');
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/20 rounded-full mb-6 animate-spin">
            <svg className="animate-spin h-10 w-10 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Cargando detalles de la transacción...</h2>
          <p>Por favor, espera un momento.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-6">
            <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-lg mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
          >
            Ir a la página principal
          </button>
        </div>
      </div>
    );
  }

  if (!transactionDetails) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/20 rounded-full mb-6">
            <svg className="h-10 w-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Detalles de la transacción no disponibles</h2>
          <p>No pudimos cargar los detalles de tu compra. Por favor, intenta nuevamente o contacta a soporte.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-6 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
          >
            Ir a la página principal
          </button>
        </div>
      </div>
    );
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'FREE': return <span className="text-green-400 text-lg">🎁</span>;
      case 'CARD': return <CreditCard className="h-5 w-5 text-slate-400" />;
      case 'NEQUI': return <Phone className="h-5 w-5 text-slate-400" />;
      case 'PSE': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-slate-400"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 4h2v6h-2V8zm0 8h2v2h-2v-2z"/></svg>;
      case 'BANCOLOMBIA_TRANSFER': return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-slate-400"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm-1 4h2v6h-2V8zm0 8h2v2h-2v-2z"/></svg>;
      default: return null;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'FREE': return 'Gratuito';
      case 'CARD': return 'Tarjeta';
      case 'PSE': return 'PSE';
      case 'BANCOLOMBIA_TRANSFER': return 'Botón Bancolombia';
      case 'NEQUI': return 'NEQUI';
      default: return method;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800/50 border-b border-slate-700/60">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-violet-400 hover:text-violet-300 transition-colors text-sm sm:text-base"
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Volver</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-yellow-500/20 rounded-full mb-6">
            <Clock className="h-10 w-10 text-yellow-400" />
          </div>

          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Tiempo de Espera Agotado
          </h1>

          <p className="text-slate-300 text-lg mb-4">
            Tu pago tardó más de 5 minutos en procesarse, así que lo cancelamos automáticamente.
          </p>

          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-4 max-w-md mx-auto mb-4">
            <p className="text-yellow-200 text-sm">
              <strong>¿Por qué pasó esto?</strong>
            </p>
            <p className="text-yellow-300 text-xs mt-2">
              Los pagos tienen un tiempo límite de 30 minutos. Si no se completa en ese tiempo, se cancela automáticamente para proteger tu dinero.
            </p>
            <p className="text-yellow-300 text-xs mt-2">
              <strong>No te preocupes:</strong> No se realizó ningún cargo a tu cuenta y tu carrito está listo para intentar de nuevo.
            </p>
          </div>

          {!transactionDetails.isFreeCheckout && (
            <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-slate-200 text-sm mb-1">
                <strong>Total del pedido:</strong>
              </p>
              <p className="text-slate-100 text-xl font-bold">
                {formatPrice(transactionDetails.totalPaid || transactionDetails.actualTotal || transactionDetails.total)}
              </p>
            </div>
          )}
        </div>

        {/* Transaction Details Card */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
            <Timer className="h-5 w-5 mr-2" />
            Detalles de la Transacción
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Transaction Info */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Número de transacción:</span>
                <span className="text-slate-100 font-mono text-xs sm:text-sm break-all">{transactionDetails.transactionId}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Estado:</span>
                <span className="text-yellow-400 font-medium text-sm sm:text-base">TIMEOUT</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Fecha de intento:</span>
                <span className="text-slate-100 text-sm sm:text-base">{formatDate(transactionDetails.purchaseDate)}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Método de pago:</span>
                <span className="text-slate-100 flex items-center text-sm sm:text-base">
                  {getPaymentMethodIcon(transactionDetails.paymentMethod)}
                  <span className="ml-1">{getPaymentMethodLabel(transactionDetails.paymentMethod)}</span>
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Tiempo máximo de pago:</span>
                <span className="text-slate-100 text-sm sm:text-base">{transactionDetails.timeoutDuration || 30} minutos</span>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Subtotal:</span>
                <span className="text-slate-100 text-sm sm:text-base">{formatPrice(transactionDetails.subtotal)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Tarifa de servicio:</span>
                <span className="text-slate-100 text-sm sm:text-base">{formatPrice(transactionDetails.serviceFee)}</span>
              </div>
              {transactionDetails.discounts > 0 && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-green-400">
                  <span className="text-sm sm:text-base">Descuentos:</span>
                  <span className="text-sm sm:text-base">-{formatPrice(transactionDetails.discounts)}</span>
                </div>
              )}
              <div className="border-t border-slate-600 pt-2">
                <div className="flex flex-col sm:flex-row sm:justify-between text-lg font-semibold">
                  <span className="text-slate-100 text-sm sm:text-base">Total:</span>
                  <span className="text-slate-100 text-sm sm:text-base">{formatPrice(transactionDetails.totalPaid || transactionDetails.actualTotal || transactionDetails.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleRetryPayment}
            className="flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 text-white py-3 px-4 rounded-lg transition-colors"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Intentar de nuevo</span>
          </button>

          <button
            onClick={handleViewCart}
            className="flex items-center justify-center space-x-2 bg-slate-600 hover:bg-slate-500 text-slate-100 py-3 px-4 rounded-lg transition-colors"
          >
            <ExternalLink className="h-5 w-5" />
            <span>Ver carrito</span>
          </button>
        </div>

        {/* Footer Reassurance */}
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4 sm:p-6 text-center">
          <h3 className="text-slate-100 font-medium mb-2">¿Problemas de conectividad?</h3>
          <p className="text-slate-300 text-sm mb-4 px-2">
            Si experimentas timeouts frecuentes, contáctanos en{' '}
            <a 
              href={`mailto:${process.env.NEXT_PUBLIC_EMAIL || 'soporte@nightlife.com'}`}
              className="text-violet-400 hover:text-violet-300 underline break-all"
            >
              {process.env.NEXT_PUBLIC_EMAIL || 'soporte@nightlife.com'}
            </a>
            {' '}con tu ID de transacción: <span className="font-mono text-slate-200 break-all">{transactionDetails.transactionId}</span>
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-6 text-slate-400 text-sm">
            <div className="flex items-center space-x-1">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="break-all">{process.env.NEXT_PUBLIC_EMAIL || 'soporte@nightlife.com'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span className="break-all">{process.env.NEXT_PUBLIC_PHONE || '+57 1 234 5678'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
