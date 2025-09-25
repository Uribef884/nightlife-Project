'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  CheckCircle, 
  ArrowLeft, 
  ShoppingBag, 
  Calendar,
  CreditCard,
  Mail,
  Phone,
  ExternalLink,
  Ticket,
  Utensils
} from 'lucide-react';
import { useUser } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { getCheckoutSummary, clearCheckoutSummary } from '@/utils/checkoutSummary';

// Simple transaction details type
type TransactionDetails = {
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
  actualTotal?: number;
  declineReason?: string;
  timeoutDuration?: number;
  errorCode?: string;
  errorMessage?: string;
};

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useUser();
  const { clearCart, items, getCartSummary } = useCartStore();
  
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
      
      
      
      // Check the actual transaction status and redirect if not APPROVED
      const actualStatus = data.status || 'APPROVED';
      if (actualStatus !== 'APPROVED') {
        // Redirect to the appropriate page based on status
        if (actualStatus === 'DECLINED') {
          router.push('/checkout/declined');
          return;
        } else if (actualStatus === 'ERROR') {
          router.push('/checkout/error');
          return;
        } else if (actualStatus === 'TIMEOUT') {
          router.push('/checkout/timeout');
          return;
        } else if (actualStatus === 'PENDING') {
          router.push('/checkout/processing');
          return;
        }
      }
      
      // Use simple transaction details mapping
      const transactionDetails: TransactionDetails = {
        transactionId: data.transactionId || transactionId,
        status: data.status || 'APPROVED',
        totalPaid: data.totalPaid || data.amount || 0,
        isFreeCheckout: Boolean(data.isFreeCheckout),
        paymentMethod: data.paymentMethod || 'CARD',
        email: data.customerEmail || data.email || user?.email || 'usuario@ejemplo.com',
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
      
      setError('Error al cargar los detalles de la transacción');
    }
  }, [user?.email, router]);

  useEffect(() => {
    
    
    // Get transaction details from URL params, localStorage, or sessionStorage
    const transactionId = searchParams.get('transactionId');
    const storedDetails = localStorage.getItem('lastTransactionDetails') || sessionStorage.getItem('lastTransactionDetails');
    
    
    
    // Check if stored details belong to current user/session
    if (storedDetails) {
      try {
        const details = JSON.parse(storedDetails);
        
        // If user is logged in, check if the stored transaction email matches user's email
        if (user && details.email && details.email !== user.email) {
          localStorage.removeItem('lastTransactionDetails');
          sessionStorage.removeItem('lastTransactionDetails');
          clearCheckoutSummary();
          router.push('/');
          return;
        }
        
        // Check if transaction is too old (older than 24 hours)
        const transactionDate = new Date(details.purchaseDate);
        const now = new Date();
        const hoursDiff = (now.getTime() - transactionDate.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff > 24) {
          localStorage.removeItem('lastTransactionDetails');
          sessionStorage.removeItem('lastTransactionDetails');
          clearCheckoutSummary();
          router.push('/');
          return;
        }
        
        // Use checkout summary for correct pricing if available
        const checkoutSummary = getCheckoutSummary();
        let transactionDetails = details;
        
        if (checkoutSummary) {
          
          // Update transaction details with correct pricing from checkout summary
          transactionDetails = {
            ...details,
            subtotal: checkoutSummary.total,
            serviceFee: checkoutSummary.operationalCosts,
            total: checkoutSummary.actualTotal,
            totalPaid: checkoutSummary.actualTotal,
            actualTotal: checkoutSummary.actualTotal,
          };
          
          // Clear checkout summary after successful payment
          clearCheckoutSummary();
        }
        
        setTransactionDetails(transactionDetails);
      } catch (err) {
        
        setError('Error al cargar los detalles de la transacción');
      }
    } else if (transactionId) {
      // Only fetch from API if no stored details available
      
      fetchTransactionDetails(transactionId);
    } else {
      // No transaction data available
      
      setError('No se encontraron detalles de la transacción');
    }
    
    setLoading(false);
  }, [searchParams, clearCart, fetchTransactionDetails, user]);

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
    } catch (error) {
      return 'Fecha inválida';
    }
  };


  const handleViewPurchases = () => {
    router.push('/profile/orders');
  };

  const handleContinueShopping = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Cargando confirmación...</p>
        </div>
      </div>
    );
  }

  if (error || !transactionDetails) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-slate-300">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-6">
            <svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-lg mb-4">{error || 'No se pudieron cargar los detalles de la transacción'}</p>
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
    <div className="min-h-screen bg-slate-900">
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
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            ¡Compra exitosa!
          </h1>
          
          <p className="text-slate-300 text-lg mb-4">
            Tu transacción fue aprobada y enviamos tu(s) QR(s) a tu correo electrónico.
          </p>

          {!transactionDetails.isFreeCheckout && (
            <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 max-w-md mx-auto mb-4">
              <p className="text-green-200 text-sm mb-1">
                <strong>Total pagado:</strong>
              </p>
              <p className="text-green-100 text-2xl font-bold">
                {formatPrice(transactionDetails.totalPaid || transactionDetails.actualTotal || transactionDetails.total)}
              </p>
            </div>
          )}
          
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 max-w-md mx-auto">
            <p className="text-slate-200 text-sm">
              <strong>¡Gracias por tu compra</strong>
            </p>
            <p className="text-slate-300 text-xs mt-1">
              Esta es tu confirmación oficial, guárdala o revisa tu correo.
            </p>
          </div>
        </div>

        {/* Transaction Details Card */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4 sm:p-6 mb-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-4 flex items-center">
            <Ticket className="h-5 w-5 mr-2" />
            Detalles de la Compra
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Transaction Info */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Número de transacción:</span>
                <span className="text-slate-100 font-mono text-xs sm:text-sm break-all">{transactionDetails.transactionId || 'No disponible'}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Estado:</span>
                <span className="text-green-400 font-medium text-sm sm:text-base">APROBADO</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Fecha de compra:</span>
                <span className="text-slate-100 text-sm sm:text-base">{formatDate(transactionDetails.purchaseDate)}</span>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Método de pago:</span>
                <span className="text-slate-100 flex items-center text-sm sm:text-base">
                  {transactionDetails.paymentMethod === 'FREE' ? (
                    <>
                      <span className="text-green-400 mr-1"></span>
                      Gratuito
                    </>
                  ) : transactionDetails.paymentMethod === 'CARD' ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      Tarjeta
                    </>
                  ) : transactionDetails.paymentMethod === 'PSE' ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      PSE
                    </>
                  ) : transactionDetails.paymentMethod === 'BANCOLOMBIA_TRANSFER' ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      Botón Bancolombia
                    </>
                  ) : transactionDetails.paymentMethod === 'NEQUI' ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      NEQUI
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-1" />
                      {transactionDetails.paymentMethod}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-slate-300 text-sm sm:text-base">Email:</span>
                <span className="text-slate-100 flex items-center text-sm sm:text-base break-all">
                  <Mail className="h-4 w-4 mr-1 flex-shrink-0" />
                  {transactionDetails.email}
                </span>
              </div>
              
              <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-3">
                <p className="text-blue-200 text-sm">
                  <strong>Confirmación enviada</strong><br />
                  Revisa tu correo electrónico para obtener tus códigos QR.
                </p>
              </div>
              
              <div className="bg-amber-900/20 border border-amber-500/50 rounded-lg p-3 mt-3">
                <p className="text-amber-200 text-sm">
                  <strong>Recuerda verificar tu bandeja de no deseados</strong> - Los emails pueden llegar ahí ocasionalmente
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="mt-6 pt-6 border-t border-slate-600">
            <h3 className="text-lg font-medium text-slate-100 mb-4">Resumen de Precios</h3>
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
        <div className={`grid gap-4 mb-8 ${user ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {user && (
            <button
              onClick={handleViewPurchases}
              className="flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-slate-100 py-3 px-4 rounded-lg transition-colors"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>Ver historial</span>
            </button>
          )}
          
          <button
            onClick={handleContinueShopping}
            className="flex items-center justify-center space-x-2 bg-slate-600 hover:bg-slate-500 text-slate-100 py-3 px-4 rounded-lg transition-colors"
          >
            <ExternalLink className="h-5 w-5" />
            <span>Explorar clubs</span>
          </button>
        </div>

        {/* Footer Reassurance */}
        <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg p-4 sm:p-6 text-center">
          <h3 className="text-slate-100 font-medium mb-2">¿Problemas con tu compra?</h3>
          <p className="text-slate-300 text-sm mb-4 px-2">
            Contáctanos en{' '}
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
