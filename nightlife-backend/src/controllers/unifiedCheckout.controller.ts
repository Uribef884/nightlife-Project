import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/express";
import { UnifiedCheckoutService } from "../services/unifiedCheckout.service";
import { lockAndValidateCart, updateCartLockTransactionId, unlockCart } from "../utils/cartLock";
import { sanitizeInput } from "../utils/sanitizeInput";
import { isDisposableEmail } from "../utils/disposableEmailValidator";
import { validateAuthInputs } from "../utils/authInputSanitizer";
import { wompiService } from "../services/wompi.service";
import { WOMPI_CONFIG } from "../config/wompi";
import { generateTransactionSignature } from "../utils/generateWompiSignature";
import { AppDataSource } from "../config/data-source";
import { UnifiedPurchaseTransaction } from "../entities/UnifiedPurchaseTransaction";
import { secureQuery, createQueryContext } from "../utils/secureQuery";
import { createQueryRateLimiter, strictRateLimiter } from "../middlewares/queryRateLimiter";
import { SSEController } from "./sse.controller";

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
  customerInfo: {
    fullName?: string;
    phoneNumber?: string;
    legalId?: string;
    legalIdType?: string;
    paymentMethod: string;
  };
}>();

export class UnifiedCheckoutController {
  private checkoutService = new UnifiedCheckoutService();

  /**
   * Get Wompi acceptance tokens for privacy policy and personal data processing
   * GET /checkout/unified/acceptance-tokens
   */
  getAcceptanceTokens = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log("[UNIFIED-CHECKOUT-ACCEPTANCE-TOKENS] Getting acceptance tokens...");
      
      const acceptanceTokens = await wompiService().getAcceptanceTokens();
      
      res.json(acceptanceTokens);
    } catch (error) {
      console.error("[UNIFIED-CHECKOUT-ACCEPTANCE-TOKENS] Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get acceptance tokens"
      });
    }
  };

  /**
   * Initiate unified checkout with Wompi integration
   * POST /checkout/unified/initiate
   * 
   * Phase 1: Immediate response with background processing
   */
  initiateCheckout = async (req: Request, res: Response): Promise<void> => {
    const typedReq = req as AuthenticatedRequest;
    const userId = typedReq.user?.id ?? null;
    const sessionId: string | null = !userId && typedReq.sessionId ? typedReq.sessionId : null;

    try {
      console.log(`[UNIFIED-CHECKOUT-INITIATE] Starting checkout for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);

      // Validate and sanitize email input
      const rawEmail = typedReq.user?.email ?? typedReq.body?.email;
      
      // Use proper email validation
      const emailValidation = validateAuthInputs({
        email: rawEmail?.toLowerCase().trim()
      });

      if (!emailValidation.isValid) {
        res.status(400).json({ 
          error: "Email inválido", 
          details: emailValidation.errors 
        });
        return;
      }

      const email = emailValidation.sanitized.email;

      if (!req.user && isDisposableEmail(email)) {
        res.status(403).json({ error: "Dominios de email desechables no están permitidos." });
        return;
      }

      // Lock and validate cart
      const tempTransactionId = "temp-" + Date.now();
      const cartValidation = await lockAndValidateCart(userId, sessionId, tempTransactionId, 'unified');
      if (!cartValidation.success) {
        res.status(400).json({ error: cartValidation.error });
        return;
      }

      const {
        paymentMethod,
        paymentData,
        installments = 1,
        redirect_url,
        customer_data
      } = typedReq.body;
      

      if (!paymentMethod) {
        res.status(400).json({ error: "Método de pago es requerido" });
        return;
      }

      // Check if this is a free checkout first
      const cartItems = await this.checkoutService.cartService.getCartItemsWithDynamicPricing(userId || undefined, sessionId || undefined);
      const totals = await this.checkoutService.cartService.calculateCartTotals(userId || undefined, sessionId || undefined);
      const isFreeCheckout = totals.totalSubtotal === 0;

      // Only validate payment method if it's NOT a free checkout
      if (!isFreeCheckout) {
        // Validate payment method specific data
        if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
          if (!paymentData || !paymentData.number || !paymentData.cvc || !paymentData.exp_month || !paymentData.exp_year || !paymentData.card_holder) {
            res.status(400).json({ error: "Datos completos de tarjeta son requeridos" });
            return;
          }
        } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
          if (!paymentData || !paymentData.phone_number) {
            res.status(400).json({ error: "Número de teléfono es requerido para pagos con Nequi" });
            return;
          }
        } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE) {
          if (!paymentData || !paymentData.user_legal_id || !paymentData.financial_institution_code || !customer_data?.full_name) {
            res.status(400).json({ error: "Datos completos de PSE incluyendo información del cliente son requeridos" });
            return;
          }
        } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
          if (!paymentData || !paymentData.payment_description) {
            res.status(400).json({ error: "Descripción de pago es requerida para Transferencia Bancolombia" });
            return;
          }
        } else if (!Object.values(WOMPI_CONFIG.PAYMENT_METHODS).includes(paymentMethod)) {
          res.status(400).json({ error: "Método de pago no soportado" });
          return;
        }
      } else {
        console.log("[UNIFIED-CHECKOUT-INITIATE] 🎁 Free checkout detected, skipping payment method validation");
      }

      // Enhanced customer information capture
      let customerInfo: {
        fullName?: string;
        phoneNumber?: string;
        legalId?: string;
        legalIdType?: string;
        paymentMethod: string;
      } = { 
        paymentMethod: isFreeCheckout ? 'FREE' : paymentMethod 
      };
      
      console.log('[UNIFIED-CHECKOUT-INITIATE] Customer info setup:', {
        isFreeCheckout,
        originalPaymentMethod: paymentMethod,
        finalPaymentMethod: customerInfo.paymentMethod
      });
      

      // Capture customer information based on payment method requirements
      if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.CARD) {
        if (paymentData?.card_holder) {
          customerInfo.fullName = paymentData.card_holder;
        }
      } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
        customerInfo.phoneNumber = paymentData.phone_number;
        if (customer_data?.full_name) {
          customerInfo.fullName = customer_data.full_name;
        }
      } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE) {
        customerInfo.legalId = paymentData.user_legal_id;
        customerInfo.legalIdType = paymentData.user_legal_id_type || "CC";
        customerInfo.fullName = customer_data.full_name;
        if (customer_data?.phone_number) {
          customerInfo.phoneNumber = customer_data.phone_number;
        }
      } else if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.BANCOLOMBIA_TRANSFER) {
        if (customer_data?.full_name) {
          customerInfo.fullName = customer_data.full_name;
        }
        if (customer_data?.phone_number) {
          customerInfo.phoneNumber = customer_data.phone_number;
        }
      }

      // Calculate totals and create transaction
      const result = await this.checkoutService.initiateCheckoutWithWompi(
        {
          email,
          paymentMethod,
          paymentData,
          installments,
          redirect_url,
          customer_data,
          customerInfo
        },
        userId || undefined,
        sessionId || undefined
      );

      // Store transaction data for background processing
      transactionStore.set(result.wompiTransactionId, {
        userId,
        sessionId,
        email,
        cartItems: cartValidation.cartItems!.map(item => ({
          itemType: item.itemType,
          ticketId: item.ticketId,
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          quantity: item.quantity,
          date: item.date,
          clubId: item.clubId
        })),
        totalAmount: result.totalPaid,
        acceptanceTokens: {}, // Not needed for unified checkout
        paymentSourceId: undefined,
        expiresAt: Date.now() + (30 * 60 * 1000), // 30 minutes
        customerInfo
      });

      // Get cart summary for price breakdown
      const cartSummary = await this.checkoutService.cartService.calculateCartSummary(userId || undefined, sessionId || undefined);

      // 🚀 Start automatic checkout flow in background
      console.log(`[UNIFIED-CHECKOUT-INITIATE] 🚀 Starting automatic checkout flow for transaction: ${result.transactionId}`);
      this.startAutomaticUnifiedCheckout(result.transactionId, req, res);

      // Return immediate response to user
      const response: any = {
        success: true,
        transactionId: result.transactionId,
        total: result.totalPaid,
        totalPaid: result.totalPaid, // Add totalPaid for frontend compatibility
        status: result.wompiStatus,
        message: "Checkout unificado iniciado exitosamente. Procesando pago automáticamente...",
        automaticCheckout: true,
        isFreeCheckout: result.isFreeCheckout,
        // Add cart summary for price breakdown
        subtotal: cartSummary.total,
        serviceFee: cartSummary.operationalCosts,
        discounts: 0,
        actualTotal: cartSummary.actualTotal,
        customerInfo: {
          fullName: customerInfo.fullName,
          phoneNumber: customerInfo.phoneNumber,
          paymentMethod: customerInfo.paymentMethod,
        },
      };

      // Handle redirect-based payment methods (PSE, Bancolombia Transfer)
      if (result.redirectUrl) {
        response.redirectUrl = result.redirectUrl;
        response.requiresRedirect = true;
        response.message = `Por favor completa el pago en ${paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.PSE ? 'tu banco' : 'Bancolombia'}. Procesaremos tu pedido automáticamente una vez que el pago esté completo.`;
      }

      // Handle immediate responses (Cards, Nequi)
      if (result.wompiStatus === WOMPI_CONFIG.STATUSES.APPROVED) {
        response.message = "Pago aprobado exitosamente. Procesando tu pedido...";
      } else if (result.wompiStatus === WOMPI_CONFIG.STATUSES.DECLINED) {
        response.error = "El pago fue rechazado";
        response.status = "DECLINED";
      } else if (result.wompiStatus === WOMPI_CONFIG.STATUSES.PENDING) {
        if (paymentMethod === WOMPI_CONFIG.PAYMENT_METHODS.NEQUI) {
          response.message = "Por favor revisa tu app de Nequi para completar el pago. Procesaremos tu pedido automáticamente una vez confirmado.";
        } else {
          response.message = "El pago está siendo procesado. Te actualizaremos automáticamente.";
        }
      }

      console.log(`[UNIFIED-CHECKOUT-INITIATE] Transaction created: ${result.transactionId}`);
      res.json(response);

    } catch (error: any) {
      console.error("[UNIFIED-CHECKOUT-INITIATE] Error:", error);
      
      // 🔓 Always try to unlock the cart on error
      try {
        await unlockCart(userId, sessionId);
        console.log(`[UNIFIED-CHECKOUT-INITIATE] 🔓 Cart unlocked after error for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
      } catch (unlockError) {
        console.error(`[UNIFIED-CHECKOUT-INITIATE] ❌ Failed to unlock cart after error:`, unlockError);
      }
      
      // Return more specific error message for free checkout issues
      let errorMessage = error.message || "Error al iniciar el checkout unificado";
      if (error.message?.includes("payment method not supported") || error.message?.includes("Método de pago no soportado")) {
        errorMessage = "Error en el procesamiento del checkout gratuito. Por favor, intenta de nuevo.";
      }
      
      res.status(400).json({ 
        error: errorMessage
      });
    }
  };

  /**
   * Confirm unified checkout (for manual confirmation if needed)
   * POST /checkout/unified/confirm
   * 
   * Note: With automatic checkout, this is mainly for manual confirmation
   */
  confirmCheckout = async (req: Request, res: Response): Promise<void> => {
    const typedReq = req as AuthenticatedRequest;
    const userId = typedReq.user?.id ?? null;
    const sessionId: string | null = !userId && typedReq.sessionId ? typedReq.sessionId : null;

    try {
      const { transactionId } = typedReq.body;

      if (!transactionId) {
        res.status(400).json({ error: "ID de transacción es requerido" });
        return;
      }

      console.log(`[UNIFIED-CHECKOUT-CONFIRM] Manual confirmation for transaction: ${transactionId}`);

      const result = await this.checkoutService.confirmCheckout(
        transactionId,
        userId || undefined,
        sessionId || undefined
      );

      res.status(200).json(result);
    } catch (err) {
      console.error("❌ Error confirming unified checkout:", err);
      res.status(500).json({ 
        error: err instanceof Error ? err.message : "Error del servidor confirmando checkout" 
      });
    }
  };

  /**
   * Get unified transaction status
   * GET /checkout/unified/status/:transactionId
   */
  getTransactionStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { transactionId } = req.params;

      if (!transactionId) {
        res.status(400).json({ error: "ID de transacción es requerido" });
        return;
      }

      console.log(`[UNIFIED-CHECKOUT-STATUS] Checking status for transaction ID: ${transactionId}`);

      // First check our database for the transaction
      const transactionRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
      
      const existingTransaction = await transactionRepo.findOne({
        where: { id: transactionId },
        relations: ['ticketPurchases', 'menuPurchases']
      });

      if (existingTransaction) {
        console.log(`[UNIFIED-CHECKOUT-STATUS] Found transaction in database: ${existingTransaction.id}`);
        console.log(`[UNIFIED-CHECKOUT-STATUS] Transaction details:`, {
          id: existingTransaction.id,
          paymentStatus: existingTransaction.paymentStatus,
          totalPaid: existingTransaction.totalPaid,
          buyerEmail: existingTransaction.buyerEmail,
          paymentMethod: existingTransaction.paymentMethod,
          paymentProvider: existingTransaction.paymentProvider,
          ticketSubtotal: existingTransaction.ticketSubtotal,
          menuSubtotal: existingTransaction.menuSubtotal,
          gatewayFee: existingTransaction.gatewayFee,
          gatewayIVA: existingTransaction.gatewayIVA
        });
        
        const calculatedSubtotal = (existingTransaction.ticketSubtotal + existingTransaction.menuSubtotal);
        const calculatedServiceFee = (existingTransaction.gatewayFee + existingTransaction.gatewayIVA);
        
        console.log(`[UNIFIED-CHECKOUT-STATUS] Calculated values:`, {
          calculatedSubtotal,
          calculatedServiceFee,
          ticketSubtotalRaw: existingTransaction.ticketSubtotal,
          menuSubtotalRaw: existingTransaction.menuSubtotal,
          gatewayFeeRaw: existingTransaction.gatewayFee,
          gatewayIVARaw: existingTransaction.gatewayIVA
        });
        
        res.json({
          transactionId: existingTransaction.id,
          status: existingTransaction.paymentStatus,
          amount: existingTransaction.totalPaid,
          totalPaid: existingTransaction.totalPaid,
          currency: 'COP',
          customerEmail: existingTransaction.buyerEmail,
          createdAt: existingTransaction.createdAt,
          finalizedAt: existingTransaction.updatedAt,
          isFreeCheckout: existingTransaction.paymentProvider === 'free',
          paymentMethod: existingTransaction.paymentMethod,
          // Financial breakdown fields
          subtotal: (existingTransaction.ticketSubtotal + existingTransaction.menuSubtotal),
          serviceFee: (existingTransaction.gatewayFee + existingTransaction.gatewayIVA),
          discounts: 0, // No discounts implemented yet
          total: existingTransaction.totalPaid,
          actualTotal: existingTransaction.totalPaid,
          lineItemsCount: (existingTransaction.ticketPurchases?.length || 0) + (existingTransaction.menuPurchases?.length || 0)
        });
        return;
      }

      // If not found in database, fall back to Wompi status check
      console.log(`[UNIFIED-CHECKOUT-STATUS] Transaction not found in database, checking Wompi: ${transactionId}`);
      const transactionStatus = await wompiService().getTransactionStatus(transactionId);
      
      res.json({
        transactionId,
        status: transactionStatus.data.status,
        amount: transactionStatus.data.amount_in_cents / 100,
        currency: transactionStatus.data.currency,
        reference: transactionStatus.data.reference,
        customerEmail: transactionStatus.data.customer_email,
        createdAt: transactionStatus.data.created_at,
        finalizedAt: transactionStatus.data.finalized_at,
      });
      return;

    } catch (error: any) {
      console.error(`[UNIFIED-CHECKOUT-STATUS] Error:`, error);
      res.status(500).json({ 
        error: error.message || "Error al verificar el estado de la transacción" 
      });
    }
  };

  /**
   * 🚀 AUTOMATIC CHECKOUT FLOW: Polls Wompi until transaction is resolved
   * This function runs in the background and automatically processes the checkout
   */
  private async startAutomaticUnifiedCheckout(transactionId: string, req: Request, res: Response): Promise<void> {
    console.log(`[UNIFIED-CHECKOUT-AUTO] 🚀 Starting automatic checkout for transaction: ${transactionId}`);
    
    try {
      // First, get the Wompi transaction ID from our database
      const transactionRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
      const transaction = await transactionRepo.findOne({
        where: { id: transactionId }
      });

      if (!transaction) {
        console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ Transaction not found in database: ${transactionId}`);
        return;
      }

      const wompiTransactionId = transaction.paymentProviderTransactionId;
      if (!wompiTransactionId) {
        console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ No Wompi transaction ID found for transaction: ${transactionId}`);
        return;
      }

      console.log(`[UNIFIED-CHECKOUT-AUTO] Using Wompi transaction ID: ${wompiTransactionId} for unified transaction: ${transactionId}`);

      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      const pollInterval = 5000; // 5 seconds
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`[UNIFIED-CHECKOUT-AUTO] Polling attempt ${attempts}/${maxAttempts} for Wompi transaction: ${wompiTransactionId}`);
        
        try {
          // Get transaction status from Wompi using the Wompi transaction ID
          const transactionStatus = await wompiService().getTransactionStatus(wompiTransactionId);
          const status = transactionStatus.data.status;
          
          console.log(`[UNIFIED-CHECKOUT-AUTO] Transaction ${transactionId} status: ${status}`);
          
          if (status === WOMPI_CONFIG.STATUSES.APPROVED) {
            // ✅ APPROVED → Process checkout, send email
            console.log(`[UNIFIED-CHECKOUT-AUTO] ✅ Transaction approved! Processing checkout...`);
            
            // Update transaction status to APPROVED and broadcast via SSE
            await this.updateUnifiedTransactionStatus(transactionId, "APPROVED");
            
            // Get stored transaction data
            const storedData = this.getStoredTransactionData(wompiTransactionId);
            if (!storedData) {
              console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ No stored data found for transaction: ${wompiTransactionId}`);
              return;
            }
            
            // Process the successful checkout using stored data
            await this.processWompiSuccessfulUnifiedCheckout({
              userId: storedData.userId,
              sessionId: storedData.sessionId,
              email: storedData.email,
              req,
              res,
              transactionId,
              cartItems: storedData.cartItems,
            });
            
            // Remove stored data AFTER checkout is complete and cart is unlocked
            this.removeStoredTransactionData(wompiTransactionId);
            
            console.log(`[UNIFIED-CHECKOUT-AUTO] ✅ Checkout completed successfully for transaction: ${transactionId}`);
            return;
            
          } else if (status === WOMPI_CONFIG.STATUSES.DECLINED) {
            // ❌ DECLINED → Update status, unlock cart, inform user
            console.log(`[UNIFIED-CHECKOUT-AUTO] ❌ Transaction declined: ${wompiTransactionId}`);
            
            await this.updateUnifiedTransactionStatus(transactionId, "DECLINED");
            
            // Get stored transaction data to unlock cart
            const storedData = this.getStoredTransactionData(wompiTransactionId);
            if (storedData) {
              try {
                await unlockCart(storedData.userId, storedData.sessionId);
                console.log(`[UNIFIED-CHECKOUT-AUTO] ✅ Cart unlocked after decline for ${storedData.userId ? 'user' : 'session'}: ${storedData.userId || storedData.sessionId}`);
              } catch (unlockError) {
                console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ Failed to unlock cart after decline:`, unlockError);
              }
              // Remove stored data
              this.removeStoredTransactionData(wompiTransactionId);
            }
            
            console.log(`[UNIFIED-CHECKOUT-AUTO] ❌ Transaction marked as declined: ${transactionId}`);
            return;
            
          } else if (status === WOMPI_CONFIG.STATUSES.ERROR) {
            // ❌ ERROR → Map to error, unlock cart, inform user
            console.log(`[UNIFIED-CHECKOUT-AUTO] ❌ Transaction error: ${wompiTransactionId}`);
            
            await this.updateUnifiedTransactionStatus(transactionId, "ERROR");
            
            // Get stored transaction data to unlock cart
            const storedData = this.getStoredTransactionData(wompiTransactionId);
            if (storedData) {
              try {
                await unlockCart(storedData.userId, storedData.sessionId);
                console.log(`[UNIFIED-CHECKOUT-AUTO] ✅ Cart unlocked after error for ${storedData.userId ? 'user' : 'session'}: ${storedData.userId || storedData.sessionId}`);
              } catch (unlockError) {
                console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ Failed to unlock cart after error:`, unlockError);
              }
              // Remove stored data
              this.removeStoredTransactionData(wompiTransactionId);
            }
            
            console.log(`[UNIFIED-CHECKOUT-AUTO] ❌ Transaction marked as declined due to error: ${transactionId}`);
            return;
            
          } else if (status === WOMPI_CONFIG.STATUSES.PENDING) {
            // ⏰ PENDING → Continue polling
            console.log(`[UNIFIED-CHECKOUT-AUTO] ⏰ Transaction pending, continuing to poll...`);
            
            // For pending transactions, wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
            
          } else {
            // Unknown status, log and continue
            console.log(`[UNIFIED-CHECKOUT-AUTO] ⚠️ Unknown status: ${status}, continuing to poll...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            continue;
          }
          
        } catch (pollError: any) {
          console.error(`[UNIFIED-CHECKOUT-AUTO] Polling error on attempt ${attempts}:`, pollError);
          
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
      
      // ⏰ TIMEOUT → Inform user payment is processing, unlock cart
      console.log(`[UNIFIED-CHECKOUT-AUTO] ⏰ Timeout reached for transaction: ${transactionId}`);
      
      // Update transaction status to indicate timeout
      await this.updateUnifiedTransactionStatus(transactionId, "TIMEOUT");
      
      // Get stored transaction data to unlock cart
      const storedData = this.getStoredTransactionData(wompiTransactionId);
      if (storedData) {
        try {
          await unlockCart(storedData.userId, storedData.sessionId);
          console.log(`[UNIFIED-CHECKOUT-AUTO] ✅ Cart unlocked after timeout for ${storedData.userId ? 'user' : 'session'}: ${storedData.userId || storedData.sessionId}`);
        } catch (unlockError) {
          console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ Failed to unlock cart after timeout:`, unlockError);
        }
        // Remove stored data
        this.removeStoredTransactionData(wompiTransactionId);
      }
      
      console.log(`[UNIFIED-CHECKOUT-AUTO] ⏰ Transaction marked as timeout: ${transactionId}`);
      
    } catch (error: any) {
      console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ Fatal error in automatic checkout:`, error);
      
      // Try to update transaction status to indicate error
      try {
        await this.updateUnifiedTransactionStatus(transactionId, "ERROR");
      } catch (updateError) {
        console.error(`[UNIFIED-CHECKOUT-AUTO] Failed to update transaction status:`, updateError);
      }
      
      // Try to unlock cart even on fatal error
      try {
        // Get the Wompi transaction ID from the database
        const transactionRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
        const transaction = await transactionRepo.findOne({
          where: { id: transactionId }
        });
        
        if (transaction?.paymentProviderTransactionId) {
          const storedData = this.getStoredTransactionData(transaction.paymentProviderTransactionId);
          if (storedData) {
            await unlockCart(storedData.userId, storedData.sessionId);
            console.log(`[UNIFIED-CHECKOUT-AUTO] ✅ Cart unlocked after fatal error for ${storedData.userId ? 'user' : 'session'}: ${storedData.userId || storedData.sessionId}`);
            // Remove stored data
            this.removeStoredTransactionData(transaction.paymentProviderTransactionId);
          }
        }
      } catch (unlockError) {
        console.error(`[UNIFIED-CHECKOUT-AUTO] ❌ Failed to unlock cart after fatal error:`, unlockError);
      }
    }
  }

  /**
   * Process successful Wompi unified checkout (mirror legacy pattern)
   */
  public async processWompiSuccessfulUnifiedCheckout({
    userId,
    sessionId,
    email,
    req,
    res,
    transactionId,
    cartItems,
  }: {
    userId: string | null;
    sessionId: string | null;
    email: string;
    req: Request;
    res: Response;
    transactionId: string;
    cartItems: any[];
  }) {
    try {
      console.log(`[UNIFIED-CHECKOUT] Processing successful checkout for transaction: ${transactionId}`);

      // Process the successful checkout using the service
      const result = await this.checkoutService.processSuccessfulCheckoutWithStoredData(
        transactionId,
        cartItems,
        userId || undefined,
        sessionId || undefined
      );

      console.log(`[UNIFIED-CHECKOUT] ✅ Checkout completed successfully for transaction: ${transactionId}`);
      return result;

    } catch (error: any) {
      console.error(`[UNIFIED-CHECKOUT] Error processing successful checkout:`, error);
      
      // 🔓 Always try to unlock the cart, even if checkout fails
      try {
        await unlockCart(userId, sessionId);
        console.log(`[UNIFIED-CHECKOUT] ✅ Cart unlocked after checkout failure for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
      } catch (unlockError) {
        console.error(`[UNIFIED-CHECKOUT] ❌ Failed to unlock cart after checkout failure:`, unlockError);
      }
      
      throw error;
    }
  }

  /**
   * Helper function to get stored transaction data
   */
  private getStoredTransactionData(transactionId: string) {
    const data = transactionStore.get(transactionId);
    if (!data) return null;
    
    // Check if expired
    if (Date.now() > data.expiresAt) {
      transactionStore.delete(transactionId);
      return null;
    }
    
    return data;
  }

  /**
   * Helper function to remove stored transaction data
   */
  private removeStoredTransactionData(transactionId: string) {
    transactionStore.delete(transactionId);
  }

  /**
   * Helper function to update unified transaction status in database
   */
  private async updateUnifiedTransactionStatus(transactionId: string, status: string): Promise<void> {
    try {
      const transactionRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
      const existingTransaction = await transactionRepo.findOne({
        where: { id: transactionId }
      });

      if (existingTransaction) {
        // Map statuses to valid database values
        let mappedStatus: "APPROVED" | "DECLINED" | "PENDING" | "VOIDED" | "ERROR";
        
        if (status === "APPROVED" || status === "PENDING" || status === "VOIDED" || status === "ERROR") {
          mappedStatus = status;
        } else if (status === "TIMEOUT") {
          // Map TIMEOUT to ERROR since we don't have a TIMEOUT status in DB
          mappedStatus = "ERROR";
        } else {
          // Map any other unknown status to DECLINED
          mappedStatus = "DECLINED";
        }
        
        existingTransaction.paymentStatus = mappedStatus;
        await transactionRepo.save(existingTransaction);
        console.log(`[UNIFIED-CHECKOUT-AUTO] Updated transaction status to ${mappedStatus} (from ${status}): ${existingTransaction.id}`);
        
        // Broadcast status update via SSE
        SSEController.broadcastStatusUpdate(transactionId, mappedStatus, {
          originalStatus: status,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn(`[UNIFIED-CHECKOUT-AUTO] Transaction not found for status update: ${transactionId}`);
      }
    } catch (error) {
      console.error(`[UNIFIED-CHECKOUT-AUTO] Error updating transaction status:`, error);
    }
  }

  /**
   * DEBUG: Unlock cart (temporary endpoint for debugging)
   * POST /checkout/unified/debug/unlock-cart
   */
  debugUnlockCart = async (req: Request, res: Response): Promise<void> => {
    const typedReq = req as AuthenticatedRequest;
    const userId = typedReq.user?.id ?? null;
    const sessionId: string | null = !userId && typedReq.sessionId ? typedReq.sessionId : null;

    try {
      console.log(`[DEBUG-UNLOCK-CART] Attempting to unlock cart for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
      
      const unlocked = unlockCart(userId, sessionId);
      
      if (unlocked) {
        console.log(`[DEBUG-UNLOCK-CART] ✅ Cart successfully unlocked for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
        res.json({ 
          success: true, 
          message: "Cart unlocked successfully",
          userId: userId || null,
          sessionId: sessionId || null
        });
      } else {
        console.log(`[DEBUG-UNLOCK-CART] ℹ️ No cart lock found for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
        res.json({ 
          success: true, 
          message: "No cart lock found (cart was not locked)",
          userId: userId || null,
          sessionId: sessionId || null
        });
      }
    } catch (error: any) {
      console.error(`[DEBUG-UNLOCK-CART] ❌ Error unlocking cart:`, error);
      res.status(500).json({ 
        error: "Failed to unlock cart",
        details: error.message 
      });
    }
  };
}

// Export controller instance
export const unifiedCheckoutController = new UnifiedCheckoutController();
