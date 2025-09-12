import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { CartItem } from "../entities/TicketCartItem";
import { calculatePlatformFee, calculateGatewayFees } from "../utils/ticketfeeUtils";
import { isDisposableEmail } from "../utils/disposableEmailValidator";
import { differenceInMinutes } from "date-fns";
import { AuthenticatedRequest } from "../types/express";
import { computeDynamicPrice, computeDynamicEventPrice, getNormalTicketDynamicPricingReason, getEventTicketDynamicPricingReason } from "../utils/dynamicPricing";
import { getTicketCommissionRate } from "../config/fees";
import { sanitizeInput } from "../utils/sanitizeInput";
import { wompiService } from "../services/wompi.service";
import { WOMPI_CONFIG } from "../config/wompi";
import { generateTransactionSignature } from "../utils/generateWompiSignature";
import { PurchaseTransaction } from "../entities/TicketPurchaseTransaction";
// import { processWompiSuccessfulCheckout } from "./ticketCheckoutWompi.controller"; // DEPRECATED
import { lockAndValidateCart, updateCartLockTransactionId, unlockCart } from "../utils/cartLock";

// In-memory store for temporary transaction data (in production, use Redis)
const transactionStore = new Map<string, {
  userId: string | null;
  sessionId: string | null;
  email: string;
  cartItems: any[];
  totalAmount: number;
  acceptanceTokens: any;
  paymentSourceId?: string;
  expiresAt: number;
  // Enhanced customer information for better UX and compliance
  customerInfo: {
    fullName?: string;
    phoneNumber?: string;
    legalId?: string;
    legalIdType?: string;
    paymentMethod: string;
  };
}>();

export const initiateWompiTicketCheckout = async (req: Request, res: Response) => {
  const typedReq = req as AuthenticatedRequest;
  const userId = typedReq.user?.id ?? null;
  const sessionId: string | null = !userId && typedReq.sessionId ? typedReq.sessionId : null;
  
  // Sanitize email input
  const rawEmail = typedReq.user?.email ?? typedReq.body?.email;
  const sanitizedEmail = sanitizeInput(rawEmail);
  
  if (!sanitizedEmail) {
    return res.status(400).json({ error: "Valid email is required to complete checkout." });
  }
  
  const email = sanitizedEmail;

  if (!req.user && isDisposableEmail(email)) {
    return res.status(403).json({ error: "Disposable email domains are not allowed." });
  }

  const cartRepo = AppDataSource.getRepository(CartItem);
  const where = userId !== null ? { userId } : sessionId !== null ? { sessionId } : undefined;

  if (!where) {
    return res.status(400).json({ error: "Missing session or user" });
  }

  // 🔒 Lock and validate cart before proceeding with payment
  const tempTransactionId = "temp-" + Date.now();
  const cartValidation = await lockAndValidateCart(userId, sessionId, tempTransactionId, 'ticket');
  if (!cartValidation.success) {
    return res.status(400).json({ error: cartValidation.error });
  }
  
  const cartItems = cartValidation.cartItems!;

  // 🎯 Business rule: All items must be for the same date and club
  const firstItem = cartItems[0];
  const expectedClubId = firstItem.ticket.clubId;
  const expectedDate = firstItem.date;
  
  const invalidItems = cartItems.filter(item => 
    item.ticket.clubId !== expectedClubId || 
    item.date !== expectedDate
  );
  
  if (invalidItems.length > 0) {
    return res.status(400).json({ 
      error: "All items in cart must be for the same date and club" 
    });
  }

  const invalidTicket = cartItems.find((item) => !item.ticket.isActive);
  if (invalidTicket) {
    return res.status(400).json({
      error: `The ticket "${invalidTicket.ticket.name}" is no longer available for purchase.`,
    });
  }

  const allPricesAreValidNumbers = cartItems.every(
    (item) => !isNaN(Number(item.ticket.price))
  );

  if (!allPricesAreValidNumbers) {
    return res.status(400).json({ error: "Cart contains invalid ticket price types" });
  }

  const isFreeCheckout = cartItems.every((item) => Number(item.ticket.price) === 0);

  if (isFreeCheckout) {
    console.log("[WOMPI-TICKET-INITIATE] Free checkout detected. Processing immediately.");
    throw new Error('This endpoint has been deprecated. Use the unified checkout system instead.');
  }

  // Get payment method from request
  const { 
    paymentMethod, 
    paymentData, 
    installments = 1, 
    redirect_url,
    customer_data 
  } = req.body;
  
  if (!paymentMethod) {
    return res.status(400).json({ error: "Payment method is required" });
  }

  // Validate payment method specific data
  if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
    if (!paymentData || !paymentData.number || !paymentData.cvc || !paymentData.exp_month || !paymentData.exp_year || !paymentData.card_holder) {
      return res.status(400).json({ error: "Complete card data is required" });
    }
  } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
    if (!paymentData || !paymentData.phone_number) {
      return res.status(400).json({ error: "Phone number is required for Nequi payments" });
    }
  } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE) {
    if (!paymentData || !paymentData.user_legal_id || !paymentData.financial_institution_code || !customer_data?.full_name) {
      return res.status(400).json({ error: "Complete PSE data including customer info is required" });
    }
  } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
    if (!paymentData || !paymentData.payment_description) {
      return res.status(400).json({ error: "Payment description is required for Bancolombia Transfer" });
    }
  // } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.DAVIPLATA) { // DISABLED
  //   if (!paymentData || !paymentData.user_legal_id || !paymentData.user_legal_id_type) {
  //     return res.status(400).json({ error: "Legal ID data is required for Daviplata payments" });
  //   }
  } else if (!Object.values(WOMPI_CONFIG.PAYMENT_METHODS).includes(paymentMethod)) {
    return res.status(400).json({ error: "Unsupported payment method" });
  }

  // Enhanced customer information capture for better UX and compliance
  let customerInfo: {
    fullName?: string;
    phoneNumber?: string;
    legalId?: string;
    legalIdType?: string;
    paymentMethod: string;
  } = { paymentMethod };

  // Capture customer information based on payment method requirements
  if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
    // For cards, we can capture the cardholder name if provided
    if (paymentData?.card_holder) {
      customerInfo.fullName = paymentData.card_holder;
    }
  } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
    // Nequi requires phone number - save it
    customerInfo.phoneNumber = paymentData.phone_number;
    // If customer name is provided, save it too
    if (customer_data?.full_name) {
      customerInfo.fullName = customer_data.full_name;
    }
  } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE) {
    // PSE requires legal ID and full name - save them
    customerInfo.legalId = paymentData.user_legal_id;
    customerInfo.legalIdType = paymentData.user_legal_id_type || "CC";
    customerInfo.fullName = customer_data.full_name;
    // If phone number is provided, save it too
    if (customer_data?.phone_number) {
      customerInfo.phoneNumber = customer_data.phone_number;
    }
  } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
    // Bancolombia Transfer can benefit from customer name and phone if provided
    if (customer_data?.full_name) {
      customerInfo.fullName = customer_data.full_name;
    }
    if (customer_data?.phone_number) {
      customerInfo.phoneNumber = customer_data.phone_number;
    }
  }

  // Calculate totals (same logic as existing initiate controller)
  let total = 0;
  let totalWithPlatformFees = 0;
  
  for (const item of cartItems) {
    const ticket = item.ticket;
    const basePrice = Number(ticket.price);
    
    // Compute dynamic price based on ticket type and settings
    let dynamicPrice = basePrice;
    
    if (ticket.dynamicPricingEnabled) {
      if (ticket.category === "event" && ticket.event) {
        // Event ticket - use event's date and openHours for dynamic pricing
        dynamicPrice = computeDynamicEventPrice(Number(ticket.price), new Date(ticket.event.availableDate), ticket.event.openHours);
        
        // Check if event has passed grace period
        if (dynamicPrice === -1) {
          return res.status(400).json({ 
            error: `Event "${ticket.name}" has already started and is no longer available for purchase.` 
          });
        }
      } else if (ticket.category === "event" && ticket.availableDate) {
        // Fallback: Event ticket without event relation - use ticket's availableDate
        dynamicPrice = computeDynamicEventPrice(basePrice, new Date(ticket.availableDate));
        
        // Check if event has passed grace period
        if (dynamicPrice === -1) {
          return res.status(400).json({ 
            error: `Event "${ticket.name}" has already started and is no longer available for purchase.` 
          });
        }
      } else {
        // General ticket - use time-based dynamic pricing
        dynamicPrice = computeDynamicPrice({
          basePrice,
          clubOpenDays: ticket.club.openDays,
          openHours: ticket.club.openHours, // Pass the array directly, not a string
        });
      }
    } else if (ticket.category === "event") {
      // Grace period check for event tickets when dynamic pricing is disabled
      if (ticket.event) {
        const gracePeriodCheck = computeDynamicEventPrice(Number(ticket.price), new Date(ticket.event.availableDate), ticket.event.openHours);
        if (gracePeriodCheck === -1) {
          return res.status(400).json({ 
            error: `Event "${ticket.name}" has already started and is no longer available for purchase.` 
          });
        } else if (gracePeriodCheck > basePrice) {
          // If grace period price is higher than base price, use grace period price
          dynamicPrice = gracePeriodCheck;
        }
      } else if (ticket.availableDate) {
        const eventDate = new Date(ticket.availableDate);
        const gracePeriodCheck = computeDynamicEventPrice(basePrice, eventDate);
        if (gracePeriodCheck === -1) {
          return res.status(400).json({ 
            error: `Event "${ticket.name}" has already started and is no longer available for purchase.` 
          });
        } else if (gracePeriodCheck > basePrice) {
          // If grace period price is higher than base price, use grace period price
          dynamicPrice = gracePeriodCheck;
        }
      }
    }
    
    // Calculate platform fees per ticket
    const platformFee = calculatePlatformFee(dynamicPrice, getTicketCommissionRate(ticket.category === "event"));
    const itemTotalWithPlatformFee = dynamicPrice + platformFee;
    
    // Add to totals
    total += dynamicPrice * item.quantity;
    totalWithPlatformFees += itemTotalWithPlatformFee * item.quantity;
  }

  // Calculate gateway fees on the total amount
  const { totalGatewayFee, iva } = calculateGatewayFees(totalWithPlatformFees);
  const finalTotal = totalWithPlatformFees + totalGatewayFee + iva;

  // 🚫 Validate minimum transaction amount (Wompi requirement: 1500 COP)
  if (finalTotal < 1500) { // 1500 COP minimum
    console.log(`[WOMPI-TICKET-INITIATE] ❌ Cart total ${finalTotal} is below Wompi minimum (1500 COP). Unlocking cart.`);
    
    // Unlock the cart since we can't proceed
    try {
      await unlockCart(userId, sessionId);
      console.log(`[WOMPI-TICKET-INITIATE] 🔓 Cart unlocked due to insufficient amount`);
    } catch (unlockError) {
      console.warn(`[WOMPI-TICKET-INITIATE] Could not unlock cart:`, unlockError);
    }
    
    return res.status(400).json({ 
      error: "El monto mínimo de una transacción es $1,500 COP (exceptuando impuestos). Por favor, agrega más items a tu carrito.",
      details: `Total del carrito: $${finalTotal.toFixed(2)} COP, mínimo requerido: $1,500 COP`
    });
  }

  try {
    // Step 1: Get acceptance tokens
    const acceptanceTokens = await wompiService().getAcceptanceTokens();

    // Step 2: Tokenize payment method only for CARD
    let tokenResponse;
    let paymentSourceResponse;

    if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
      console.log("[WOMPI-TICKET-INITIATE] Tokenizing card...");
      tokenResponse = await wompiService().tokenizeCard(paymentData);
    } else if (!Object.values(WOMPI_CONFIG.PAYMENT_METHODS).includes(paymentMethod)) {
      return res.status(400).json({ error: "Unsupported payment method" });
    }

    // Step 3: Create payment source only for CARD
    if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD && tokenResponse) {
      console.log("[WOMPI-TICKET-INITIATE] Creating payment source...");
      paymentSourceResponse = await wompiService().createPaymentSource({
        type: paymentMethod,
        token: tokenResponse.data.id,
        customer_email: email,
        acceptance_token: acceptanceTokens.data.presigned_acceptance.acceptance_token,
        accept_personal_auth: acceptanceTokens.data.presigned_personal_data_auth.acceptance_token,
      });
    }

    // Step 4: Create transaction
    console.log("[WOMPI-TICKET-INITIATE] Creating transaction...");
    let transactionPayload: any = {
      amount_in_cents: Math.round(finalTotal * 100), // Convert to cents
      currency: "COP",
      reference: `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customer_email: email,
      acceptance_token: acceptanceTokens.data.presigned_acceptance.acceptance_token,
      accept_personal_auth: acceptanceTokens.data.presigned_personal_data_auth.acceptance_token,
    };

    // Persist a pending transaction for idempotent webhook handling
    try {
      const ticketTxRepo = AppDataSource.getRepository(PurchaseTransaction);
      const maybeExisting = await ticketTxRepo.findOne({ where: { paymentProviderReference: transactionPayload.reference } });
      if (!maybeExisting) {
        // Reconstruct totals for club/platform
        const platformReceives = totalWithPlatformFees - total;
        const pending = ticketTxRepo.create({
          userId: userId || undefined,
          clubId: expectedClubId,
          email,
          date: expectedDate,
          totalPaid: finalTotal,
          clubReceives: total,
          platformReceives,
          gatewayFee: totalGatewayFee,
          gatewayIVA: iva,
          paymentProvider: "wompi",
          paymentStatus: "PENDING",
          paymentProviderReference: transactionPayload.reference,
          // Enhanced customer information
          customerFullName: customerInfo.fullName,
          customerPhoneNumber: customerInfo.phoneNumber,
          customerLegalId: customerInfo.legalId,
          customerLegalIdType: customerInfo.legalIdType,
          paymentMethod: customerInfo.paymentMethod,
        });
        await ticketTxRepo.save(pending);
        console.log("[WOMPI-TICKET-INITIATE] Pending transaction saved", { id: pending.id, reference: pending.paymentProviderReference });
      }
    } catch (persistErr) {
      console.warn("[WOMPI-TICKET-INITIATE] Could not persist pending transaction", { err: persistErr });
      // continue; do not block payment creation
    }

    // Add redirect URL if provided
    if (redirect_url) {
      transactionPayload.redirect_url = redirect_url;
    }

    // Add payment method specific data
    if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
      transactionPayload.payment_method = {
        type: "CARD",
        installments: installments,
      };
      if (paymentSourceResponse) {
        transactionPayload.payment_source_id = paymentSourceResponse.data.id;
      }
    } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
      transactionPayload.payment_method = {
        type: "NEQUI",
        phone_number: paymentData.phone_number,
      };
    } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE) {
      transactionPayload.payment_method = {
        type: "PSE",
        user_type: paymentData.user_type || 0, // 0 = natural person
        user_legal_id_type: paymentData.user_legal_id_type || "CC",
        user_legal_id: paymentData.user_legal_id,
        financial_institution_code: paymentData.financial_institution_code,
        payment_description: paymentData.payment_description || `Ticket purchase - Order ${transactionPayload.reference}`,
      };
      // Add customer data if provided
      if (customer_data) {
        transactionPayload.customer_data = {
          phone_number: customer_data.phone_number,
          full_name: customer_data.full_name,
        };
      }
    } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
      transactionPayload.payment_method = {
        type: "BANCOLOMBIA_TRANSFER",
        user_type: "PERSON",
        payment_description: paymentData.payment_description || `Ticket purchase - Order ${transactionPayload.reference}`,
        ecommerce_url: paymentData.ecommerce_url,
      };
    } // ✅ Added missing closing brace
    // } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.DAVIPLATA) { // DISABLED
    //   transactionPayload.payment_method = {
    //     type: "DAVIPLATA",
    //     user_legal_id_type: paymentData.user_legal_id_type,
    //     user_legal_id: paymentData.user_legal_id,
    //     payment_description: paymentData.payment_description || `Ticket purchase - Order ${transactionPayload.reference}`,
    //   };
    // }
    

    // ✅ Generate integrity signature (reference + amount_in_cents + currency + integrity_key)
    transactionPayload.signature = generateTransactionSignature({
      amount_in_cents: transactionPayload.amount_in_cents,
      currency: transactionPayload.currency,
      reference: transactionPayload.reference,
    });
    


    const transactionResponse = await wompiService().createTransaction(transactionPayload);

    // Store transaction data for confirmation
    const transactionId = transactionResponse.data.id;
    
    // 🔄 Update cart lock with real transaction ID
    updateCartLockTransactionId(userId, sessionId, transactionId);
    
    transactionStore.set(transactionId, {
      userId,
      sessionId,
      email,
      cartItems: cartItems.map(item => ({
        ticketId: item.ticketId,
        quantity: item.quantity,
        date: item.date,
      })),
      totalAmount: finalTotal,
      acceptanceTokens: acceptanceTokens.data,
      paymentSourceId: paymentSourceResponse?.data.id,
      expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
      customerInfo, // Include enhanced customer information
    });

    // Update the pending transaction with the Wompi transaction ID
    try {
      const ticketTxRepo = AppDataSource.getRepository(PurchaseTransaction);
      const existingTx = await ticketTxRepo.findOne({ where: { paymentProviderReference: transactionPayload.reference } });
      if (existingTx) {
        existingTx.paymentProviderTransactionId = transactionId;
        await ticketTxRepo.save(existingTx);
        console.log("[WOMPI-TICKET-INITIATE] Updated transaction with Wompi ID", { 
          id: existingTx.id, 
          wompiTxId: transactionId,
          reference: existingTx.paymentProviderReference 
        });
      }
    } catch (updateErr) {
      console.warn("[WOMPI-TICKET-INITIATE] Could not update transaction with Wompi ID", { err: updateErr });
      // continue; do not block response
    }

    // 🚀 AUTOMATIC CHECKOUT FLOW: Start polling for transaction status
    console.log(`[WOMPI-TICKET-INITIATE] 🚀 Starting automatic checkout flow for transaction: ${transactionId}`);
    
    // Start the automatic checkout process in the background
    startAutomaticTicketCheckout(transactionId, req, res);

    // Return immediate response to user
    const response: any = {
      success: true,
      transactionId,
      total: finalTotal,
      status: transactionResponse.data.status,
      message: "Ticket checkout initiated successfully. Processing payment automatically...",
      automaticCheckout: true,
      // Include customer information for confirmation
      customerInfo: {
        fullName: customerInfo.fullName,
        phoneNumber: customerInfo.phoneNumber,
        paymentMethod: customerInfo.paymentMethod,
      },
    };

    // Handle redirect-based payment methods (PSE, Bancolombia Transfer)
    if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE || 
        paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
      
      // Poll for async payment URL if not immediately available
      try {
        let asyncUrl = transactionResponse.data.payment_method?.extra?.async_payment_url;
        
        if (!asyncUrl) {
          console.log(`[WOMPI-TICKET-INITIATE] Polling for async URL for ${paymentMethod}...`);
          asyncUrl = await wompiService().pollTransactionForAsyncUrl(transactionId);
        }
        
        // For PSE payments, append transaction ID to redirect URL
        if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE) {
          const separator = redirect_url.includes('?') ? '&' : '?';
          asyncUrl = `${redirect_url}${separator}transactionId=${transactionId}`;
        }
        
        response.redirectUrl = asyncUrl;
        response.requiresRedirect = true;
        response.message = `Please complete payment at ${paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE ? 'your bank' : 'Bancolombia'}. We'll process your order automatically once payment is complete.`;
        
      } catch (pollError: any) {
        console.error(`[WOMPI-TICKET-INITIATE] Failed to get async URL for ${paymentMethod}:`, pollError);
        response.error = "Payment URL not available. Please try again.";
      }
    } 
    // Handle Daviplata OTP flow - DISABLED
    // else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.DAVIPLATA) {
    //   const otpUrl = transactionResponse.data.payment_method?.extra?.url;
    //   if (otpUrl) {
    //     response.otpUrl = otpUrl;
    //     response.requiresOTP = true;
    //     response.message = "Please complete OTP verification. We'll process your order automatically once verified.";
        
    //     // Include OTP service URLs if available
    //     const urlServices = transactionResponse.data.payment_method?.extra?.url_services;
    //     if (urlServices) {
    //       response.otpServices = urlServices;
    //     }
    //   }
    // }
    // Handle immediate responses (Cards, Nequi)
    else {
      if (transactionResponse.data.status === WOMPI_CONFIG.STATUSES.APPROVED) {
        response.message = "Payment approved successfully. Processing your order...";
      } else if (transactionResponse.data.status === WOMPI_CONFIG.STATUSES.DECLINED) {
        response.error = "Payment was declined";
        response.status = "DECLINED";
      } else if (transactionResponse.data.status === WOMPI_CONFIG.STATUSES.PENDING) {
        if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
          response.message = "Please check your Nequi app to complete the payment. We'll process your order automatically once confirmed.";
        } else {
          response.message = "Payment is being processed. We'll update you automatically.";
        }
      }
    }

    console.log(`[WOMPI-TICKET-INITIATE] Transaction created: ${transactionId}`);
    return res.json(response);

  } catch (error: any) {
    console.error("[WOMPI-TICKET-INITIATE] Error:", error);
    return res.status(400).json({ 
      error: error.message || "Failed to initiate Wompi checkout" 
    });
  }
};

/**
 * 🚀 AUTOMATIC CHECKOUT FLOW: Polls Wompi until transaction is resolved
 * This function runs in the background and automatically processes the checkout
 */
async function startAutomaticTicketCheckout(transactionId: string, req: Request, res: Response) {
  console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] 🚀 Starting automatic checkout for transaction: ${transactionId}`);
  
  try {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    const pollInterval = 5000; // 5 seconds
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] Polling attempt ${attempts}/${maxAttempts} for transaction: ${transactionId}`);
      
      try {
        // Get transaction status from Wompi
        const transactionStatus = await wompiService().getTransactionStatus(transactionId);
        const status = transactionStatus.data.status;
        
        console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] Transaction ${transactionId} status: ${status}`);
        
        if (status === WOMPI_CONFIG.STATUSES.APPROVED) {
          // ✅ APPROVED → Process checkout, send email
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ✅ Transaction approved! Processing checkout...`);
          
          // Get stored transaction data
          const storedData = getStoredTransactionData(transactionId);
          if (!storedData) {
            console.error(`[WOMPI-TICKET-AUTO-CHECKOUT] ❌ No stored data found for transaction: ${transactionId}`);
            return;
          }
          
          // Store data will be removed AFTER checkout is complete and cart is unlocked
          
          // Create a mock response object for background processing
          const mockRes = {
            status: (code: number) => ({ json: (data: any) => console.log(`[MOCK-RESPONSE] Status ${code}:`, data) }),
            json: (data: any) => console.log(`[MOCK-RESPONSE]:`, data)
          } as any;
          
          // Process the successful checkout - DEPRECATED
          throw new Error('This endpoint has been deprecated. Use the unified checkout system instead.');
          
          // Remove stored data AFTER checkout is complete and cart is unlocked
          removeStoredTransactionData(transactionId);
          
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ✅ Checkout completed successfully for transaction: ${transactionId}`);
          return;
          
        } else if (status === WOMPI_CONFIG.STATUSES.DECLINED) {
          // ❌ DECLINED → Update status, inform user
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ❌ Transaction declined: ${transactionId}`);
          
          await updateTransactionStatus(transactionId, "DECLINED");
          removeStoredTransactionData(transactionId);
          
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ❌ Transaction marked as declined: ${transactionId}`);
          return;
          
        } else if (status === WOMPI_CONFIG.STATUSES.ERROR) {
          // ❌ ERROR → Map to declined, inform user
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ❌ Transaction error: ${transactionId}`);
          
          await updateTransactionStatus(transactionId, "DECLINED");
          removeStoredTransactionData(transactionId);
          
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ❌ Transaction marked as declined due to error: ${transactionId}`);
          return;
          
        } else if (status === WOMPI_CONFIG.STATUSES.PENDING) {
          // ⏰ PENDING → Continue polling
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ⏰ Transaction pending, continuing to poll...`);
          
          // For pending transactions, wait before next poll
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
          
        } else {
          // Unknown status, log and continue
          console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ⚠️ Unknown status: ${status}, continuing to poll...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
      } catch (pollError: any) {
        console.error(`[WOMPI-TICKET-AUTO-CHECKOUT] Polling error on attempt ${attempts}:`, pollError);
        
        // If it's a network error, continue polling
        if (pollError.code === 'ECONNRESET' || pollError.code === 'ETIMEDOUT') {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        
        // For other errors, wait a bit longer and continue
        await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
        continue;
      }
    }
    
    // ⏰ TIMEOUT → Inform user payment is processing
    console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ⏰ Timeout reached for transaction: ${transactionId}`);
    
    // Update transaction status to indicate timeout
    await updateTransactionStatus(transactionId, "TIMEOUT");
    
    console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] ⏰ Transaction marked as timeout: ${transactionId}`);
    
  } catch (error: any) {
    console.error(`[WOMPI-TICKET-AUTO-CHECKOUT] ❌ Fatal error in automatic checkout:`, error);
    
    // Try to update transaction status to indicate error
    try {
      await updateTransactionStatus(transactionId, "ERROR");
    } catch (updateError) {
      console.error(`[WOMPI-TICKET-AUTO-CHECKOUT] Failed to update transaction status:`, updateError);
    }
  }
}

/**
 * Helper function to update transaction status in database
 */
async function updateTransactionStatus(wompiTransactionId: string, status: string) {
  try {
    const transactionRepo = AppDataSource.getRepository(PurchaseTransaction);
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: wompiTransactionId }
    });

    if (existingTransaction) {
      // Map statuses to valid database values
      let mappedStatus: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED";
      
      if (status === "APPROVED" || status === "PENDING" || status === "VOIDED") {
        mappedStatus = status;
      } else {
        // Map TIMEOUT, ERROR, and any other status to DECLINED
        mappedStatus = "DECLINED";
      }
      
      existingTransaction.paymentStatus = mappedStatus;
      await transactionRepo.save(existingTransaction);
      console.log(`[WOMPI-TICKET-AUTO-CHECKOUT] Updated transaction status to ${mappedStatus} (from ${status}): ${existingTransaction.id}`);
    } else {
      console.warn(`[WOMPI-TICKET-AUTO-CHECKOUT] Transaction not found for status update: ${wompiTransactionId}`);
    }
  } catch (error) {
    console.error(`[WOMPI-TICKET-AUTO-CHECKOUT] Error updating transaction status:`, error);
  }
}

// Helper function to get stored transaction data
export const getStoredTransactionData = (transactionId: string) => {
  console.log(`[TRANSACTION-STORE] 🔍 Looking for transaction ${transactionId}`);
  console.log(`[TRANSACTION-STORE] 📊 Current store size: ${transactionStore.size}`);
  console.log(`[TRANSACTION-STORE] 🔑 Available keys:`, Array.from(transactionStore.keys()));
  
  const data = transactionStore.get(transactionId);
  if (!data) {
    console.log(`[TRANSACTION-STORE] ❌ No data found for transaction ${transactionId}`);
    return null;
  }
  
  // Check if expired
  if (Date.now() > data.expiresAt) {
    console.log(`[TRANSACTION-STORE] ⏰ Data expired for transaction ${transactionId}, removing...`);
    transactionStore.delete(transactionId);
    return null;
  }
  
  console.log(`[TRANSACTION-STORE] ✅ Found data for transaction ${transactionId}:`, {
    userId: data.userId,
    sessionId: data.sessionId,
    email: data.email,
    expiresAt: new Date(data.expiresAt).toISOString()
  });
  
  return data;
};

// Helper function to remove stored transaction data
export const removeStoredTransactionData = (transactionId: string) => {
  transactionStore.delete(transactionId);
}; 