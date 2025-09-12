import { AppDataSource } from '../config/data-source';
import { UnifiedCartItem } from '../entities/UnifiedCartItem';
import { UnifiedPurchaseTransaction } from '../entities/UnifiedPurchaseTransaction';
import { TicketPurchase } from '../entities/TicketPurchase';
import { MenuPurchase } from '../entities/MenuPurchase';
import { UnifiedCartService } from './unifiedCart.service';
import { calculateFeeAllocation, validateFeeAllocation } from '../utils/feeAllocation';
import { generateEncryptedQR } from '../utils/generateEncryptedQR';
import { sendTicketEmail } from '../services/emailService';
import { sendMenuEmail } from '../services/emailService';
import { sendUnifiedTicketEmail } from '../services/emailService';
import { sendTransactionInvoiceEmail } from '../services/emailService';
import { computeDynamicPrice, computeDynamicEventPrice } from '../utils/dynamicPricing';
import { wompiService } from './wompi.service';
import { WOMPI_CONFIG } from '../config/wompi';
import { generateTransactionSignature } from '../utils/generateWompiSignature';
import { unlockCart } from '../utils/cartLock';
import QRCode from 'qrcode';

export interface CheckoutInitiateInput {
  email: string;
  paymentMethod?: string;
  customerFullName?: string;
  customerPhoneNumber?: string;
  customerLegalId?: string;
  customerLegalIdType?: string;
}

export interface CheckoutInitiateWithWompiInput {
  email: string;
  paymentMethod: string;
  paymentData: any;
  installments?: number;
  redirect_url?: string;
  customer_data?: any;
  customerInfo: {
    fullName?: string;
    phoneNumber?: string;
    legalId?: string;
    legalIdType?: string;
    paymentMethod: string;
  };
}

export interface CheckoutInitiateResult {
  transactionId: string;
  checkoutUrl?: string;
  isFreeCheckout: boolean;
  totalPaid: number;
  clubReceives: number;
  platformReceives: number;
}

export interface CheckoutInitiateWithWompiResult {
  transactionId: string;
  wompiTransactionId: string;
  wompiStatus: string;
  totalPaid: number;
  clubReceives: number;
  platformReceives: number;
  isFreeCheckout: boolean;
  redirectUrl?: string;
}

export class UnifiedCheckoutService {
  private cartService = new UnifiedCartService();
  private cartRepo = AppDataSource.getRepository(UnifiedCartItem);
  private transactionRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
  private ticketPurchaseRepo = AppDataSource.getRepository(TicketPurchase);
  private menuPurchaseRepo = AppDataSource.getRepository(MenuPurchase);

  /**
   * Initiate unified checkout with Wompi integration
   */
  async initiateCheckoutWithWompi(
    input: CheckoutInitiateWithWompiInput,
    userId?: string,
    sessionId?: string
  ): Promise<CheckoutInitiateWithWompiResult> {
    const { email, paymentMethod, paymentData, installments, redirect_url, customer_data, customerInfo } = input;

    console.log(`[UNIFIED-CHECKOUT-SERVICE] Starting Wompi checkout for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);

    // Get cart items
    const cartItems = await this.cartService.getCartItemsWithDynamicPricing(userId, sessionId);
    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Calculate totals
    const totals = await this.cartService.calculateCartTotals(userId, sessionId);
    
    // Check if this is a free checkout
    const isFreeCheckout = totals.totalSubtotal === 0;

    if (isFreeCheckout) {
      console.log("[UNIFIED-CHECKOUT-SERVICE] 🎁 Free checkout detected. Processing immediately.");
      
      // Process free checkout immediately (no payment needed)
      const result = await this.processFreeCheckoutDirect(email, cartItems, customerInfo, userId, sessionId);
      return {
        transactionId: result.transactionId,
        wompiTransactionId: result.transactionId,
        wompiStatus: 'APPROVED',
        totalPaid: 0,
        clubReceives: result.clubReceives,
        platformReceives: 0,
        isFreeCheckout: true
      };
    }

    // Calculate fee allocation
    const feeAllocation = calculateFeeAllocation({
      ticketSubtotal: totals.ticketSubtotal,
      menuSubtotal: totals.menuSubtotal,
      isEventTicket: cartItems.some(item => item.itemType === 'ticket' && item.ticket?.category === 'event')
    });

    // Validate fee allocation
    if (!validateFeeAllocation(feeAllocation)) {
      throw new Error('Fee allocation validation failed');
    }

    // Get club ID from cart items (all should be the same)
    const clubId = cartItems[0].clubId;
    const ticketDate = cartItems.find(item => item.itemType === 'ticket')?.date;

    // 🚫 Validate minimum transaction amount (Wompi requirement: 1500 COP)
    if (feeAllocation.totalPaid < 1500) {
      console.log(`[UNIFIED-CHECKOUT-SERVICE] ❌ Cart total ${feeAllocation.totalPaid} is below Wompi minimum (1500 COP). Unlocking cart.`);
      
      // Unlock the cart since we can't proceed
      try {
        await unlockCart(userId || null, sessionId || null);
        console.log(`[UNIFIED-CHECKOUT-SERVICE] 🔓 Cart unlocked due to insufficient amount`);
      } catch (unlockError) {
        console.warn(`[UNIFIED-CHECKOUT-SERVICE] Could not unlock cart:`, unlockError);
      }
      
      throw new Error("El monto mínimo de una transacción es $1,500 COP (exceptuando impuestos). Por favor, agrega más items a tu carrito.");
    }

    console.log(`[UNIFIED-CHECKOUT-SERVICE] CALCULATION DEBUG:`);
    console.log(`   Total Paid: ${feeAllocation.totalPaid}`);
    console.log(`   Total Club Receives: ${feeAllocation.clubReceives}`);
    console.log(`   Total Platform Receives: ${feeAllocation.platformReceives}`);
    console.log(`   Gateway Fee: ${feeAllocation.gatewayFee}`);
    console.log(`   Gateway IVA: ${feeAllocation.gatewayIVA}`);

    try {
      // Step 1: Get acceptance tokens
      console.log("[UNIFIED-CHECKOUT-SERVICE] Getting acceptance tokens...");
      const acceptanceTokens = await wompiService().getAcceptanceTokens();

      // Step 2: Tokenize payment method only for CARD
      let tokenResponse;
      let paymentSourceResponse;

      if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
        console.log("[UNIFIED-CHECKOUT-SERVICE] Tokenizing card...");
        tokenResponse = await wompiService().tokenizeCard(paymentData);
      } else if (!Object.values(WOMPI_CONFIG.PAYMENT_METHODS).includes(paymentMethod as any)) {
        throw new Error("Unsupported payment method");
      }

      // Step 3: Create payment source only for CARD
      if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD && tokenResponse) {
        console.log("[UNIFIED-CHECKOUT-SERVICE] Creating payment source...");
        paymentSourceResponse = await wompiService().createPaymentSource({
          type: paymentMethod,
          token: tokenResponse.data.id,
          customer_email: email,
          acceptance_token: acceptanceTokens.data.presigned_acceptance.acceptance_token,
          accept_personal_auth: acceptanceTokens.data.presigned_personal_data_auth.acceptance_token,
        });
      }

      // Step 4: Create transaction
      console.log("[UNIFIED-CHECKOUT-SERVICE] Creating transaction...");
      const transactionPayload: any = {
        amount_in_cents: Math.round(feeAllocation.totalPaid * 100), // Convert to cents
        currency: "COP",
        reference: `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        customer_email: email,
        acceptance_token: acceptanceTokens.data.presigned_acceptance.acceptance_token,
        accept_personal_auth: acceptanceTokens.data.presigned_personal_data_auth.acceptance_token,
      };

      // Create unified transaction record first
      const transaction = this.transactionRepo.create({
        userId: userId || undefined,
        clubId,
        buyerEmail: email,
        ticketDate: ticketDate || undefined,
        totalPaid: feeAllocation.totalPaid,
        ticketSubtotal: feeAllocation.ticketSubtotal,
        menuSubtotal: feeAllocation.menuSubtotal,
        platformReceives: feeAllocation.platformReceives,
        clubReceives: feeAllocation.clubReceives,
        gatewayFee: feeAllocation.gatewayFee,
        gatewayIVA: feeAllocation.gatewayIVA,
        retencionICA: feeAllocation.retencionICA,
        retencionIVA: feeAllocation.retencionIVA,
        retencionFuente: feeAllocation.retencionFuente,
        platformFeeAppliedTickets: feeAllocation.platformFeeTickets,
        platformFeeAppliedMenu: feeAllocation.platformFeeMenu,
        paymentProvider: 'wompi',
        paymentStatus: 'PENDING',
        paymentProviderReference: transactionPayload.reference,
        customerFullName: customerInfo.fullName,
        customerPhoneNumber: customerInfo.phoneNumber,
        customerLegalId: customerInfo.legalId,
        customerLegalIdType: customerInfo.legalIdType,
        paymentMethod: customerInfo.paymentMethod
      });

      const savedTransaction = await this.transactionRepo.save(transaction) as UnifiedPurchaseTransaction;
      console.log("[UNIFIED-CHECKOUT-SERVICE] Unified transaction saved", { id: savedTransaction.id, reference: savedTransaction.paymentProviderReference });

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
          user_type: paymentData.user_type || 0,
          user_legal_id_type: paymentData.user_legal_id_type || "CC",
          user_legal_id: paymentData.user_legal_id,
          financial_institution_code: paymentData.financial_institution_code,
          payment_description: paymentData.payment_description || `Unified purchase - Order ${transactionPayload.reference}`,
        };
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
          payment_description: paymentData.payment_description || `Unified purchase - Order ${transactionPayload.reference}`,
          ecommerce_url: paymentData.ecommerce_url,
        };
      }

      // Generate integrity signature
      transactionPayload.signature = generateTransactionSignature({
        amount_in_cents: transactionPayload.amount_in_cents,
        currency: transactionPayload.currency,
        reference: transactionPayload.reference,
      });

      const transactionResponse = await wompiService().createTransaction(transactionPayload);

      // Update transaction with Wompi transaction ID
      const wompiTransactionId = transactionResponse.data.id;
      savedTransaction.paymentProviderTransactionId = wompiTransactionId;
      await this.transactionRepo.save(savedTransaction);

      console.log(`[UNIFIED-CHECKOUT-SERVICE] Wompi transaction created: ${wompiTransactionId}`);

      // Handle redirect-based payment methods
      let redirectUrl: string | undefined;
      if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE || 
          paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
        
        try {
          let asyncUrl = transactionResponse.data.payment_method?.extra?.async_payment_url;
          
          if (!asyncUrl) {
            console.log(`[UNIFIED-CHECKOUT-SERVICE] Polling for async URL for ${paymentMethod}...`);
            asyncUrl = await wompiService().pollTransactionForAsyncUrl(wompiTransactionId);
          }
          
          redirectUrl = asyncUrl;
        } catch (pollError: any) {
          console.error(`[UNIFIED-CHECKOUT-SERVICE] Failed to get async URL for ${paymentMethod}:`, pollError);
        }
      }

      return {
        transactionId: savedTransaction.id,
        wompiTransactionId,
        wompiStatus: transactionResponse.data.status,
        totalPaid: feeAllocation.totalPaid,
        clubReceives: feeAllocation.clubReceives,
        platformReceives: feeAllocation.platformReceives,
        isFreeCheckout: false,
        redirectUrl
      };

    } catch (error: any) {
      console.error("[UNIFIED-CHECKOUT-SERVICE] Error:", error);
      throw error;
    }
  }

  /**
   * Initiate unified checkout (legacy method)
   */
  async initiateCheckout(
    input: CheckoutInitiateInput,
    userId?: string,
    sessionId?: string
  ): Promise<CheckoutInitiateResult> {
    const { email, paymentMethod, customerFullName, customerPhoneNumber, customerLegalId, customerLegalIdType } = input;

    // Get cart items
    const cartItems = await this.cartService.getCartItemsWithDynamicPricing(userId, sessionId);
    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // Calculate totals
    const totals = await this.cartService.calculateCartTotals(userId, sessionId);
    
    // Check if this is a free checkout
    const isFreeCheckout = totals.totalSubtotal === 0;

    // Calculate fee allocation
    const feeAllocation = calculateFeeAllocation({
      ticketSubtotal: totals.ticketSubtotal,
      menuSubtotal: totals.menuSubtotal,
      isEventTicket: cartItems.some(item => item.itemType === 'ticket' && item.ticket?.category === 'event')
    });

    // Validate fee allocation
    if (!validateFeeAllocation(feeAllocation)) {
      throw new Error('Fee allocation validation failed');
    }

    // Get club ID from cart items (all should be the same)
    const clubId = cartItems[0].clubId;
    const ticketDate = cartItems.find(item => item.itemType === 'ticket')?.date;

    // Create unified transaction
    const transaction = this.transactionRepo.create({
      userId: userId || undefined,
      clubId,
      buyerEmail: email,
      ticketDate: ticketDate || undefined,
      totalPaid: feeAllocation.totalPaid,
      ticketSubtotal: feeAllocation.ticketSubtotal,
      menuSubtotal: feeAllocation.menuSubtotal,
      platformReceives: feeAllocation.platformReceives,
      clubReceives: feeAllocation.clubReceives,
      gatewayFee: feeAllocation.gatewayFee,
      gatewayIVA: feeAllocation.gatewayIVA,
      retencionICA: feeAllocation.retencionICA,
      retencionIVA: feeAllocation.retencionIVA,
      retencionFuente: feeAllocation.retencionFuente,
      platformFeeAppliedTickets: feeAllocation.platformFeeTickets,
      platformFeeAppliedMenu: feeAllocation.platformFeeMenu,
      paymentProvider: isFreeCheckout ? 'free' : 'wompi',
      paymentStatus: 'PENDING',
      customerFullName,
      customerPhoneNumber,
      customerLegalId,
      customerLegalIdType,
      paymentMethod
    });

    const savedTransaction = await this.transactionRepo.save(transaction) as UnifiedPurchaseTransaction;

    // Handle free checkout
    if (isFreeCheckout) {
      await this.processFreeCheckout(savedTransaction, cartItems, sessionId, userId);
      return {
        transactionId: savedTransaction.id,
        isFreeCheckout: true,
        totalPaid: 0,
        clubReceives: feeAllocation.clubReceives,
        platformReceives: 0
      };
    }

    // TODO: Integrate with Wompi for payment processing
    // For now, return mock checkout URL
    const checkoutUrl = `https://checkout.wompi.co/checkout?transactionId=${savedTransaction.id}`;

    return {
      transactionId: savedTransaction.id,
      checkoutUrl,
      isFreeCheckout: false,
      totalPaid: feeAllocation.totalPaid,
      clubReceives: feeAllocation.clubReceives,
      platformReceives: feeAllocation.platformReceives
    };
  }

  /**
   * Confirm checkout and process payment
   */
  async confirmCheckout(
    transactionId: string,
    userId?: string,
    sessionId?: string
  ): Promise<{ success: boolean; message?: string }> {
    console.log(`[UNIFIED-CHECKOUT] Confirming transaction: ${transactionId}`);

    // Get transaction
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
      relations: ['ticketPurchases', 'menuPurchases']
    });

    if (!transaction) {
      throw new Error('Transaction not found or expired');
    }

    // Check if it's a free checkout
    if (transaction.paymentProvider === 'free') {
      console.log(`[UNIFIED-CHECKOUT] 🎁 FREE checkout - processing directly`);
      await this.processFreeCheckout(transaction, [], sessionId, userId);
      return { success: true, message: 'Free checkout completed successfully' };
    }

    // For paid checkouts, we need to check Wompi status
    try {
      const wompiTransactionId = transaction.paymentProviderTransactionId;
      if (!wompiTransactionId) {
        throw new Error('No Wompi transaction ID found');
      }

      const transactionStatus = await wompiService().getTransactionStatus(wompiTransactionId);
      const finalStatus = transactionStatus.data.status.toUpperCase();
      
      console.log(`[UNIFIED-CHECKOUT] Wompi transaction status: ${finalStatus}`);
      
      // Update transaction with Wompi status
      transaction.paymentStatus = finalStatus as 'APPROVED' | 'DECLINED' | 'ERROR';
      await this.transactionRepo.save(transaction);

      if (finalStatus === 'APPROVED') {
        // Just update the transaction status - processing will be handled by the controller's automatic checkout flow
        console.log(`[UNIFIED-CHECKOUT] Transaction approved, status updated. Processing will be handled by automatic checkout flow.`);
        
        return { success: true, message: 'Payment approved, processing order...' };
      } else {
        // 🔓 Unlock the cart for failed checkout
        try {
          await unlockCart(userId || null, sessionId || null);
          console.log(`[UNIFIED-CHECKOUT] ✅ Cart unlocked after failed checkout for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
        } catch (unlockError) {
          console.error(`[UNIFIED-CHECKOUT] ❌ Failed to unlock cart after failed checkout:`, unlockError);
        }
        
        return { 
          success: false, 
          message: `Payment not approved. Status: ${finalStatus}` 
        };
      }
    } catch (wompiError) {
      console.error(`[UNIFIED-CHECKOUT] Error checking Wompi status:`, wompiError);
      
      // 🔓 Unlock the cart on error
      try {
        await unlockCart(userId || null, sessionId || null);
        console.log(`[UNIFIED-CHECKOUT] ✅ Cart unlocked after error for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
      } catch (unlockError) {
        console.error(`[UNIFIED-CHECKOUT] ❌ Failed to unlock cart after error:`, unlockError);
      }
      
      throw new Error('Failed to verify payment status with payment provider');
    }
  }

  /**
   * Process free checkout directly (no payment required)
   */
  private async processFreeCheckoutDirect(
    email: string,
    cartItems: UnifiedCartItem[],
    customerInfo: any,
    userId?: string,
    sessionId?: string
  ): Promise<{ transactionId: string; clubReceives: number }> {
    // Calculate totals
    const totals = await this.cartService.calculateCartTotals(userId, sessionId);
    
    // Calculate fee allocation
    const feeAllocation = calculateFeeAllocation({
      ticketSubtotal: totals.ticketSubtotal,
      menuSubtotal: totals.menuSubtotal,
      isEventTicket: cartItems.some(item => item.itemType === 'ticket' && item.ticket?.category === 'event')
    });

    // Get club ID from cart items
    const clubId = cartItems[0].clubId;
    const ticketDate = cartItems.find(item => item.itemType === 'ticket')?.date;

    // Create unified transaction for free checkout
    const transaction = this.transactionRepo.create({
      userId: userId || undefined,
      clubId,
      buyerEmail: email,
      ticketDate: ticketDate || undefined,
      totalPaid: 0,
      ticketSubtotal: feeAllocation.ticketSubtotal,
      menuSubtotal: feeAllocation.menuSubtotal,
      platformReceives: 0,
      clubReceives: feeAllocation.clubReceives,
      gatewayFee: 0,
      gatewayIVA: 0,
      retencionICA: 0,
      retencionIVA: 0,
      retencionFuente: 0,
      platformFeeAppliedTickets: 0,
      platformFeeAppliedMenu: 0,
      paymentProvider: 'free',
      paymentStatus: 'APPROVED',
      paymentProviderReference: `free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      customerFullName: customerInfo.fullName,
      customerPhoneNumber: customerInfo.phoneNumber,
      customerLegalId: customerInfo.legalId,
      customerLegalIdType: customerInfo.legalIdType,
      paymentMethod: customerInfo.paymentMethod
    });

    const savedTransaction = await this.transactionRepo.save(transaction) as UnifiedPurchaseTransaction;

    // ✅ Process within a DB transaction using the new path (atomic & safe)
    await this.transactionRepo.manager.transaction(async (transactionalEntityManager) => {
      await this.processSuccessfulCheckoutInTransaction(savedTransaction, cartItems, transactionalEntityManager, sessionId, userId);
    });

    // Clear cart
    await this.cartService.clearCart(userId, sessionId);

    return {
      transactionId: savedTransaction.id,
      clubReceives: feeAllocation.clubReceives
    };
  }

  /**
   * Process free checkout (no payment required)
   */
  private async processFreeCheckout(
    transaction: UnifiedPurchaseTransaction,
    cartItems: UnifiedCartItem[],
    sessionId?: string,
    userId?: string
  ): Promise<void> {
    // Update transaction status
    transaction.paymentStatus = 'APPROVED';
    transaction.paymentProvider = 'free';
    await this.transactionRepo.save(transaction);

    // ✅ Process within a DB transaction using the new path (atomic & safe)
    await this.transactionRepo.manager.transaction(async (transactionalEntityManager) => {
      await this.processSuccessfulCheckoutInTransaction(transaction, cartItems, transactionalEntityManager, sessionId, userId);
    });
  }

  /**
   * Process successful checkout with stored data (for background processing)
   */
  async processSuccessfulCheckoutWithStoredData(
    transactionId: string,
    cartItems: any[],
    userId?: string,
    sessionId?: string
  ): Promise<{ success: boolean; message?: string }> {
    console.log(`[UNIFIED-CHECKOUT-SERVICE] Processing successful checkout with stored data for transaction: ${transactionId}`);

    // Get transaction
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
      relations: ['ticketPurchases', 'menuPurchases']
    });

    if (!transaction) {
      throw new Error('Transaction not found or expired');
    }

    // Recalculate dynamic pricing for stored cart items
    console.log(`[UNIFIED-CHECKOUT-SERVICE] Recalculating dynamic pricing for stored cart items...`);
    const cartItemsWithDynamicPricing = await this.cartService.getCartItemsWithDynamicPricing(userId, sessionId);
    
    // Merge stored cart items with dynamic pricing
    const mergedCartItems = cartItems.map(storedItem => {
      const dynamicItem = cartItemsWithDynamicPricing.find(dynamicItem => 
        (storedItem.ticketId && dynamicItem.ticketId === storedItem.ticketId) ||
        (storedItem.menuItemId && dynamicItem.menuItemId === storedItem.menuItemId)
      );
      
      return {
        ...storedItem,
        dynamicPrice: dynamicItem?.dynamicPrice || storedItem.dynamicPrice
      };
    });

    console.log(`[UNIFIED-CHECKOUT-SERVICE] Merged cart items with dynamic pricing:`, 
      mergedCartItems.map(item => ({
        id: item.id,
        itemType: item.itemType,
        ticketId: item.ticketId,
        menuItemId: item.menuItemId,
        dynamicPrice: item.dynamicPrice
      }))
    );

    // Update transaction status
    transaction.paymentStatus = 'APPROVED';
    const savedTransaction = await this.transactionRepo.save(transaction);
    console.log(`[UNIFIED-CHECKOUT-SERVICE] Transaction saved with ID: ${savedTransaction.id}`);

    // Process as successful checkout with merged cart items in a database transaction
    try {
      await this.transactionRepo.manager.transaction(async (transactionalEntityManager) => {
        console.log(`[UNIFIED-CHECKOUT-SERVICE] Starting database transaction for checkout processing`);
        
        // Process successful checkout within the transaction
        await this.processSuccessfulCheckoutInTransaction(savedTransaction, mergedCartItems, transactionalEntityManager, sessionId, userId);
        
        console.log(`[UNIFIED-CHECKOUT-SERVICE] Database transaction completed successfully`);
      });
      console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Database transaction committed successfully`);
    } catch (transactionError) {
      console.error(`[UNIFIED-CHECKOUT-SERVICE] ❌ Database transaction failed:`, transactionError);
      throw transactionError;
    }

    // Clear cart AFTER the database transaction is committed
    try {
      await this.cartService.clearCart(userId, sessionId);
      console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Cart cleared successfully`);
    } catch (cartError) {
      console.error(`[UNIFIED-CHECKOUT-SERVICE] ⚠️ Cart clearing failed (but checkout was successful):`, cartError);
      // Don't throw here since the checkout was already successful
    }

    // 🔓 Unlock the cart after successful checkout
    try {
      await unlockCart(userId || null, sessionId || null);
      console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Cart unlocked successfully for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
    } catch (unlockError) {
      console.error(`[UNIFIED-CHECKOUT-SERVICE] ❌ Failed to unlock cart:`, unlockError);
    }

    return { success: true, message: 'Checkout completed successfully' };
  }

  /**
   * Process successful checkout within a database transaction
   */
  private async processSuccessfulCheckoutInTransaction(
    transaction: UnifiedPurchaseTransaction,
    cartItems: any[],
    transactionalEntityManager: any,
    sessionId?: string,
    userId?: string
  ): Promise<void> {
    // 🔐 Idempotency guard
    if ((transaction as any).processedAt) {
      console.log(`[UNIFIED-CHECKOUT-SERVICE] Skipping processing; transaction ${transaction.id} already marked processedAt=${(transaction as any).processedAt}`);
      return;
    }

    console.log(`[UNIFIED-CHECKOUT-SERVICE] Processing successful checkout with simplified 3-table approach in transaction`);
    console.log(`[UNIFIED-CHECKOUT-SERVICE] Transaction ID: ${transaction.id}`);
    
    if (!transaction.id) {
      throw new Error('Transaction ID is required for processing checkout');
    }

    // Process ticket items - create individual TicketPurchase records
    const ticketItems = cartItems.filter((item: any) => item.itemType === 'ticket');
    if (ticketItems.length > 0) {
      console.log(`[UNIFIED-CHECKOUT-SERVICE] Processing ${ticketItems.length} ticket items`);
      
      // Calculate total tickets across all cart items for proper numbering
      const totalTicketsInCart = ticketItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
      let globalTicketCounter = 0;

      for (const cartItem of ticketItems) {
        // Load the ticket from database
        const ticket = await transactionalEntityManager.findOne('Ticket', {
          where: { id: cartItem.ticketId },
          relations: ['club', 'event']
        }) as any;
        
        if (!ticket) {
          console.warn(`[UNIFIED-CHECKOUT-SERVICE] Ticket not found: ${cartItem.ticketId}`);
          continue;
        }

        // Create individual ticket purchases (one per quantity unit)
        for (let i = 0; i < cartItem.quantity; i++) {
          globalTicketCounter++;
          
          console.log(`[UNIFIED-CHECKOUT-SERVICE] Ticket pricing debug:`, {
            ticketId: cartItem.ticketId,
            ticketName: ticket.name,
            basePrice: Number(ticket.price),
            dynamicPrice: cartItem.dynamicPrice,
            finalPrice: Number(cartItem.dynamicPrice || ticket.price),
            dynamicPricingWasApplied: cartItem.dynamicPrice && Number(cartItem.dynamicPrice) !== Number(ticket.price)
          });

          console.log(`[TICKET-PURCHASE] Creating ticket purchase with transaction ID: ${transaction.id}`);
          console.log(`[TICKET-PURCHASE] Transaction details:`, {
            id: transaction.id,
            hasId: !!transaction.id,
            isManaged: transactionalEntityManager.hasId(transaction)
          });

          const ticketPurchase = transactionalEntityManager.create('TicketPurchase', {
            transaction: transaction,
            transactionId: transaction.id,
            ticket: ticket,
            date: cartItem.date!,
            email: transaction.buyerEmail,
            clubId: transaction.clubId,
            userId: userId || null,
            sessionId: sessionId || null,
            originalBasePrice: Number(ticket.price),
            priceAtCheckout: Number(cartItem.dynamicPrice || ticket.price),
            dynamicPricingWasApplied: cartItem.dynamicPrice && Number(cartItem.dynamicPrice) !== Number(ticket.price),
            clubReceives: Number(cartItem.dynamicPrice || ticket.price),
            platformFee: Number(cartItem.dynamicPrice || ticket.price) * 0.05, // TODO: Use actual fee calculation
            platformFeeApplied: 0.05,
            isUsed: false
          });

          console.log(`[TICKET-PURCHASE] Before save - transactionId: ${ticketPurchase.transactionId}`);
          console.log(`[TICKET-PURCHASE] Before save - hasTransaction: ${!!ticketPurchase.transaction}`);

          const savedTicketPurchase = await transactionalEntityManager.save('TicketPurchase', ticketPurchase);
          
          console.log(`[TICKET-PURCHASE] After save - ID: ${savedTicketPurchase.id}, transactionId: ${savedTicketPurchase.transactionId}`);
          
          // Direct database verification
          const ticketDirectQuery = await transactionalEntityManager.query(
            'SELECT id, "transactionId" FROM ticket_purchase WHERE id = $1',
            [savedTicketPurchase.id]
          );
          console.log(`[TICKET-PURCHASE] Direct DB query result:`, ticketDirectQuery[0]);

          // Generate QR code for ticket
          const payload = {
            id: savedTicketPurchase.id,
            type: "ticket" as const
          };
          const encryptedPayload = await generateEncryptedQR(payload);
          const qrDataUrl = await QRCode.toDataURL(encryptedPayload);

          savedTicketPurchase.qrCodeEncrypted = encryptedPayload;
          await transactionalEntityManager.save('TicketPurchase', savedTicketPurchase);

          // Get club name for email
          const club = await transactionalEntityManager.findOne('Club', {
            where: { id: transaction.clubId }
          }) as any;

          // Check if ticket includes menu items
          const hasIncludedMenuItems = ticket.includesMenuItem;
          let includedMenuItems: any[] = [];
          
          if (hasIncludedMenuItems) {
            // Get included menu items for this ticket
            const ticketIncludedMenuItemRepo = transactionalEntityManager.getRepository('TicketIncludedMenuItem');
            includedMenuItems = await ticketIncludedMenuItemRepo.find({
              where: { ticketId: ticket.id },
              relations: ["menuItem", "variant"]
            });
          }

          // Send appropriate email based on whether ticket includes menu items
          if (hasIncludedMenuItems && includedMenuItems.length > 0) {
            // Generate menu QR payload for included items
            const menuPayload = {
              type: "menu_from_ticket" as const,
              ticketPurchaseId: savedTicketPurchase.id,
              clubId: transaction.clubId
            };

            const menuEncryptedPayload = await generateEncryptedQR(menuPayload);
            const menuQrDataUrl = await QRCode.toDataURL(menuEncryptedPayload);

            // Create records for analytics
            const menuItemFromTicketRepo = transactionalEntityManager.getRepository('MenuItemFromTicket');
            const menuItemFromTicketRecords = includedMenuItems.map(item => 
              menuItemFromTicketRepo.create({
                ticketPurchaseId: savedTicketPurchase.id,
                menuItemId: item.menuItemId,
                variantId: item.variantId || undefined,
                quantity: item.quantity
              })
            );

            await menuItemFromTicketRepo.save(menuItemFromTicketRecords);

            // Send unified email with both QR codes
            const menuItems = includedMenuItems.map(item => ({
              name: item.menuItem.name,
              variant: item.variant?.name || null,
              quantity: item.quantity
            }));

            await sendUnifiedTicketEmail({
              to: transaction.buyerEmail,
              email: transaction.buyerEmail,
              ticketName: ticket.name,
              date: cartItem.date instanceof Date ? 
                cartItem.date.toISOString().split('T')[0] : 
                String(cartItem.date).split('T')[0],
              ticketQrImageDataUrl: qrDataUrl,
              menuQrImageDataUrl: menuQrDataUrl,
              clubName: club?.name || "Your Club",
              menuItems: menuItems,
              index: globalTicketCounter,
              total: totalTicketsInCart,
              description: ticket.description,
              purchaseId: savedTicketPurchase.id
            });

            console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Unified email sent for ticket ${globalTicketCounter}/${totalTicketsInCart} with menu`);
          } else {
            // Send regular ticket email (no menu included)
            await sendTicketEmail({
              to: transaction.buyerEmail,
              ticketName: ticket.name,
              date: cartItem.date instanceof Date ? 
                cartItem.date.toISOString().split('T')[0] : 
                String(cartItem.date).split('T')[0],
              qrImageDataUrl: qrDataUrl,
              clubName: club?.name || "Your Club",
              index: globalTicketCounter,
              total: totalTicketsInCart
            });

            console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Ticket email sent for ticket ${globalTicketCounter}/${totalTicketsInCart}`);
          }
        }
      }
    }

    // Process menu items - create individual MenuPurchase records for standalone menu purchases
    const menuItems = cartItems.filter((item: any) => item.itemType === 'menu');
    if (menuItems.length > 0) {
      console.log(`[UNIFIED-CHECKOUT-SERVICE] Processing ${menuItems.length} standalone menu items`);
      
      // Create menu purchases for each item - EXACTLY like tickets
      const savedMenuPurchases: MenuPurchase[] = [];
      for (const cartItem of menuItems) {
        // Load the menu item and variant from database
        const menuItem = await transactionalEntityManager.findOne('MenuItem', {
          where: { id: cartItem.menuItemId },
          relations: ['club']
        }) as any;
        
        if (!menuItem) {
          console.warn(`[UNIFIED-CHECKOUT-SERVICE] Menu item not found: ${cartItem.menuItemId}`);
          continue;
        }

        let variant: any = null;
        if (cartItem.variantId) {
          variant = await transactionalEntityManager.findOne('MenuItemVariant', {
            where: { id: cartItem.variantId }
          }) as any;
        }

        const basePrice = variant 
          ? Number(variant.price)
          : Number(menuItem.price || 0);

        console.log(`[UNIFIED-CHECKOUT-SERVICE] Menu item pricing debug:`, {
          menuItemId: cartItem.menuItemId,
          menuItemName: menuItem.name,
          variantId: cartItem.variantId,
          basePrice: basePrice,
          dynamicPrice: cartItem.dynamicPrice,
          finalPrice: Number(cartItem.dynamicPrice || basePrice),
          dynamicPricingWasApplied: cartItem.dynamicPrice && Number(cartItem.dynamicPrice) !== basePrice
        });

        console.log(`[MENU-PURCHASE] Creating menu purchase with transaction ID: ${transaction.id}`);
        console.log(`[MENU-PURCHASE] Transaction details:`, {
          id: transaction.id,
          hasId: !!transaction.id,
          isManaged: transactionalEntityManager.hasId(transaction)
        });

        const menuPurchase = transactionalEntityManager.create('MenuPurchase', {
          transaction: transaction,
          transactionId: transaction.id,
          menuItemId: cartItem.menuItemId!,
          variantId: cartItem.variantId || undefined,
          userId: userId || null,
          sessionId: sessionId || null,
          clubId: transaction.clubId,
          email: transaction.buyerEmail,
          quantity: cartItem.quantity,
          originalBasePrice: basePrice,
          priceAtCheckout: Number(cartItem.dynamicPrice || basePrice),
          dynamicPricingWasApplied: cartItem.dynamicPrice && Number(cartItem.dynamicPrice) !== basePrice,
          clubReceives: Number(cartItem.dynamicPrice || basePrice) * cartItem.quantity,
          platformFee: (Number(cartItem.dynamicPrice || basePrice) * cartItem.quantity) * 0.025, // TODO: Use actual fee calculation
          platformFeeApplied: 0.025,
          isUsed: false
        });

        console.log(`[MENU-PURCHASE] Before save - transactionId: ${menuPurchase.transactionId}`);
        console.log(`[MENU-PURCHASE] Before save - hasTransaction: ${!!menuPurchase.transaction}`);

        const savedMenuPurchase = await transactionalEntityManager.save('MenuPurchase', menuPurchase);
        
        console.log(`[MENU-PURCHASE] After save - ID: ${savedMenuPurchase.id}, transactionId: ${savedMenuPurchase.transactionId}`);
        
        // Direct database verification
        const menuDirectQuery = await transactionalEntityManager.query(
          'SELECT id, "transactionId" FROM menu_purchase WHERE id = $1',
          [savedMenuPurchase.id]
        );
        console.log(`[MENU-PURCHASE] Direct DB query result:`, menuDirectQuery[0]);
        
        savedMenuPurchases.push(savedMenuPurchase);
      }

      console.log(`[UNIFIED-CHECKOUT-SERVICE] Saved ${savedMenuPurchases.length} menu purchases individually`);
      
      // Additional debugging - check if the relationship is working
      if (savedMenuPurchases.length > 0) {
        const verificationPurchase = await transactionalEntityManager.findOne('MenuPurchase', {
          where: { id: savedMenuPurchases[0]?.id },
          relations: ['transaction']
        });
        console.log(`[UNIFIED-CHECKOUT-SERVICE] Verification - transactionId: ${verificationPurchase?.transactionId}`);
        console.log(`[UNIFIED-CHECKOUT-SERVICE] Verification - transaction exists: ${!!verificationPurchase?.transaction}`);
      }

      // Generate QR code for menu transaction (transaction-level QR for standalone menu purchases)
      const menuPayload = {
        id: transaction.id,
        clubId: transaction.clubId,
        type: "menu" as const
      };

      const menuEncryptedPayload = await generateEncryptedQR(menuPayload);
      const menuQrDataUrl = await QRCode.toDataURL(menuEncryptedPayload);

      // Store QR in transaction for menu redemption
      transaction.qrPayload = menuEncryptedPayload;
      await transactionalEntityManager.update('UnifiedPurchaseTransaction', { id: transaction.id }, { qrPayload: menuEncryptedPayload });

      // Get club information for menu email
      const club = await transactionalEntityManager.findOne('Club', {
        where: { id: transaction.clubId }
      }) as any;

      // Send menu summary email (SEPARATE from ticket emails)
      const menuEmailItems = await Promise.all(menuItems.map(async (item: any) => {
        // Load menu item from database to get the name
        const menuItem = await transactionalEntityManager.findOne('MenuItem', {
          where: { id: item.menuItemId }
        }) as any;
        
        let variant = null;
        if (item.variantId) {
          variant = await transactionalEntityManager.findOne('MenuItemVariant', {
            where: { id: item.variantId }
          }) as any;
        }
        
        const menuItemName = menuItem?.name || 'Unknown Item';
        const variantName = (variant as any)?.name || null;
        const unitPrice = variant ? Number((variant as any).price) : Number(menuItem?.price || 0);
        
        return {
          name: menuItemName,
          variant: variantName,
          quantity: item.quantity,
          unitPrice: unitPrice
        };
      }));

      // Send separate menu email for standalone menu purchases
      await sendMenuEmail({
        to: transaction.buyerEmail,
        qrImageDataUrl: menuQrDataUrl,
        clubName: club?.name || "Your Club",
        items: menuEmailItems,
        total: transaction.menuSubtotal
      });

      console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Separate menu email sent for ${menuItems.length} standalone menu items`);
    }

    // Send transaction invoice email (only if not free checkout)
    if (transaction.totalPaid > 0) {
      try {
        // Get club information for invoice
        const club = await transactionalEntityManager.findOne('Club', {
          where: { id: transaction.clubId }
        }) as any;

        // Prepare items for invoice using actual purchase prices (with dynamic pricing)
        const invoiceItems: any[] = [];
        
        // Add ticket items with actual prices (use stored dynamic prices from cart)
        if (ticketItems.length > 0) {
          for (const cartItem of ticketItems) {
            const ticket = await transactionalEntityManager.findOne('Ticket', {
              where: { id: cartItem.ticketId }
            }) as any;
            
            if (ticket) {
              // Use the actual price that was charged during checkout (includes dynamic pricing)
              const actualPrice = Number(cartItem.dynamicPrice || ticket.price);
              
              invoiceItems.push({
                name: ticket.name,
                variant: null,
                quantity: cartItem.quantity,
                unitPrice: actualPrice,
                subtotal: actualPrice * cartItem.quantity
              });
            }
          }
        }
        
        // Add menu items with actual prices (use stored dynamic prices from cart)
        if (menuItems.length > 0) {
          for (const cartItem of menuItems) {
            const menuItem = await transactionalEntityManager.findOne('MenuItem', {
              where: { id: cartItem.menuItemId },
              relations: ['club']
            }) as any;
            
            if (menuItem) {
              let variant: any = null;
              if (cartItem.variantId) {
                variant = await transactionalEntityManager.findOne('MenuItemVariant', {
                  where: { id: cartItem.variantId }
                }) as any;
              }
              
              // Use the actual price that was charged during checkout (includes dynamic pricing)
              const actualPrice = Number(cartItem.dynamicPrice || (variant ? variant.price : menuItem.price));
              
              invoiceItems.push({
                name: menuItem.name,
                variant: variant?.name || null,
                quantity: cartItem.quantity,
                unitPrice: actualPrice,
                subtotal: actualPrice * cartItem.quantity
              });
            }
          }
        }

        // Calculate totals for invoice using actual transaction subtotals (with dynamic pricing)
        const actualSubtotal = Number(transaction.ticketSubtotal || 0) + Number(transaction.menuSubtotal || 0);
        const platformFees = Number(transaction.platformFeeAppliedTickets || 0) + Number(transaction.platformFeeAppliedMenu || 0);
        const gatewayFees = Number(transaction.gatewayFee || 0);
        const gatewayIVA = Number(transaction.gatewayIVA || 0);
        const total = Number(transaction.totalPaid || 0);
        
        console.log(`[UNIFIED-CHECKOUT-SERVICE] Invoice calculation with dynamic pricing:`, {
          invoiceItems: invoiceItems.map(item => ({
            name: item.name,
            variant: item.variant,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          })),
          calculatedSubtotal: invoiceItems.reduce((sum, item) => sum + item.subtotal, 0),
          actualSubtotal,
          ticketSubtotal: transaction.ticketSubtotal,
          menuSubtotal: transaction.menuSubtotal,
          platformFees,
          gatewayFees,
          gatewayIVA,
          total,
          platformFeeAppliedTickets: transaction.platformFeeAppliedTickets,
          platformFeeAppliedMenu: transaction.platformFeeAppliedMenu
        });

        await sendTransactionInvoiceEmail({
          to: transaction.buyerEmail,
          transactionId: transaction.id,
          clubName: club?.name || "Your Club",
          clubAddress: club?.address,
          clubPhone: club?.phone,
          clubEmail: club?.email,
          date: new Date().toISOString().split("T")[0],
          items: invoiceItems,
          subtotal: actualSubtotal,
          platformFees,
          gatewayFees,
          gatewayIVA,
          total,
          currency: "COP",
          paymentMethod: transaction.paymentMethod || "Credit/Debit Card",
          paymentProviderRef: transaction.paymentProviderTransactionId || transaction.id,
          customerInfo: {
            email: transaction.buyerEmail,
            fullName: transaction.customerFullName,
            phoneNumber: transaction.customerPhoneNumber,
            legalId: transaction.customerLegalId,
            legalIdType: transaction.customerLegalIdType
          }
        });

        console.log(`[UNIFIED-CHECKOUT-SERVICE] ✅ Transaction invoice email sent successfully`);
      } catch (invoiceError) {
        console.error(`[UNIFIED-CHECKOUT-SERVICE] ❌ Failed to send transaction invoice email:`, invoiceError);
        // Don't fail the checkout if invoice email fails
      }
    } else {
      console.log(`[UNIFIED-CHECKOUT-SERVICE] 🎁 FREE checkout - skipping invoice email (no payment)`);
    }

    // ✅ Mark as processed for idempotency
    (transaction as any).processedAt = new Date();
    // Save only the transaction without cascading to avoid relationship issues
    await transactionalEntityManager.update('UnifiedPurchaseTransaction', { id: transaction.id }, { processedAt: new Date() });
  }

  // 🚫 HARD-DEPRECATED: Do not call this method. It corrupts data by writing outside of the active transaction.
  private async processSuccessfulCheckout(
    _transaction: UnifiedPurchaseTransaction,
    _cartItems: any[]
  ): Promise<void> {
    throw new Error(
      'DEPRECATED: processSuccessfulCheckout(...) has been removed. ' +
      'Use processSuccessfulCheckoutInTransaction(transaction, cartItems, transactionalEntityManager) instead.'
    );
  }
}
