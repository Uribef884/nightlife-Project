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
import { storeCheckoutSummary } from '@/utils/checkoutSummary';

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
    getItemsByDate,
    clearCart
  } = useCartStore();
  const user = useUser();
  
  // Track render count to debug white flash
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  
  // Form state
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  
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

  // Load PSE banks when cart becomes available and PSE is selected
  useEffect(() => {
    const summary = getCartSummary();
    if (summary && summary.items && summary.items.length > 0 && paymentMethod === 'PSE') {
      const isFreeCheckout = summary && (summary.total === 0 || summary.totalSubtotal === 0);
      if (!isFreeCheckout && pseBanks.length === 0) {
        loadPSEBanks();
      }
    }
  }, [items, paymentMethod, pseBanks.length]); // Watch for cart changes and payment method
  
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
        ecommerce_url: `${baseUrl}/checkout/processing`
      }));
    }
  }, [paymentMethod]);
  
  const loadInitialData = async () => {
    try {
      // Load acceptance tokens immediately - they're needed for the UI regardless of cart state
      if (!acceptanceTokens) {
        try {
          const tokens = await getAcceptanceTokens();
          setAcceptanceTokens(tokens);
        } catch (error) {
          console.error('Error loading acceptance tokens:', error);
          onError?.('Error loading payment data');
        }
      }
      
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
        // For free checkout, we don't need PSE banks
        return;
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

  const formatExpiryDate = (month: string, year: string) => {
    if (!month && !year) return '';
    if (!month && !year) return '';
    
    // If we have both month and year, format as MM/YY
    if (month && year) {
      return `${month}/${year}`;
    }
    
    // If we only have month (user is typing), show just the month
    if (month && !year) {
      return month;
    }
    
    // If we only have year (shouldn't happen in normal flow), show just the year
    if (!month && year) {
      return year;
    }
    
    return '';
  };

  const formatExpiryDateInput = (value: string) => {
    // Remove all non-numeric characters
    const digits = value.replace(/\D/g, '');
    
    // Limit to 4 digits (MMYY)
    const limitedDigits = digits.slice(0, 4);
    
    if (limitedDigits.length === 0) {
      return { month: '', year: '' };
    }
    
    const month = limitedDigits.slice(0, 2);
    const year = limitedDigits.slice(2, 4);
    
    // Let user type whatever they want - validation only happens on submit
    return {
      month: month,
      year: year
    };
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
    setError(null); // Clear any previous errors
    setHasTriedSubmit(true); // Mark that user has attempted to submit
    
    // Store checkout summary with correct pricing data before proceeding
    storeCheckoutSummary();
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      const errorMessage = 'Email es requerido';
      setError(errorMessage);
      onError?.(errorMessage);
      // Scroll to email field
      document.getElementById('email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!emailRegex.test(email)) {
      const errorMessage = 'Formato de email inválido';
      setError(errorMessage);
      onError?.(errorMessage);
      // Scroll to email field
      document.getElementById('email')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    // Check if this is a free checkout
    // Server summary uses 'total', client summary uses 'totalSubtotal'
    const isFreeCheckout = currentCartSummary && (currentCartSummary.total === 0 || currentCartSummary.totalSubtotal === 0);
    
    // For paid checkouts, require all acceptance checkboxes
    if (!isFreeCheckout && (!acceptanceAccepted || !personalDataAccepted)) {
      onError?.('Debes aceptar todos los términos y condiciones para continuar');
      // Scroll to acceptance checkboxes
      document.getElementById('acceptance')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    
    // Validate payment method specific fields for paid checkouts
    if (!isFreeCheckout && !isPaymentMethodValid()) {
      let errorMessage = '';
      let fieldToScrollTo = '';
      
      switch (paymentMethod) {
        case 'CARD':
          if (cardData.number.length !== 16) {
            errorMessage = 'Número de tarjeta inválido';
            fieldToScrollTo = 'card-number';
          } else if (cardData.cvc.length !== 3) {
            errorMessage = 'CVC inválido';
            fieldToScrollTo = 'card-cvc';
          } else if (cardData.exp_month.length < 1 || cardData.exp_year.length < 1) {
            errorMessage = 'Fecha de vencimiento requerida';
            fieldToScrollTo = 'card-expiry';
          } else if (cardData.exp_month.length === 2 && (parseInt(cardData.exp_month) < 1 || parseInt(cardData.exp_month) > 12)) {
            errorMessage = 'Fecha de vencimiento inválida';
            fieldToScrollTo = 'card-expiry';
          } else if (cardData.exp_year.length === 2 && parseInt(cardData.exp_year) < (new Date().getFullYear() % 100)) {
            errorMessage = 'Fecha de vencimiento inválida';
            fieldToScrollTo = 'card-expiry';
          } else if (cardData.card_holder.trim().length === 0) {
            errorMessage = 'Nombre del titular es requerido';
            fieldToScrollTo = 'cardholder-name';
          }
          break;
        case 'NEQUI':
          if (nequiData.phone_number.length !== 10) {
            errorMessage = 'Número de teléfono inválido';
            fieldToScrollTo = 'nequi-phone';
          }
          break;
        case 'PSE':
          if (pseData.user_legal_id.length === 0) {
            errorMessage = 'Número de documento es requerido';
            fieldToScrollTo = 'pse-legal-id';
          } else if (pseData.financial_institution_code.length === 0) {
            errorMessage = 'Debes seleccionar un banco';
            fieldToScrollTo = 'pse-bank';
          } else if (pseData.full_name.trim().length === 0) {
            errorMessage = 'Nombre completo es requerido';
            fieldToScrollTo = 'pse-full-name';
          } else if (pseData.phone_number.length !== 10) {
            errorMessage = 'Número de teléfono inválido';
            fieldToScrollTo = 'pse-phone';
          }
          break;
      }
      
      onError?.(errorMessage || 'Información de pago incompleta');
      
      // Scroll to the first invalid field
      if (fieldToScrollTo) {
        setTimeout(() => {
          document.getElementById(fieldToScrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
      
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
          return `${baseUrl}/checkout/processing`;
        }
        
        // For other payment methods, use success page
        return `${baseUrl}/checkout/success`;
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
        localStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        sessionStorage.setItem('lastTransactionDetails', JSON.stringify(transactionDetails));
        
        // Handle PSE redirection
        if (result.requiresRedirect && result.redirectUrl && paymentMethod === 'PSE') {
          // Redirect directly to the bank's website for PSE payment
          window.location.href = result.redirectUrl;
          return;
        }

        // Handle Bancolombia Transfer redirection
        if (result.requiresRedirect && result.redirectUrl && paymentMethod === 'BANCOLOMBIA_TRANSFER') {
          // Redirect directly to Bancolombia's website for transfer payment
          window.location.href = result.redirectUrl;
          return;
        }
        
        // Note: Cart clearing is now handled in checkout/page.tsx based on transaction status
        
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
        const errorMessage = result.error || 'Checkout failed';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
      setError(errorMessage);
      onError?.(errorMessage);
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
        const isExpMonthValid = cardData.exp_month.length === 2 && 
                               parseInt(cardData.exp_month) >= 1 && 
                               parseInt(cardData.exp_month) <= 12;
        const isExpYearValid = cardData.exp_year.length === 2 && 
                              parseInt(cardData.exp_year) >= (new Date().getFullYear() % 100);
        
        return cardData.number.length === 16 && 
               cardData.cvc.length === 3 && 
               isExpMonthValid && 
               isExpYearValid && 
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
  
  // Helper functions to determine if fields should show red highlighting
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailInvalid = hasTriedSubmit && (!email || !emailRegex.test(email));
  const isCardNumberInvalid = hasTriedSubmit && paymentMethod === 'CARD' && cardData.number.length !== 16;
  const isCardCvcInvalid = hasTriedSubmit && paymentMethod === 'CARD' && cardData.cvc.length !== 3;
  const isCardExpiryInvalid = hasTriedSubmit && paymentMethod === 'CARD' && (
    cardData.exp_month.length < 1 || 
    cardData.exp_year.length < 1 ||
    (cardData.exp_month.length === 2 && (parseInt(cardData.exp_month) < 1 || parseInt(cardData.exp_month) > 12)) ||
    (cardData.exp_year.length === 2 && parseInt(cardData.exp_year) < (new Date().getFullYear() % 100))
  );
  const isCardHolderInvalid = hasTriedSubmit && paymentMethod === 'CARD' && cardData.card_holder.trim().length === 0;
  const isNequiPhoneInvalid = hasTriedSubmit && paymentMethod === 'NEQUI' && nequiData.phone_number.length !== 10;
  const isPseLegalIdInvalid = hasTriedSubmit && paymentMethod === 'PSE' && pseData.user_legal_id.length === 0;
  const isPseBankInvalid = hasTriedSubmit && paymentMethod === 'PSE' && pseData.financial_institution_code.length === 0;
  const isPseFullNameInvalid = hasTriedSubmit && paymentMethod === 'PSE' && pseData.full_name.trim().length === 0;
  const isPsePhoneInvalid = hasTriedSubmit && paymentMethod === 'PSE' && pseData.phone_number.length !== 10;
  const isAcceptanceInvalid = hasTriedSubmit && !isFreeCheckout && !acceptanceAccepted;
  const isPersonalDataInvalid = hasTriedSubmit && !isFreeCheckout && !personalDataAccepted;

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
      
        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on" noValidate>
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
               name="email"
               value={email}
               onChange={(e) => {
                 if (user?.email) return; // Don't allow changes if user is logged in
                 setEmail(e.target.value);
                 setHasTriedSubmit(false); // Clear validation state when user types
               }}
               className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 ${
                 isEmailInvalid 
                   ? 'border-red-500 bg-red-900/20 focus:ring-red-500' 
                   : user?.email 
                     ? 'bg-slate-600 border-slate-500 text-slate-300 cursor-not-allowed' 
                     : 'bg-slate-700 border-slate-600 focus:ring-violet-500'
               } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
               placeholder="tu@email.com"
               autoComplete="email"
               required
               disabled={isSubmitting || !!user?.email}
               readOnly={!!user?.email}
             />
            <p className="text-xs text-slate-400 mt-1">
              {user?.email 
                ? 'Te enviaremos tus QR\'s y recibos a este email de tu cuenta'
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
                 { value: 'BANCOLOMBIA_TRANSFER', label: 'Botón  Bancolombia', icon: Building2 },
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
                         name="card-number"
                         id="card-number"
                         value={formatCardNumber(cardData.number)}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const rawNumber = e.target.value.replace(/\D/g, '').slice(0, 16);
                           setCardData({ ...cardData, number: rawNumber });
                           setHasTriedSubmit(false); // Clear validation state when user types
                         }}
                         className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                           isCardNumberInvalid 
                             ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                             : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                         } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="0000 0000 0000 0000"
                         autoComplete="cc-number"
                         inputMode="numeric"
                         pattern="[0-9\s]{13,19}"
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
                           name="card-cvc"
                           id="card-cvc"
                           value={cardData.cvc}
                           onChange={(e) => {
                             if (isSubmitting) return;
                             const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                             setCardData({ ...cardData, cvc: value });
                             setHasTriedSubmit(false); // Clear validation state when user types
                           }}
                           className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                             isCardCvcInvalid 
                               ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                               : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                           } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                           placeholder="000"
                           autoComplete="cc-csc"
                           inputMode="numeric"
                           pattern="[0-9]{3,4}"
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
                       <div className="relative">
                         <input
                           type="text"
                           name="card-expiry"
                           id="card-expiry"
                           value={formatExpiryDate(cardData.exp_month, cardData.exp_year)}
                           onChange={(e) => {
                             if (isSubmitting) return;
                             const formatted = formatExpiryDateInput(e.target.value);
                             if (formatted) {
                               setCardData({ 
                                 ...cardData, 
                                 exp_month: formatted.month, 
                                 exp_year: formatted.year 
                               });
                               setHasTriedSubmit(false); // Clear validation state when user types
                             }
                           }}
                           className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                             isCardExpiryInvalid
                               ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                               : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                           } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                           placeholder="MM/AA"
                           autoComplete="cc-exp"
                           inputMode="numeric"
                           pattern="[0-9]{2}/[0-9]{2}"
                           maxLength={5}
                           disabled={isSubmitting}
                         />
                         {!cardData.exp_month && !cardData.exp_year && (
                           <div className="absolute inset-0 flex items-center px-3 pointer-events-none">
                             <span className="text-slate-400">MM/AA</span>
                           </div>
                         )}
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
                         name="cardholder-name"
                         id="cardholder-name"
                         value={cardData.card_holder}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50);
                           setCardData({ ...cardData, card_holder: value });
                           setHasTriedSubmit(false); // Clear validation state when user types
                         }}
                         className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                           isCardHolderInvalid 
                             ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                             : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                         } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="Nombre Completo"
                         autoComplete="cc-name"
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
                     type="tel"
                     name="nequi-phone"
                     value={formatPhoneNumber(nequiData.phone_number)}
                     onChange={(e) => {
                       if (isSubmitting) return;
                       const formatted = formatPhoneNumber(e.target.value);
                       const rawNumber = e.target.value.replace(/\D/g, '');
                       setNequiData({ ...nequiData, phone_number: rawNumber });
                       setHasTriedSubmit(false); // Clear validation state when user types
                     }}
                     className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                       isNequiPhoneInvalid 
                         ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                         : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                     } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                     placeholder="(XXX) XXX-XXXX"
                     autoComplete="tel"
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
                         id="pse-legal-id"
                         value={pseData.user_legal_id}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const value = e.target.value.replace(/\D/g, '').slice(0, 20);
                           setPseData({ ...pseData, user_legal_id: value });
                           setHasTriedSubmit(false); // Clear validation state when user types
                         }}
                         className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                           isPseLegalIdInvalid 
                             ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                             : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                         } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                       id="pse-bank"
                       value={pseData.financial_institution_code}
                       onChange={(e) => {
                         if (isSubmitting) return;
                         setPseData({ ...pseData, financial_institution_code: e.target.value });
                         setHasTriedSubmit(false); // Clear validation state when user types
                       }}
                       className={`w-full px-3 py-2 border rounded-lg text-slate-100 focus:outline-none focus:ring-2 ${
                         isPseBankInvalid 
                           ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                           : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                       } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                         id="pse-full-name"
                         name="pse-full-name"
                         value={pseData.full_name}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '').slice(0, 50);
                           setPseData({ ...pseData, full_name: value });
                           setHasTriedSubmit(false); // Clear validation state when user types
                         }}
                         className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                           isPseFullNameInvalid 
                             ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                             : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                         } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="Nombre Completo"
                         autoComplete="name"
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
                         type="tel"
                         id="pse-phone"
                         name="pse-phone"
                         value={formatPhoneNumber(pseData.phone_number)}
                         onChange={(e) => {
                           if (isSubmitting) return;
                           const rawNumber = e.target.value.replace(/\D/g, '');
                           setPseData({ ...pseData, phone_number: rawNumber });
                           setHasTriedSubmit(false); // Clear validation state when user types
                         }}
                         className={`w-full px-3 py-2 border rounded-lg text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                           isPsePhoneInvalid 
                             ? 'border-red-500 bg-red-900/20 focus:ring-red-500 focus:border-red-500' 
                             : 'bg-slate-700 border-slate-600 focus:ring-violet-500 focus:border-violet-500'
                         } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                         placeholder="(XXX) XXX-XXXX"
                         autoComplete="tel"
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
                 {/* Bancolombia Transfer Payment Notice */}
                 <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
                   <div className="flex items-start space-x-3">
                     <div className="flex-shrink-0">
                       <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                       </svg>
                     </div>
                     <div className="text-sm">
                       <p className="text-blue-200 font-medium mb-1">Botón  Bancolombia</p>
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
              <div className={`flex items-start space-x-3 ${isAcceptanceInvalid ? 'ring-2 ring-red-500 ring-opacity-50 rounded-lg p-2 bg-red-900/10' : ''}`}>
                <input
                  type="checkbox"
                  id="acceptance"
                  checked={acceptanceAccepted}
                  onChange={(e) => {
                    if (isSubmitting) return;
                    setAcceptanceAccepted(e.target.checked);
                    setHasTriedSubmit(false); // Clear validation state when user checks
                  }}
                  className={`mt-1 h-6 w-6 sm:h-5 sm:w-5 text-violet-600 rounded focus:ring-violet-500 ${
                    isAcceptanceInvalid 
                      ? 'border-red-500 bg-red-900/20' 
                      : 'border-slate-600 bg-slate-700'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={isSubmitting}
                />
                <label htmlFor="acceptance" className="text-sm text-slate-300 cursor-pointer">
                  Acepto haber leído los{' '}
                  <a
                    href={acceptanceTokens.presigned_acceptance.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline font-bold"
                  >
                    reglamentos
                  </a>
                  {' '}y la{' '}
                  <a
                    href={acceptanceTokens.presigned_personal_data_auth.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline font-bold"
                  >
                    política de privacidad
                  </a>
                  {' '}para hacer este pago.
                </label>
              </div>
              <div className={`flex items-start space-x-3 ${isPersonalDataInvalid ? 'ring-2 ring-red-500 ring-opacity-50 rounded-lg p-2 bg-red-900/10' : ''}`}>
                <input
                  type="checkbox"
                  id="personalData"
                  checked={personalDataAccepted}
                  onChange={(e) => {
                    if (isSubmitting) return;
                    setPersonalDataAccepted(e.target.checked);
                    setHasTriedSubmit(false); // Clear validation state when user checks
                  }}
                  className={`mt-1 h-6 w-6 sm:h-5 sm:w-5 text-violet-600 rounded focus:ring-violet-500 ${
                    isPersonalDataInvalid 
                      ? 'border-red-500 bg-red-900/20' 
                      : 'border-slate-600 bg-slate-700'
                  } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={isSubmitting}
                />
                <label htmlFor="personalData" className="text-sm text-slate-300 cursor-pointer">
                  Acepto la{' '}
                  <a
                    href={acceptanceTokens.presigned_personal_data_auth.permalink}
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
          disabled={isSubmitting}
          className="w-full text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
        
        {/* Error Display - Below Terms and Privacy Policy */}
        {error && (
          <div className="mt-4 bg-red-900/20 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
      </form>
    </div>
  );
}
