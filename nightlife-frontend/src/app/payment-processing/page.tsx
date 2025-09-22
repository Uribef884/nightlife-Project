'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Clock,
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useUser } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useSSE } from '@/hooks/useSSE';

interface TransactionDetails {
  transactionId: string;
  status: string;
  totalPaid: number;
  isFreeCheckout: boolean;
  paymentMethod: string;
  email: string;
  purchaseDate: string;
  items: any[];
  subtotal: number;
  serviceFee: number;
  discounts: number;
  total: number;
  declineReason?: string;
  errorCode?: string;
  errorMessage?: string;
  timeoutDuration?: number;
}

export default function PaymentProcessingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { clearCart } = useCartStore();

  const [transactionDetails, setTransactionDetails] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdateCount, setStatusUpdateCount] = useState(0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Handle status updates from SSE
  const handleStatusUpdate = useCallback((status: string, data: any) => {
    setStatusUpdateCount(prev => prev + 1);
    
    console.log('PaymentProcessing - Status update received:', { status, data });
    console.log('PaymentProcessing - Current transaction details:', transactionDetails);
    
    if (status !== 'PENDING') {
      // Get the current stored details to preserve all transaction data
      const currentStoredDetails = localStorage.getItem('lastTransactionDetails') || sessionStorage.getItem('lastTransactionDetails');
      let baseDetails: any = {};
      
      console.log('PaymentProcessing - Current stored details:', currentStoredDetails);
      
      if (currentStoredDetails) {
        try {
          baseDetails = JSON.parse(currentStoredDetails);
          console.log('PaymentProcessing - Parsed base details:', baseDetails);
        } catch (err) {
          console.warn('Failed to parse stored transaction details:', err);
        }
      }
      
      // Status has changed, update localStorage and redirect
      const updatedDetails = {
        ...baseDetails,
        status: status,
        // Preserve financial details from the original transaction
        totalPaid: data.totalPaid || baseDetails.totalPaid || data.actualTotal || baseDetails.actualTotal || 0,
        subtotal: data.subtotal || baseDetails.subtotal || 0,
        serviceFee: data.serviceFee || baseDetails.serviceFee || 0,
        discounts: data.discounts || baseDetails.discounts || 0,
        total: data.total || data.actualTotal || baseDetails.total || baseDetails.actualTotal || 0,
        actualTotal: data.actualTotal || baseDetails.actualTotal || 0,
        // Add status-specific fields
        declineReason: data.declineReason,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
        timeoutDuration: data.timeoutDuration
      };
      
      console.log('PaymentProcessing - Updated details to store:', updatedDetails);
      
      // Update localStorage
      localStorage.setItem('lastTransactionDetails', JSON.stringify(updatedDetails));
      sessionStorage.setItem('lastTransactionDetails', JSON.stringify(updatedDetails));
      
      // Redirect to appropriate page based on final status
      if (status === 'APPROVED') {
        router.push('/payment-success');
      } else if (status === 'DECLINED') {
        router.push('/payment-declined');
      } else if (status === 'ERROR') {
        // Check if this was originally a timeout
        if (data.originalStatus === 'TIMEOUT') {
          router.push('/payment-timeout');
        } else {
          router.push('/payment-error');
        }
      } else if (status === 'TIMEOUT') {
        router.push('/payment-timeout');
      } else {
        router.push('/payment-success');
      }
    }
  }, [router]);

  const handleSSEError = useCallback((error: string) => {
    setError(error);
  }, []);

  useEffect(() => {
    // Get transaction details from localStorage or sessionStorage
    const storedDetails = localStorage.getItem('lastTransactionDetails') || sessionStorage.getItem('lastTransactionDetails');

    if (storedDetails) {
      try {
        const details = JSON.parse(storedDetails);
        console.log('PaymentProcessing - Loaded transaction details:', details);
        
        if (details.status === 'PENDING') {
          setTransactionDetails(details);
          setLoading(false);
          
          // Check current status immediately since transaction might already be processed
          const checkInitialStatus = async () => {
            if (isCheckingStatus) {
              console.log('PaymentProcessing - Status check already in progress, skipping...');
              return;
            }
            
            setIsCheckingStatus(true);
            try {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL;
              console.log('PaymentProcessing - Checking initial status for transaction:', details.transactionId);
              const response = await fetch(`${apiUrl}/checkout/unified/status/${details.transactionId}`);
              if (response.ok) {
                const statusData = await response.json();
                console.log('PaymentProcessing - Initial status check response:', statusData);
                if (statusData.status && statusData.status !== 'PENDING') {
                  // Transaction status already updated
                  console.log('PaymentProcessing - Transaction already processed, redirecting...');
                  handleStatusUpdate(statusData.status, statusData);
                }
              }
            } catch (err) {
              console.error('PaymentProcessing - Error checking initial status:', err);
            } finally {
              setIsCheckingStatus(false);
            }
          };
          
          checkInitialStatus();
        } else {
          // Not a pending transaction, redirect to appropriate page
          console.log('PaymentProcessing - Non-pending transaction, redirecting...');
          if (details.status === 'APPROVED') {
            router.push('/payment-success');
          } else if (details.status === 'DECLINED') {
            router.push('/payment-declined');
          } else if (details.status === 'ERROR') {
            router.push('/payment-error');
          } else if (details.status === 'TIMEOUT') {
            router.push('/payment-timeout');
          } else {
            router.push('/payment-success');
          }
        }
      } catch (err) {
        console.error('Error parsing transaction details:', err);
        setError('Error al cargar los detalles de la transacción');
        setLoading(false);
      }
    } else {
      setError('No se encontraron detalles de la transacción');
      setLoading(false);
    }
  }, [router]);

  // Use SSE for real-time status updates - only after we have transaction details
  const { isConnected, lastEvent, error: sseError } = useSSE(transactionDetails?.transactionId || null, {
    onStatusUpdate: handleStatusUpdate,
    onError: handleSSEError
  });


  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleCancel = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-violet-500/20 rounded-full mb-6 animate-spin">
            <svg className="animate-spin h-10 w-10 text-violet-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <div className="inline-flex items-center justify-center w-20 h-20 bg-violet-500/20 rounded-full mb-6">
            <Clock className="h-10 w-10 text-violet-400 animate-pulse" />
          </div>

          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Procesando Pago
          </h1>

          <p className="text-slate-300 text-lg mb-4">
            Tu transacción está siendo procesada. Por favor, espera un momento.
          </p>

          <div className="bg-violet-900/20 border border-violet-500/50 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-violet-200 text-sm">
              <strong>Estado:</strong> Procesando...
            </p>
            <p className="text-violet-300 text-xs mt-1">
              Te redirigiremos automáticamente cuando el proceso termine.
            </p>
          </div>
        </div>

        {/* Transaction Details Card */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
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
                <span className="text-violet-400 font-medium text-sm sm:text-base">PROCESANDO</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Fecha de inicio:</span>
                <span className="text-slate-100 text-sm sm:text-base">{new Date(transactionDetails.purchaseDate).toLocaleDateString('es-CO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Método de pago:</span>
                <span className="text-slate-100 text-sm sm:text-base">
                  {transactionDetails.paymentMethod === 'CARD' ? 'Tarjeta' : 
                   transactionDetails.paymentMethod === 'PSE' ? 'PSE' :
                   transactionDetails.paymentMethod === 'BANCOLOMBIA_TRANSFER' ? 'Botón Bancolombia' :
                   transactionDetails.paymentMethod === 'NEQUI' ? 'NEQUI' : transactionDetails.paymentMethod}
                </span>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Subtotal:</span>
                <span className="text-slate-100 text-sm sm:text-base">{formatPrice(transactionDetails.subtotal)}</span>
              </div>
              {transactionDetails.serviceFee > 0 && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-slate-300 text-sm sm:text-base">Tarifa de servicio:</span>
                  <span className="text-slate-100 text-sm sm:text-base">{formatPrice(transactionDetails.serviceFee)}</span>
                </div>
              )}
              {transactionDetails.discounts > 0 && (
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-green-400">
                  <span className="text-sm sm:text-base">Descuentos:</span>
                  <span className="text-sm sm:text-base">-{formatPrice(transactionDetails.discounts)}</span>
                </div>
              )}
              <div className="border-t border-slate-600 pt-2">
                <div className="flex flex-col sm:flex-row sm:justify-between text-lg font-semibold">
                  <span className="text-slate-100 text-sm sm:text-base">Total:</span>
                  <span className="text-slate-100 text-sm sm:text-base">{formatPrice(transactionDetails.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-6 text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          <p className="text-slate-300 text-sm">
            {isConnected ? 'Conectado - Esperando actualización...' : 'Conectando...'}
            {statusUpdateCount > 0 && ` (${statusUpdateCount} actualizaciones recibidas)`}
          </p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                isConnected ? 'bg-violet-400' : 'bg-yellow-400'
              }`}
              style={{ width: isConnected ? '100%' : '50%' }}
            ></div>
          </div>
          {sseError && (
            <p className="text-red-400 text-xs mt-2">
              Error de conexión: {sseError}
            </p>
          )}
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={handleCancel}
            className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-slate-100 rounded-lg transition-colors"
          >
            Cancelar y volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
