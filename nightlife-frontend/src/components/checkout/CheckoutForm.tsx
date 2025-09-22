'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useCartStore } from '@/stores/cart.store';
import { useUser } from '@/stores/auth.store';
import { 
  getAcceptanceTokens, 
  getPSEBanks, 
  initiateCheckout, 
  CheckoutInitiateRequest,
  WompiAcceptanceTokens,
  PSEBank 
} from '@/services/checkout.service';
import { CreditCard, Smartphone, Building2, ArrowRight, AlertCircle, CheckCircle, ShoppingCart, Ticket, Utensils } from 'lucide-react';
import CartItem from '@/components/cart/CartItem';

interface CheckoutFormProps {
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  className?: string;
}

export default function CheckoutForm({ onSuccess, onError, className = '' }: CheckoutFormProps) {
  const { 
    getCartSummary, 
    items, 
    getTicketItems, 
    getMenuItems, 
    getItemsByDate 
  } = useCartStore();
  const user = useUser();
  
  // Track render count to debug white flash
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  
  // Form state
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Acceptance tokens state
  const [acceptanceTokens, setAcceptanceTokens] = useState<WompiAcceptanceTokens | null>(null);
  const [acceptanceAccepted, setAcceptanceAccepted] = useState(false);
  const [personalDataAccepted, setPersonalDataAccepted] = useState(false);
  // Removed nightlifeTermsAccepted state - now using Amazon-style text with links
  
  // PSE banks state
  const [pseBanks, setPseBanks] = useState<PSEBank[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  
  // Payment method specific data - using placeholder values
  const [cardData, setCardData] = useState({
    number: '',
    cvc: '',
    exp_month: '',
    exp_year: '',
    card_holder: ''
  });
  
  const [nequiData, setNequiData] = useState({
    phone_number: ''
  });
  
  const [pseData, setPseData] = useState({
    user_type: 0,
    user_legal_id_type: 'CC' as 'CC' | 'CE' | 'NIT',
    user_legal_id: '',
    financial_institution_code: '',
    payment_description: 'Compra desde Nightlife App',
    phone_number: '',
    full_name: ''
  });
  
  const [bancolombiaData, setBancolombiaData] = useState({
    payment_description: 'Compra desde Nightlife App',
    ecommerce_url: ''
  });
  
  const [installments, setInstallments] = useState(1);
  
  // Cart summary - calculate on-the-fly to prevent re-render issues
  
  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []); // Only run once on mount
  
  // Pre-fill email when user is logged in
  useEffect(() => {
    if (user?.email && !email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  // Get base URL dynamically
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return process.env.NEXT_PUBLIC_FRONTEND_URL;
  };

  // Update Bancolombia Transfer ecommerce_url dynamically
  useEffect(() => {
    if (paymentMethod === 'BANCOLOMBIA_TRANSFER') {
      const baseUrl = getBaseUrl();
      setBancolombiaData(prev => ({
        ...prev,
        ecommerce_url: `${baseUrl}/payment-processing`
      }));
    }
  }, [paymentMethod]);
  
  const loadInitialData = async () => {
    try {
      // Don't refresh cart on mount - it should already be loaded
      // await refreshCart();
      
      // Cart summary will be calculated on-the-fly to prevent re-render issues
      const summary = getCartSummary();
      
      // Check if cart is empty - if so, don't load payment data
      if (!summary || !summary.items || summary.items.length === 0) {
        return;
      }
      
      // Check if this is a free checkout
      // Server summary uses 'total', client summary uses 'totalSubtotal'
      const isFreeCheckout = summary && (summary.total === 0 || summary.totalSubtotal === 0);
      
      if (isFreeCheckout) {
        // For free checkout, we don't need acceptance tokens or payment methods
        return;
      }
      
      // Load acceptance tokens for paid checkouts
      try {
        const tokens = await getAcceptanceTokens();
        setAcceptanceTokens(tokens);
      } catch (error) {
        console.error('Error loading acceptance tokens:', error);
        onError?.('Error loading payment data');
      }
      
      // Load PSE banks if PSE is selected
      if (paymentMethod === 'PSE') {
        await loadPSEBanks();
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      onError?.('Error loading checkout data');
    }
  };
  
  const loadPSEBanks = async () => {
    setLoadingBanks(true);
    try {
      const response = await getPSEBanks();
      if (response.success && response.data) {
        // Filter out instruction/placeholder entries
        const validBanks = response.data.filter(bank => 
          bank.financial_institution_name && 
          bank.financial_institution_code &&
          !bank.financial_institution_name.toLowerCase().includes('seleccione') &&
          !bank.financial_institution_name.toLowerCase().includes('selecciona') &&
          !bank.financial_institution_name.toLowerCase().includes('continuación') &&
          !bank.financial_institution_name.toLowerCase().includes('siguiente')
        );
        setPseBanks(validBanks);
      }
    } catch (error) {
      console.error('Error loading PSE banks:', error);
    } finally {
      setLoadingBanks(false);
    }
  };
  
  // Load PSE banks when PSE is selected
  useEffect(() => {
    if (paymentMethod === 'PSE' && pseBanks.length === 0) {
      loadPSEBanks();
    }
  }, [paymentMethod]);
  
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-numeric characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limitedPhoneNumber = phoneNumber.slice(0, 10);
    
    // Format as (XXX) XXX-XXXX
    if (limitedPhoneNumber.length === 0) return '';
    if (limitedPhoneNumber.length <= 3) return `(${limitedPhoneNumber}`;
    if (limitedPhoneNumber.length <= 6) return `(${limitedPhoneNumber.slice(0, 3)}) ${limitedPhoneNumber.slice(3)}`;
    return `(${limitedPhoneNumber.slice(0, 3)}) ${limitedPhoneNumber.slice(3, 6)}-${limitedPhoneNumber.slice(6)}`;
  };

  const formatCardNumber = (value: string) => {
    // Remove all non-numeric characters
    const cardNumber = value.replace(/\D/g, '');
    
    // Limit to 16 digits
    const limitedCardNumber = cardNumber.slice(0, 16);
    
    // Format as XXXX XXXX XXXX XXXX
    if (limitedCardNumber.length === 0) return '';
    if (limitedCardNumber.length <= 4) return limitedCardNumber;
    if (limitedCardNumber.length <= 8) return `${limitedCardNumber.slice(0, 4)} ${limitedCardNumber.slice(4)}`;
    if (limitedCardNumber.length <= 12) return `${limitedCardNumber.slice(0, 4)} ${limitedCardNumber.slice(4, 8)} ${limitedCardNumber.slice(8)}`;
    return `${limitedCardNumber.slice(0, 4)} ${limitedCardNumber.slice(4, 8)} ${limitedCardNumber.slice(8, 12)} ${limitedCardNumber.slice(12)}`;
  };

  const getUniqueDates = () => {
    const dates = new Set(items.map(item => item.date));
    return Array.from(dates).sort();
  };

  const getItemsByTypeAndDate = (itemType: 'ticket' | 'menu', date: string) => {
    return items.filter(item => item.itemType === itemType && item.date === date);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      onError?.('Email is required');
      return;
    }
    
    // Check if this is a free checkout
    // Server summary uses 'total', client summary uses 'totalSubtotal'
    const isFreeCheckout = currentCartSummary && (currentCartSummary.total === 0 || currentCartSummary.totalSubtotal === 0);
    
    // For paid checkouts, require all acceptance checkboxes
    if (!isFreeCheckout && (!acceptanceAccepted || !personalDataAccepted)) {
      onError?.('Debes aceptar todos los términos y condiciones para continuar');
      return;
    }
    
    // For free checkouts, no additional validation needed (Amazon-style terms acceptance)
    
    setIsSubmitting(true);
    
    try {
      let paymentData: any = {};
      let customerData: any = {};
      
      // For free checkout, use minimal payment data
      if (isFreeCheckout) {
        paymentData = {};
      } else {
        // Prepare payment data based on selected method
        switch (paymentMethod) {
          case 'CARD':
            paymentData = cardData;
            break;
          case 'NEQUI':
            paymentData = nequiData;
            break;
          case 'PSE':
            paymentData = {
              user_type: pseData.user_type,
              user_legal_id_type: pseData.user_legal_id_type,
              user_legal_id: pseData.user_legal_id,
              financial_institution_code: pseData.financial_institution_code,
              payment_description: pseData.payment_description,
            };
            customerData = {
              phone_number: pseData.phone_number,
              full_name: pseData.full_name,
            };
            break;
          case 'BANCOLOMBIA_TRANSFER':
            paymentData = bancolombiaData;
            break;
        }
      }
      
      // Determine redirect URL based on payment method
      const getRedirectUrl = () => {
        const baseUrl = getBaseUrl();
        
        // For redirect-based payment methods (PSE, Bancolombia Transfer), use processing page
        if (paymentMethod === 'PSE' || paymentMethod === 'BANCOLOMBIA_TRANSFER') {
          return `${baseUrl}/payment-processing`;
        }
        
        // For other payment methods, use success page
        return `${baseUrl}/payment-success`;
      };

      const request: CheckoutInitiateRequest = {
        email,
        paymentMethod: isFreeCheckout ? 'FREE' : paymentMethod,
        paymentData,
        installments: paymentMethod === 'CARD' ? installments : undefined,
        redirect_url: getRedirectUrl(),
        customer_data: Object.keys(customerData).length > 0 ? customerData : undefined,
        customerInfo: {
          fullName: customerData.full_name || 'Anonymous User',
          phoneNumber: customerData.phone_number || '',
          legalId: pseData.user_legal_id || '',
          legalIdType: pseData.user_legal_id_type || 'CC',
          paymentMethod: isFreeCheckout ? 'FREE' : paymentMethod,
        },
      };
      
      const result = await initiateCheckout(request);
      
      // Check if we have a transaction ID (successful initiation)
      if (result.transactionId) {
        // Check the actual transaction status from Wompi
        const wompiStatus = result.wompiStatus || result.status || 'APPROVED';
        
        // Store transaction details for the appropriate page
        const transactionDetails = {
          transactionId: result.transactionId || 'unknown',
          status: wompiStatus,
          totalPaid: result.totalPaid || result.actualTotal || currentCartSummary?.actualTotal || 0,
          isFreeCheckout: isFreeCheckout,
          paymentMethod: isFreeCheckout ? 'FREE' : paymentMethod,
          email: email,
          purchaseDate: new Date().toISOString(),
          items: items.map(item => ({
            id: item.id,
            name: item.itemType === 'ticket'
              ? item.ticket?.name || 'Unknown Ticket'
              : item.menuItem?.name || 'Unknown Menu Item',
            type: item.itemType,
            quantity: item.quantity,
            price: item.unitPrice,
            clubName: 'Unknown Club', // TODO: Get club name from clubId
            date: item.date,
            image: item.itemType === 'menu' ? item.menuItem?.imageUrl : undefined
          })),
          subtotal: result.subtotal || currentCartSummary?.totalSubtotal || 0,
          serviceFee: result.serviceFee || currentCartSummary?.operationalCosts || 0,
          discounts: result.discounts || 0,
          total: result.actualTotal || currentCartSummary?.actualTotal || 0,
          // Add specific fields for different statuses
          declineReason: wompiStatus === 'DECLINED' ? (result.declineReason || 'Fondos insuficientes') : undefined,
          errorCode: wompiStatus === 'ERROR' ? (result.errorCode || 'PAYMENT_ERROR') : undefined,
          errorMessage: wompiStatus === 'ERROR' ? (result.errorMessage || 'Error interno del procesador de pagos') : undefined,
          timeoutDuration: wompiStatus === 'TIMEOUT' ? (result.timeoutDuration || 30) : undefined
        };

        // Use both localStorage and sessionStorage for redundancy
        console.log('CheckoutForm - Storing transaction details:', transactionDetails);
        localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        
        // Handle PSE redirection
        if (result.requiresRedirect && result.redirectUrl && paymentMethod === 'PSE') {
          console.log('CheckoutForm - PSE payment requires redirection to:', result.redirectUrl);
          
          // Redirect directly to the bank's website for PSE payment
          console.log('CheckoutForm - Redirecting to PSE URL for bank payment');
          window.location.href = result.redirectUrl;
          return;
        }
        
        // Handle Bancolombia Transfer redirection
        if (result.requiresRedirect && result.redirectUrl && paymentMethod === 'BANCOLOMBIA_TRANSFER') {
          console.log('CheckoutForm - Bancolombia Transfer payment requires redirection to:', result.redirectUrl);
          
          // Redirect directly to Bancolombia's website for transfer payment
          console.log('CheckoutForm - Redirecting to Bancolombia Transfer URL for bank payment');
          window.location.href = result.redirectUrl;
          return;
        }
        
        // Add a small delay to ensure localStorage is written before redirect
        setTimeout(() => {
          onSuccess?.(result);
        }, 100);
      } else {
        // Check if the error is due to cart expiration
        if (result.error && result.error.includes('Carrito expirado')) {
          // Reload the page to clear expired cart state
          window.location.reload();
          return;
        }
        onError?.(result.error || 'Checkout failed');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      onError?.(error instanceof Error ? error.message : 'Checkout failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Get current cart summary - calculate on-the-fly to prevent re-render issues
  const currentCartSummary = getCartSummary();
  
  // Cart items change tracking (removed logging)
  
  // Check if this is a free checkout
  // Server summary uses 'total', client summary uses 'totalSubtotal'
  const isFreeCheckout = currentCartSummary && (currentCartSummary.total === 0 || currentCartSummary.totalSubtotal === 0);
  
  // Validate payment method specific fields
  const isPaymentMethodValid = () => {
    if (isFreeCheckout) return true;
    
    switch (paymentMethod) {
      case 'CARD':
        return cardData.number.length === 16 && 
               cardData.cvc.length === 3 && 
               cardData.exp_month.length >= 1 && 
               cardData.exp_year.length === 2 && 
               cardData.card_holder.trim().length > 0;
      
      case 'NEQUI':
        return nequiData.phone_number.length === 10;
      
      case 'PSE':
        return pseData.user_legal_id.length > 0 && 
               pseData.financial_institution_code.length > 0 && 
               pseData.full_name.trim().length > 0 && 
               pseData.phone_number.length === 10;
      
      case 'BANCOLOMBIA_TRANSFER':
        return true; // No user input required - fields are auto-populated
      
      default:
        return true;
    }
  };
  
  const isFormValid = email && (isFreeCheckout || (acceptanceAccepted && personalDataAccepted)) && isPaymentMethodValid();

  // Memoize cart items section to prevent unnecessary re-renders
  const cartItemsSection = useMemo(() => {
    if (isFreeCheckout) return null;
    
    return (
      <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-6">
        <h3 className="text-lg font-medium text-slate-100 mb-4">Resumen del Pedido</h3>
        
        {/* Items by Date */}
        {getUniqueDates().map(date => (
          <div key={date} className="space-y-3 mb-4">
            {/* Tickets for this date */}
            {getItemsByTypeAndDate('ticket', date).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-300 flex items-center">
                  <Ticket className="h-4 w-4 mr-2" />
                  Tickets
                </h4>
                <div className="space-y-1">
                  {getItemsByTypeAndDate('ticket', date).map(item => (
                    <CartItem key={item.id} item={item} showActions={true} />
                  ))}
                </div>
              </div>
            )}

            {/* Menu items for this date */}
            {getItemsByTypeAndDate('menu', date).length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-300 flex items-center">
                  <Utensils className="h-4 w-4 mr-2" />
                  Menú
                </h4>
                <div className="space-y-1">
                  {getItemsByTypeAndDate('menu', date).map(item => (
                    <CartItem key={item.id} item={item} showActions={true} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Price Summary */}
        {currentCartSummary && (
          <div className="border-t border-slate-700/60 pt-4">
            <div className="space-y-2">
              {(() => {
                // Check for unified summary in window (like CartSummary does)
                const windowSummaries = typeof window !== 'undefined' ? (window as any).cartSummaries : null;
                const unifiedSummary = windowSummaries?.unified;
                
                if (unifiedSummary) {
                  // Use unified cart summary (exactly like CartSummary)
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Costo de productos</span>
                        <span className="text-slate-100">{formatPrice(unifiedSummary.total || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">Tarifa de servicio</span>
                        <span className="text-slate-100">{formatPrice(unifiedSummary.operationalCosts || 0)}</span>
                      </div>
                      <div className="flex justify-between text-base font-medium border-t border-slate-700/60 pt-2">
                        <span className="text-slate-100">Total</span>
                        <span className="text-slate-100">{formatPrice(unifiedSummary.actualTotal || 0)}</span>
                      </div>
                    </div>
                  );
                } else {
                  // Fallback to simple total
                  return (
                    <div className="flex justify-between text-base font-medium">
                      <span className="text-slate-100">Total</span>
                      <span className="text-slate-100">{formatPrice(currentCartSummary.totalSubtotal || 0)}</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }, [items, isFreeCheckout]); // Remove currentCartSummary dependency to prevent double re-renders
  

  // Ensure acceptance tokens are loaded for paid checkouts
  useEffect(() => {
    const loadTokens = async () => {
      if (!isFreeCheckout && !acceptanceTokens) {
        try {
          const tokens = await getAcceptanceTokens();
          setAcceptanceTokens(tokens);
        } catch (error) {
          console.error('Error loading acceptance tokens in retry:', error);
        }
      }
    };
    
    loadTokens();
  }, [isFreeCheckout, acceptanceTokens]);
  
  
  // Removed isLoading check to prevent white flash during cart updates

  // Show empty cart message if cart is empty
  if (!currentCartSummary || !currentCartSummary.items || currentCartSummary.items.length === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-8 text-center">
          <ShoppingCart className="h-16 w-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-slate-100 mb-2">Tu carrito está vacío</h3>
          <p className="text-slate-300 mb-6">
            No tienes artículos en tu carrito. Agrega algunos productos para continuar con la compra.
          </p>
          <a
            href="/"
            className="inline-flex items-center px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
          >
            Explorar Clubes
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Input */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-6">
          <h3 className="text-lg font-medium text-slate-100 mb-4">Información de Contacto</h3>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
              Dirección de Email *
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 ${
                user?.email 
                  ? 'bg-slate-600 border-slate-500 cursor-not-allowed' 
                  : 'bg-slate-700 border-slate-600'
              } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              placeholder="tu@email.com"
              required
              readOnly={!!user?.email}
              disabled={isSubmitting}
            />
            <p className="text-xs text-slate-400 mt-1">
              {user?.email 
                ? 'Te enviaremos tus QR\'s y recibos a este email'
                : 'Te enviaremos tus QR\'s y recibos a este email'
              }
            </p>
          </div>
        </div>
        
         {/* Payment Method Selection - Only for paid checkouts */}
         {!isFreeCheckout && (
           <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-6">
             <h3 className="text-lg font-medium text-slate-100 mb-4">Método de Pago</h3>
             <div className="space-y-3 mb-6">
               {[
                 { value: 'CARD', label: 'Tarjeta de Crédito/Débito', icon: CreditCard },
                 { value: 'NEQUI', label: 'Nequi', icon: Smartphone },
                 { value: 'PSE', label: 'PSE', icon: Building2 },
                 { value: 'BANCOLOMBIA_TRANSFER', label: 'Transferencia Bancolombia', icon: Building2 },
               ].map(({ value, label, icon: Icon }) => (
                 <button
                   key={value}
                   type="button"
                   onClick={() => {
                     if (isSubmitting) return;
                     setPaymentMethod(value);
                     // Clear all form data when switching payment methods
                     setCardData({
                       number: '',
                       cvc: '',
                       exp_month: '',
                       exp_year: '',
                       card_holder: ''
                     });
                     setNequiData({
                       phone_number: ''
                     });
                     setPseData({
                       user_type: 0,
                       user_legal_id_type: 'CC' as 'CC' | 'CE' | 'NIT',
                       user_legal_id: '',
                       financial_institution_code: '',
                       payment_description: 'Compra desde Nightlife App',
                       phone_number: '',
                       full_name: ''
                     });
                     setInstallments(1);
                   }}
                   className={`w-full p-4 border rounded-lg text-left transition-colors flex items-center space-x-3 ${
                     paymentMethod === value
                       ? 'border-violet-500 bg-violet-500/10 text-violet-100'
                       : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
                   } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                   disabled={isSubmitting}
                 >
                   <Icon className="h-5 w-5 flex-shrink-0" />
                   <div className="text-sm font-medium">{label}</div>
                 </button>
               ))}
             </div>
             
             {/* Payment Method Specific Fields */}
             {paymentMethod === 'CARD' && (
               <div className="space-y-4">
                 <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Número de Tarjeta</label>
                     <div className="relative">
                       <input
                         type="text"
                         value={formatCardNumber(cardData.number)}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const rawNumber = e.target.value.replace(/\D/g, '').slice(0, 16);
                           setCardData({ ...cardData, number: rawNumber });
                         }}
                         className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="0000 0000 0000 0000"
                         maxLength={19}
                         disabled={isSubmitting}
                       />
                       {!cardData.number && (
                         <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                           <span className="text-slate-400">0000 0000 0000 0000</span>
                         </div>
                       )}
                     </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="block text-sm font-medium text-slate-300 mb-2">CVC</label>
                       <div className="relative">
                         <input
                           type="text"
                           value={cardData.cvc}
                           onChange={(e) => {
                             if (isSubmitting) return;
                             const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                             setCardData({ ...cardData, cvc: value });
                           }}
                           className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                           placeholder="000"
                           maxLength={3}
                           disabled={isSubmitting}
                         />
                         {!cardData.cvc && (
                           <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                             <span className="text-slate-400">000</span>
                           </div>
                         )}
                       </div>
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-slate-300 mb-2">Vencimiento</label>
                       <div className="grid grid-cols-2 gap-2">
                         <div className="relative">
                           <input
                             type="text"
                             value={cardData.exp_month}
                             onChange={(e) => {
                               if (isSubmitting) return;
                               const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                               // Allow empty, single digits (0-9), or double digits (01-12)
                               if (value === '' || 
                                   (value.length === 1 && parseInt(value) >= 0 && parseInt(value) <= 9) ||
                                   (value.length === 2 && parseInt(value) >= 1 && parseInt(value) <= 12)) {
                                 setCardData({ ...cardData, exp_month: value });
                               }
                             }}
                             className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                             placeholder="MM"
                             maxLength={2}
                             disabled={isSubmitting}
                           />
                           {!cardData.exp_month && (
                             <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                               <span className="text-slate-400">MM</span>
                             </div>
                           )}
                         </div>
                         <div className="relative">
                           <input
                             type="text"
                             value={cardData.exp_year}
                             onChange={(e) => {
                               if (isSubmitting) return;
                               const value = e.target.value.replace(/\D/g, '').slice(0, 2);
                               setCardData({ ...cardData, exp_year: value });
                             }}
                             className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                             placeholder="AA"
                             maxLength={2}
                             disabled={isSubmitting}
                           />
                           {!cardData.exp_year && (
                             <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                               <span className="text-slate-400">AA</span>
                             </div>
                           )}
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Cuotas</label>
                     <select
                       value={installments}
                       onChange={(e) => {
                         if (isSubmitting) return;
                         setInstallments(parseInt(e.target.value));
                       }}
                       className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                       disabled={isSubmitting}
                     >
                       <option key="installments-1" value={1}>1 Mes</option>
                       <option key="installments-2" value={2}>2 Meses</option>
                       <option key="installments-3" value={3}>3 Meses</option>
                       <option key="installments-6" value={6}>6 Meses</option>
                       <option key="installments-12" value={12}>12 Meses</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Titular</label>
                     <div className="relative">
                       <input
                         type="text"
                         value={cardData.card_holder}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50);
                           setCardData({ ...cardData, card_holder: value });
                         }}
                         className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="Nombre Completo"
                         maxLength={50}
                         disabled={isSubmitting}
                       />
                       {!cardData.card_holder && (
                         <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                           <span className="text-slate-400">Nombre Completo</span>
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
               </div>
             )}
             
             {paymentMethod === 'NEQUI' && (
               <div>
                 <label className="block text-sm font-medium text-slate-300 mb-2">Número de Teléfono</label>
                 <div className="relative">
                   <input
                     type="text"
                     value={formatPhoneNumber(nequiData.phone_number)}
                     onChange={(e) => {
                       if (isSubmitting) return;
                       const formatted = formatPhoneNumber(e.target.value);
                       const rawNumber = e.target.value.replace(/\D/g, '');
                       setNequiData({ ...nequiData, phone_number: rawNumber });
                     }}
                     className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                     placeholder="(XXX) XXX-XXXX"
                     maxLength={14}
                     disabled={isSubmitting}
                   />
                   {!nequiData.phone_number && (
                     <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                       <span className="text-slate-400">(XXX) XXX-XXXX</span>
                     </div>
                   )}
                 </div>
               </div>
             )}
             
             {paymentMethod === 'PSE' && (
               <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-200 mb-2">Tipo de Usuario</label>
                     <select
                       value={pseData.user_type}
                       onChange={(e) => {
                         if (isSubmitting) return;
                         setPseData({ ...pseData, user_type: parseInt(e.target.value) });
                       }}
                       className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                       disabled={isSubmitting}
                     >
                       <option key="user-type-0" value={0}>Persona Natural</option>
                       <option key="user-type-1" value={1}>Empresa</option>
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-200 mb-2">Tipo de Documento</label>
                     <select
                       value={pseData.user_legal_id_type}
                       onChange={(e) => {
                         if (isSubmitting) return;
                         setPseData({ ...pseData, user_legal_id_type: e.target.value as 'CC' | 'CE' | 'NIT' });
                       }}
                       className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                       disabled={isSubmitting}
                     >
                       <option key="doc-type-CC" value="CC">Cédula de Ciudadanía</option>
                       <option key="doc-type-CE" value="CE">Cédula de Extranjería</option>
                       <option key="doc-type-NIT" value="NIT">NIT</option>
                     </select>
                   </div>
                 </div>
                 <div className="space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Número de Documento</label>
                     <div className="relative">
                       <input
                         type="text"
                         value={pseData.user_legal_id}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const value = e.target.value.replace(/\D/g, '').slice(0, 20);
                           setPseData({ ...pseData, user_legal_id: value });
                         }}
                         className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="00000000000000000000"
                         maxLength={20}
                         disabled={isSubmitting}
                       />
                       {!pseData.user_legal_id && (
                         <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                           <span className="text-slate-400">00000000000000000000</span>
                         </div>
                       )}
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Banco</label>
                     <select
                       value={pseData.financial_institution_code}
                       onChange={(e) => {
                         if (isSubmitting) return;
                         setPseData({ ...pseData, financial_institution_code: e.target.value });
                       }}
                       className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                       disabled={loadingBanks || isSubmitting}
                     >
                       <option key="bank-placeholder" value="">{loadingBanks ? 'Cargando bancos...' : 'Selecciona un banco...'}</option>
                       {pseBanks.map((bank, index) => (
                         <option key={`bank-${bank.financial_institution_code}-${index}`} value={bank.financial_institution_code}>{bank.financial_institution_name}</option>
                       ))}
                     </select>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Nombre Completo</label>
                     <div className="relative">
                       <input
                         type="text"
                         value={pseData.full_name}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50);
                           setPseData({ ...pseData, full_name: value });
                         }}
                         className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="Nombre Completo"
                         maxLength={50}
                         disabled={isSubmitting}
                       />
                       {!pseData.full_name && (
                         <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                           <span className="text-slate-400">Nombre Completo</span>
                         </div>
                       )}
                     </div>
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-slate-300 mb-2">Número de Teléfono</label>
                     <div className="relative">
                       <input
                         type="text"
                         value={formatPhoneNumber(pseData.phone_number)}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const rawNumber = e.target.value.replace(/\D/g, '');
                           setPseData({ ...pseData, phone_number: rawNumber });
                         }}
                         className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="(XXX) XXX-XXXX"
                         maxLength={14}
                         disabled={isSubmitting}
                       />
                       {!pseData.phone_number && (
                         <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                           <span className="text-slate-400">(XXX) XXX-XXXX</span>
                         </div>
                       )}
                     </div>
                   </div>
                 </div>
                 
                 {/* PSE Payment Notice */}
                 <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                   <div className="flex items-start space-x-3">
                     <div className="flex-shrink-0">
                       <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                     </div>
                     <div className="text-sm">
                       <p className="text-blue-200 font-medium mb-1">Pago PSE</p>
                       <p className="text-blue-300">
                         Al procesar el pago, serás redirigido a tu banco para completar la transacción. 
                         Una vez finalizado el pago, serás redirigido automáticamente de vuelta a nuestra aplicación.
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
             )}
             
             {paymentMethod === 'BANCOLOMBIA_TRANSFER' && (
               <div className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-slate-300 mb-2">Descripción del Pago</label>
                   <div className="relative">
                     <input
                       type="text"
                       value={bancolombiaData.payment_description}
                       className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-slate-300 cursor-not-allowed"
                       disabled={true}
                       readOnly
                     />
                   </div>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-300 mb-2">URL de Ecommerce</label>
                   <div className="relative">
                     <input
                       type="url"
                       value={bancolombiaData.ecommerce_url}
                       className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-lg text-slate-300 cursor-not-allowed"
                       disabled={true}
                       readOnly
                     />
                   </div>
                 </div>
                 
                 {/* Bancolombia Transfer Payment Notice */}
                 <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                   <div className="flex items-start space-x-3">
                     <div className="flex-shrink-0">
                       <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                     </div>
                     <div className="text-sm">
                       <p className="text-blue-200 font-medium mb-1">Transferencia Bancolombia</p>
                       <p className="text-blue-300">
                         Al procesar el pago, serás redirigido a Bancolombia para completar la transferencia. 
                         Una vez finalizado el pago, serás redirigido automáticamente de vuelta a nuestra aplicación.
                       </p>
                     </div>
                   </div>
                 </div>
               </div>
             )}
           </div>
         )}

        {/* Cart Items - Only for paid checkouts */}
        {cartItemsSection}
        
        
        {/* Acceptance Tokens - Required by Wompi - Only for paid checkouts */}
        {!isFreeCheckout && acceptanceTokens && (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="acceptance"
                  checked={acceptanceAccepted}
                  onChange={(e) => {
                    if (isSubmitting) return;
                    setAcceptanceAccepted(e.target.checked);
                  }}
                  className={`mt-1 h-6 w-6 sm:h-5 sm:w-5 text-violet-600 border-slate-600 rounded focus:ring-violet-500 bg-slate-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={isSubmitting}
                />
                <label htmlFor="acceptance" className="text-sm text-slate-300 cursor-pointer">
                  Acepto haber leído los{' '}
                  <a
                    href={acceptanceTokens.data.presigned_acceptance.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline font-bold"
                  >
                    reglamentos
                  </a>
                  {' '}y la{' '}
                  <a
                    href={acceptanceTokens.data.presigned_personal_data_auth.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline font-bold"
                  >
                    política de privacidad
                  </a>
                  {' '}para hacer este pago.
                </label>
              </div>
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="personalData"
                  checked={personalDataAccepted}
                  onChange={(e) => {
                    if (isSubmitting) return;
                    setPersonalDataAccepted(e.target.checked);
                  }}
                  className={`mt-1 h-6 w-6 sm:h-5 sm:w-5 text-violet-600 border-slate-600 rounded focus:ring-violet-500 bg-slate-700 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={isSubmitting}
                />
                <label htmlFor="personalData" className="text-sm text-slate-300 cursor-pointer">
                  Acepto la{' '}
                  <a
                    href={acceptanceTokens.data.presigned_personal_data_auth.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline font-bold"
                  >
                    autorización para la administración de datos personales
                  </a>
                </label>
              </div>
            </div>
          </div>
        )}
        
        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <span>Completar Compra</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        
        {/* Nightlife Terms - Amazon-style text with links */}
        <div className="text-xs text-slate-400 text-center mt-4">
          Al realizar la compra, aceptas los{' '}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline"
          >
            Terminos de Servicio
          </a>
          {' '}y la{' '}
          <a
            href="/terms/purchase"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:text-violet-300 underline"
          >
            Política de Privacidad
          </a>
          {' '}de Nightlife.
        </div>
      </form>
    </div>
  );
}
