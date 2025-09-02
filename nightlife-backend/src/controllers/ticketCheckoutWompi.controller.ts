import { Request, Response } from "express";
import { wompiService } from "../services/wompi.service";
import { WOMPI_CONFIG } from "../config/wompi";
import { getStoredTransactionData, removeStoredTransactionData } from "./ticketInitiateWompi.controller";
import { AuthenticatedRequest } from "../types/express";
import { AppDataSource } from "../config/data-source";
import { PurchaseTransaction } from "../entities/TicketPurchaseTransaction";
import { TicketPurchase } from "../entities/TicketPurchase";
import { CartItem } from "../entities/TicketCartItem";
import { Ticket } from "../entities/Ticket";
import { generateEncryptedQR } from "../utils/generateEncryptedQR";
import { sendTicketEmail, sendUnifiedTicketEmail, sendTransactionInvoiceEmail } from "../services/emailService";
import { computeDynamicEventPrice, computeDynamicPrice, getNormalTicketDynamicPricingReason, getEventTicketDynamicPricingReason } from "../utils/dynamicPricing";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { MenuItemFromTicket } from "../entities/MenuItemFromTicket";
import { getTicketCommissionRate } from "../config/fees";
import { calculatePlatformFee, calculateGatewayFees } from "../utils/ticketfeeUtils";
import { differenceInMinutes } from "date-fns";
import * as QRCode from "qrcode";
import { unlockCart } from "../utils/cartLock";

export const confirmWompiTicketCheckout = async (req: Request, res: Response) => {
  const typedReq = req as AuthenticatedRequest;
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  try {
    console.log(`[WOMPI-TICKET-CHECKOUT] Confirming transaction: ${transactionId}`);

    // Get stored transaction data
    const storedData = getStoredTransactionData(transactionId);
    if (!storedData) {
      return res.status(400).json({ error: "Transaction not found or expired" });
    }

    // Check Wompi transaction status
    const transactionStatus = await wompiService().getTransactionStatus(transactionId);
    
    console.log(`[WOMPI-TICKET-CHECKOUT] Transaction status: ${transactionStatus.data.status}`);

    if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.APPROVED) {
      // Transaction is approved, proceed with checkout
      console.log(`[WOMPI-TICKET-CHECKOUT] Transaction approved, processing checkout...`);
      
      // Update the existing pending transaction instead of creating a new one
      const result = await processWompiSuccessfulCheckout({
        userId: storedData.userId,
        sessionId: storedData.sessionId,
        email: storedData.email,
        req,
        res,
        transactionId,
        cartItems: storedData.cartItems,
      });
      
      // Remove stored data AFTER checkout is complete and cart is unlocked
      removeStoredTransactionData(transactionId);
      
      return result;

    } else if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.DECLINED) {
      console.log(`[WOMPI-TICKET-CHECKOUT] Transaction declined: ${transactionId}`);
      
      // Update the existing transaction status to DECLINED
      await updateTransactionStatus(transactionId, "DECLINED");
      
      removeStoredTransactionData(transactionId);
      return res.status(400).json({ 
        error: "Payment was declined",
        status: "DECLINED"
      });

    } else if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.ERROR) {
      console.log(`[WOMPI-TICKET-CHECKOUT] Transaction error: ${transactionId}`);
      
      // Update the existing transaction status to ERROR (map to DECLINED in our system)
      await updateTransactionStatus(transactionId, "DECLINED");
      
      removeStoredTransactionData(transactionId);
      return res.status(400).json({ 
        error: "Payment processing error",
        status: "ERROR"
      });

    } else if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.PENDING) {
      // For pending transactions, poll until resolved
      console.log(`[WOMPI-TICKET-CHECKOUT] Transaction pending, polling for status...`);
      
      try {
        const finalStatus = await wompiService().pollTransactionStatus(transactionId);
        
        if (finalStatus.data.status === WOMPI_CONFIG.STATUSES.APPROVED) {
          // Update the existing pending transaction instead of creating a new one
          const result = await processWompiSuccessfulCheckout({
            userId: storedData.userId,
            sessionId: storedData.sessionId,
            email: storedData.email,
            req,
            res,
            transactionId,
            cartItems: storedData.cartItems,
          });
          
          // Remove stored data AFTER checkout is complete and cart is unlocked
          removeStoredTransactionData(transactionId);
          
          return result;
        } else {
          removeStoredTransactionData(transactionId);
          return res.status(400).json({ 
            error: `Payment was ${finalStatus.data.status.toLowerCase()}`,
            status: finalStatus.data.status
          });
        }
      } catch (pollError: any) {
        console.error(`[WOMPI-TICKET-CHECKOUT] Polling error:`, pollError);
        return res.status(400).json({ 
          error: pollError.message || "Payment polling failed",
          status: "TIMEOUT"
        });
      }
    }

  } catch (error: any) {
    console.error(`[WOMPI-TICKET-CHECKOUT] Error:`, error);
    return res.status(500).json({ 
      error: error.message || "Failed to confirm Wompi checkout" 
    });
  }
};

// Helper endpoint to check transaction status without processing
export const checkWompiTransactionStatus = async (req: Request, res: Response) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  console.log(`[WOMPI-TICKET-STATUS] Checking status for transaction ID: ${transactionId}`);

  try {
    // First check our database for the transaction
    const transactionRepo = AppDataSource.getRepository(PurchaseTransaction);
    
    // Log all transactions to debug
    const allTransactions = await transactionRepo.find({
      select: ['id', 'paymentProviderTransactionId', 'paymentStatus', 'totalPaid', 'email']
    });
    console.log(`[WOMPI-TICKET-STATUS] All transactions in database:`, allTransactions);
    
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: transactionId },
      relations: ["purchases"]
    });

    if (existingTransaction) {
      console.log(`[WOMPI-TICKET-STATUS] Found transaction in database: ${existingTransaction.id}`);
      console.log(`[WOMPI-TICKET-STATUS] Transaction details:`, {
        id: existingTransaction.id,
        paymentProviderTransactionId: existingTransaction.paymentProviderTransactionId,
        paymentStatus: existingTransaction.paymentStatus,
        totalPaid: existingTransaction.totalPaid,
        email: existingTransaction.email
      });
      
      return res.json({
        transactionId: existingTransaction.paymentProviderTransactionId,
        id: existingTransaction.id,
        status: existingTransaction.paymentStatus,
        amount: existingTransaction.totalPaid,
        currency: 'COP',
        reference: existingTransaction.paymentProviderReference,
        customerEmail: existingTransaction.email,
        createdAt: existingTransaction.createdAt,
        finalizedAt: existingTransaction.updatedAt,
      });
    }

    // If not found in database, fall back to Wompi status check
    console.log(`[WOMPI-TICKET-STATUS] Transaction not found in database, checking Wompi: ${transactionId}`);
    const transactionStatus = await wompiService().getTransactionStatus(transactionId);
    
    return res.json({
      transactionId,
      status: transactionStatus.data.status,
      amount: transactionStatus.data.amount_in_cents / 100,
      currency: transactionStatus.data.currency,
      reference: transactionStatus.data.reference,
      customerEmail: transactionStatus.data.customer_email,
      createdAt: transactionStatus.data.created_at,
      finalizedAt: transactionStatus.data.finalized_at,
    });

  } catch (error: any) {
    console.error(`[WOMPI-TICKET-STATUS] Error:`, error);
    return res.status(500).json({ 
      error: error.message || "Failed to check transaction status" 
    });
  }
};

/**
 * Process successful Wompi checkout by updating existing transaction
 * instead of creating a new one (which would cause duplicate key error)
 */
export async function processWompiSuccessfulCheckout({
  userId,
  sessionId,
  email,
  req,
  res,
  transactionId,
  cartItems,
  isFreeCheckout = false,
}: {
  userId: string | null;
  sessionId: string | null;
  email: string;
  req: Request;
  res: Response;
  transactionId: string;
  cartItems: any[];
  isFreeCheckout?: boolean;
}) {
  // Declare existingTransaction outside try block so it's accessible in catch
  let existingTransaction: any = null;
  
  try {
    console.log(`[WOMPI-TICKET-CHECKOUT] Processing successful checkout for transaction: ${transactionId}`);

    // Reload cart items with proper relations (mirror legacy)
    const freshCartRepo = AppDataSource.getRepository(CartItem);
    const where = userId !== null ? { userId } : sessionId !== null ? { sessionId } : undefined;
    if (!where) {
      return res.status(400).json({ error: "Missing session or user" });
    }

    const freshCartItems = await freshCartRepo.find({
      where,
      relations: ["ticket", "ticket.club", "ticket.event"],
    });

    if (!freshCartItems.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Use fresh cart items with proper relations
    cartItems = freshCartItems;

    // 🎁 Handle free checkout (no payment processing needed)
    if (isFreeCheckout) {
      console.log(`[WOMPI-TICKET-CHECKOUT] 🎁 Processing FREE checkout - creating transaction record`);
      
      // For free checkouts, create a new transaction record
      const freeTransactionId = `free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      transactionId = freeTransactionId;
      
      // We'll create the transaction record later in the flow after transactionRepo is declared
      console.log(`[WOMPI-TICKET-CHECKOUT] 🎁 Will create free transaction record later in the flow`);
    }

    // Find and update the existing pending transaction
    const transactionRepo = AppDataSource.getRepository(PurchaseTransaction);
    
    if (isFreeCheckout) {
      // For free checkouts, create a new transaction record
      console.log(`[WOMPI-TICKET-CHECKOUT] 🎁 Creating new transaction for FREE checkout`);
      
      // Create a new transaction record for free checkout
      const newTransaction = transactionRepo.create({
        userId: userId || undefined,
        email: email,
        clubId: cartItems[0].ticket.clubId,
        date: new Date(), // Use current date for free transactions
        totalPaid: 0,
        clubReceives: 0,
        platformReceives: 0,
        gatewayFee: 0,
        gatewayIVA: 0,
        paymentStatus: "APPROVED",
        paymentProvider: "free",
        paymentProviderReference: transactionId,
        paymentProviderTransactionId: transactionId
      });
      
      await transactionRepo.save(newTransaction);
      existingTransaction = newTransaction;
      
      console.log(`[WOMPI-TICKET-CHECKOUT] 🎁 Created free transaction: ${newTransaction.id}`);
    } else {
      existingTransaction = await transactionRepo.findOne({
        where: { paymentProviderTransactionId: transactionId }
      });

      if (!existingTransaction) {
        console.error(`[WOMPI-TICKET-CHECKOUT] No pending transaction found for ID: ${transactionId}`);
        return res.status(400).json({ error: "Transaction not found" });
      }
    }

    // Get the current Wompi transaction status to confirm it's actually approved
    if (!isFreeCheckout) {
      const wompiStatus = await wompiService().getTransactionStatus(transactionId);
      const finalStatus = wompiStatus.data.status.toUpperCase();
      
      console.log(`[WOMPI-TICKET-CHECKOUT] Wompi transaction status: ${finalStatus}`);
      
      // Only proceed if Wompi confirms the transaction is approved
      if (finalStatus !== "APPROVED") {
        console.error(`[WOMPI-TICKET-CHECKOUT] Transaction not approved in Wompi. Status: ${finalStatus}`);
        return res.status(400).json({ 
          error: `Payment not approved. Status: ${finalStatus}`,
          status: finalStatus
        });
      }
    } else {
      console.log(`[WOMPI-TICKET-CHECKOUT] 🎁 FREE checkout - skipping Wompi validation`);
    }

    // 🎯 GET TRANSACTION TOTALS
    let totalPaid: number;
    let totalClubReceives: number;
    let totalPlatformReceives: number;
    let totalGatewayFee: number;
    let gatewayIVA: number;

    if (isFreeCheckout) {
      // For free checkouts, all amounts are 0
      console.log(`🎫 [WOMPI-TICKET-CHECKOUT] FREE CHECKOUT - All amounts are 0`);
      totalPaid = 0;
      totalClubReceives = 0;
      totalPlatformReceives = 0;
      totalGatewayFee = 0;
      gatewayIVA = 0;
    } else {
      // Use existing transaction totals (legacy approach)
      totalPaid = Number(existingTransaction.totalPaid);
      totalClubReceives = Number(existingTransaction.clubReceives);
      totalPlatformReceives = Number(existingTransaction.platformReceives);
      totalGatewayFee = Number(existingTransaction.gatewayFee);
      gatewayIVA = Number(existingTransaction.gatewayIVA);
    }

    console.log(`🎫 [WOMPI-TICKET-CHECKOUT] USING ORIGINAL TRANSACTION TOTALS:`);
    console.log(`   Total Paid: ${totalPaid}`);
    console.log(`   Total Club Receives: ${totalClubReceives}`);
    console.log(`   Total Platform Receives: ${totalPlatformReceives}`);
    console.log(`   Gateway Fee: ${totalGatewayFee}`);
    console.log(`   Gateway IVA: ${gatewayIVA}`);
    
    // ✅ VALIDATION: Check if this matches what was sent to Wompi
    if (!isFreeCheckout) {
      const wompiValidationStatus = await wompiService().getTransactionStatus(transactionId);
      const wompiAmountInCents = wompiValidationStatus.data.amount_in_cents;
      const ourAmountInCents = Math.round(totalPaid * 100);
      
      console.log(`🔍 [WOMPI-TICKET-CHECKOUT] AMOUNT VALIDATION:`);
      console.log(`   Wompi Amount (cents): ${wompiAmountInCents}`);
      console.log(`   Our Stored (cents): ${ourAmountInCents}`);
      console.log(`   Difference: ${wompiAmountInCents - ourAmountInCents}`);
      
      if (Math.abs(wompiAmountInCents - ourAmountInCents) > 1) { // Allow 1 cent rounding diff
        console.error(`❌ [WOMPI-TICKET-CHECKOUT] AMOUNT MISMATCH DETECTED!`);
        console.error(`   Wompi charged: ${wompiAmountInCents / 100} COP`);
        console.error(`   We stored: ${ourAmountInCents / 100} COP`);
        console.error(`   This should not happen with the legacy approach!`);
      }

      // Simply update the payment status - amounts remain unchanged
      existingTransaction.paymentStatus = "APPROVED";
      await transactionRepo.save(existingTransaction);
    } else {
      console.log(`🔍 [WOMPI-TICKET-CHECKOUT] FREE CHECKOUT - skipping amount validation and payment status update`);
    }
    
    console.log(`[WOMPI-TICKET-CHECKOUT] Updated transaction status to APPROVED: ${existingTransaction.id}`);

    // Check cart expiration (mirror legacy)
    const oldest = cartItems.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
    const age = differenceInMinutes(new Date(), new Date(oldest.createdAt));
    if (age > 30) {
      const expiredCartRepo = AppDataSource.getRepository(CartItem);
      const whereClause = userId ? { userId } : sessionId ? { sessionId } : null;
      if (whereClause) {
        await expiredCartRepo.delete(whereClause);
      }
      return res.status(400).json({ error: "Cart expired. Please start over." });
    }

    // Check if tickets are still active (mirror legacy)
    for (const item of cartItems) {
      // Ensure ticket relation is loaded
      if (!item.ticket) {
        console.error(`[WOMPI-TICKET-CHECKOUT] Ticket relation not loaded for cart item ${item.id}`);
        continue;
      }
      if (!item.ticket.isActive) {
        return res.status(400).json({
          error: `The ticket "${item.ticket.name}" is no longer available for purchase.`,
        });
      }
    }

    // 🎯 Improved date validation with timezone handling (mirror legacy)
    let cartDate: Date;
    if (cartItems[0].date instanceof Date) {
      cartDate = cartItems[0].date;
    } else {
      // If it's a string, parse it properly
      const dateStr = String(cartItems[0].date);
      const [year, month, day] = dateStr.split("-").map(Number);
      cartDate = new Date(year, month - 1, day);
    }
    
    // Get today's date in the same timezone (start of day)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // Compare dates properly
    if (cartDate < todayStart) {
      console.log(`[WOMPI-TICKET-CHECKOUT] Date validation failed: cartDate=${cartDate.toISOString()}, todayStart=${todayStart.toISOString()}`);
      return res.status(400).json({ error: "Cannot select a past date" });
    }

    // Clear cart items
    const cartRepo = AppDataSource.getRepository(CartItem);
    const whereClause = userId ? { userId } : sessionId ? { sessionId } : null;
    
    if (whereClause) {
      await cartRepo.delete(whereClause);
      console.log(`[WOMPI-TICKET-CHECKOUT] Cleared cart for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
    }
    
    const date = cartDate; // Use the validated date
    const purchaseDate = new Date(); // Current date for invoice
    const dateStr = date.toISOString().split("T")[0]; // Format date for invoice
    const purchaseDateStr = purchaseDate.toISOString().split("T")[0]; // Format purchase date for invoice

    // First, update ticket quantities (mirror legacy)
    const ticketRepo = AppDataSource.getRepository(Ticket);
    for (const item of cartItems) {
      const ticket = item.ticket;
      const quantity = item.quantity;

      if (ticket.quantity != null) {
        const updatedTicket = await ticketRepo.findOneByOrFail({ id: ticket.id });
        if ((updatedTicket.quantity ?? 0) < quantity) {
          return res.status(400).json({ error: `Not enough tickets left for ${ticket.name}` });
        }
        updatedTicket.quantity = (updatedTicket.quantity ?? 0) - quantity;
        await ticketRepo.save(updatedTicket);
      }
    }

    // Create ticket purchases for each cart item
    const ticketPurchaseRepo = AppDataSource.getRepository(TicketPurchase);
    
    // Calculate total tickets across all cart items for proper numbering (ONCE, before the loop)
    const totalTicketsInCart = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    let globalTicketCounter = 0;
    
    for (const cartItem of cartItems) {
      const ticket = await ticketRepo.findOne({ 
        where: { id: cartItem.ticketId },
        relations: ['club', 'event'] // Load club and event relations for dynamic pricing
      });
      if (!ticket) {
        console.warn(`[WOMPI-TICKET-CHECKOUT] Ticket not found: ${cartItem.ticketId}`);
        continue;
      }
      
      // Create individual ticket purchases with proper pricing and QR codes
      for (let i = 0; i < cartItem.quantity; i++) {
        globalTicketCounter++; // Increment global counter for each ticket
        const basePrice = Number(ticket.price);
        
        // 🎯 Apply dynamic pricing if enabled
        let dynamicPrice = basePrice;
        let dynamicPricingReason: string | undefined;
        
        if (ticket.dynamicPricingEnabled) {
          if (ticket.category === "event" && ticket.event) {
            // Event ticket - use event's date and openHours for dynamic pricing
            dynamicPrice = computeDynamicEventPrice(basePrice, new Date(ticket.event.availableDate), ticket.event.openHours);
            
            // Check if event has passed grace period
            if (dynamicPrice === -1) {
              console.error(`[WOMPI-TICKET-CHECKOUT] Event "${ticket.name}" has already started`);
              continue; // Skip this ticket
            }
            
            // Determine reason using the new function
            dynamicPricingReason = getEventTicketDynamicPricingReason(new Date(ticket.event.availableDate), ticket.event.openHours);
          } else if (ticket.category === "event" && ticket.availableDate) {
            // Fallback: Event ticket without event relation - use ticket's availableDate
            const eventDate = new Date(ticket.availableDate);
            dynamicPrice = computeDynamicEventPrice(basePrice, eventDate);
            
            // Check if event has passed grace period
            if (dynamicPrice === -1) {
              console.error(`[WOMPI-TICKET-CHECKOUT] Event "${ticket.name}" has already started`);
              continue; // Skip this ticket
            }
            
            // Determine reason using the new function
            dynamicPricingReason = getEventTicketDynamicPricingReason(eventDate);
          } else {
            // General ticket - use time-based dynamic pricing
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: ticket.club.openDays,
              openHours: ticket.club.openHours,
            });
            
            // Determine reason using the new function
            dynamicPricingReason = getNormalTicketDynamicPricingReason({
              basePrice,
              clubOpenDays: ticket.club.openDays,
              openHours: ticket.club.openHours,
            });
          }
        }

        // Calculate platform fee
        const platformFeePercentage = getTicketCommissionRate(ticket.category === "event");
        const platformFee = calculatePlatformFee(dynamicPrice, platformFeePercentage);

        console.log(`🎫 [WOMPI-TICKET-CHECKOUT] Ticket ${i + 1}: ${ticket.name}`);
        console.log(`   Base Price: ${basePrice}`);
        console.log(`   Dynamic Price: ${dynamicPrice}`);
        console.log(`   Platform Fee: ${platformFee} (${platformFeePercentage * 100}%)`);
        console.log(`   Club Receives: ${dynamicPrice}`);

        const ticketPurchase = ticketPurchaseRepo.create({
          transaction: existingTransaction,
          ticket: ticket,
          date: date,
          email: existingTransaction.email,
          clubId: existingTransaction.clubId,
          userId: existingTransaction.userId,
          sessionId: null, // Clear session since this is now completed
          originalBasePrice: basePrice,
          priceAtCheckout: dynamicPrice,
          dynamicPricingWasApplied: dynamicPrice !== basePrice,
          dynamicPricingReason,
          clubReceives: dynamicPrice,
          platformFee: platformFee,
          platformFeeApplied: platformFeePercentage,
          isUsed: false,
        });
        
        await ticketPurchaseRepo.save(ticketPurchase);

        // Generate QR code for this ticket
        const payload = {
          id: ticketPurchase.id,
          clubId: existingTransaction.clubId,
          type: "ticket" as const
        };

        const encryptedPayload = await generateEncryptedQR(payload);
        const qrDataUrl = await QRCode.toDataURL(encryptedPayload);

        // Update the purchase with the QR code
        ticketPurchase.qrCodeEncrypted = encryptedPayload;
        await ticketPurchaseRepo.save(ticketPurchase);

        // Format date string for email templates - handle date conversion like legacy
        let cartDate: Date;
        if (cartItem.date instanceof Date) {
          cartDate = cartItem.date;
        } else {
          // If it's a string, parse it properly
          const dateStr = String(cartItem.date);
          const [year, month, day] = dateStr.split("-").map(Number);
          cartDate = new Date(year, month - 1, day);
        }
        const dateStr = cartDate.toISOString().split("T")[0];

        // Handle menu items if ticket includes them
        if (ticket.includesMenuItem) {
          try {
            // Get included menu items for this ticket
            const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
            const includedMenuItems = await ticketIncludedMenuItemRepo.find({
              where: { ticketId: ticket.id },
              relations: ["menuItem", "variant"]
            });

            if (includedMenuItems.length > 0) {
              // Generate menu QR payload (simplified - only reference ticketPurchaseId)
              const menuPayload = {
                type: "menu_from_ticket" as const,
                ticketPurchaseId: ticketPurchase.id,
                clubId: existingTransaction.clubId
              };

              const menuEncryptedPayload = await generateEncryptedQR(menuPayload);
              const menuQrDataUrl = await QRCode.toDataURL(menuEncryptedPayload);

              // Create records for analytics
              const menuItemFromTicketRepo = AppDataSource.getRepository(MenuItemFromTicket);
              const menuItemFromTicketRecords = includedMenuItems.map(item => 
                menuItemFromTicketRepo.create({
                  ticketPurchaseId: ticketPurchase.id,
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
                to: existingTransaction.email,
                email: existingTransaction.email,
                ticketName: ticket.name,
                date: dateStr,
                ticketQrImageDataUrl: qrDataUrl,
                menuQrImageDataUrl: menuQrDataUrl,
                clubName: ticket.club?.name || "Your Club",
                menuItems: menuItems,
                index: globalTicketCounter,
                total: totalTicketsInCart,
                description: ticket.description,
                purchaseId: ticketPurchase.id,
              });

              console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Unified email sent for ticket ${globalTicketCounter}/${totalTicketsInCart} with menu`);
            }
          } catch (err) {
            console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Unified email for ticket ${globalTicketCounter} failed:`, err);
          }
        } else {
          // Send regular ticket email (no menu included)
          try {
            await sendTicketEmail({
              to: existingTransaction.email,
              ticketName: ticket.name,
              date: dateStr,
              qrImageDataUrl: qrDataUrl,
              clubName: ticket.club?.name || "Your Club",
              index: globalTicketCounter,
              total: totalTicketsInCart,
            });
            console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Email sent for ticket ${globalTicketCounter}/${totalTicketsInCart}`);
          } catch (err) {
            console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Email failed for ticket ${globalTicketCounter}:`, err);
          }
        }

        console.log(`[WOMPI-TICKET-CHECKOUT] Created ticket purchase: ${ticketPurchase.id}`);
      }
    }

    // 🔓 Unlock the cart after successful checkout
    // Get sessionId from stored transaction data since it's not in the entity
    const storedData = getStoredTransactionData(transactionId);
    console.log(`[WOMPI-TICKET-CHECKOUT] 🔍 Debug stored data for transaction ${transactionId}:`, {
      hasStoredData: !!storedData,
      storedUserId: storedData?.userId,
      storedSessionId: storedData?.sessionId,
      existingTransactionUserId: existingTransaction.userId
    });
    
    const storedSessionId = storedData?.sessionId || null;
    
    // Debug cart lock status before unlocking
    console.log(`[WOMPI-TICKET-CHECKOUT] 🔍 Debug cart lock status before unlocking:`, {
      userId: existingTransaction.userId,
      sessionId: storedSessionId,
      hasUserId: !!existingTransaction.userId,
      hasSessionId: !!storedSessionId
    });
    
    // Try to unlock cart with stored data first
    let unlockSuccess = false;
    if (storedData?.userId || storedData?.sessionId) {
      try {
        unlockSuccess = unlockCart(storedData.userId, storedData.sessionId);
        if (unlockSuccess) {
          console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Cart unlocked successfully using stored data for ${storedData.userId ? 'user' : 'session'}: ${storedData.userId || storedData.sessionId}`);
        }
      } catch (unlockError) {
        console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Failed to unlock cart with stored data:`, unlockError);
      }
    }
    
    // If unlock failed with stored data, try with existingTransaction data as fallback
    if (!unlockSuccess && (existingTransaction.userId || storedSessionId)) {
      try {
        unlockSuccess = unlockCart(existingTransaction.userId || null, storedSessionId);
        if (unlockSuccess) {
          console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Cart unlocked successfully using fallback data for ${existingTransaction.userId ? 'user' : 'session'}: ${existingTransaction.userId || storedSessionId}`);
        }
      } catch (unlockError) {
        console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Failed to unlock cart with fallback data:`, unlockError);
      }
    }
    
    if (!unlockSuccess) {
      console.warn(`[WOMPI-TICKET-CHECKOUT] ⚠️ Could not unlock cart - no valid userId or sessionId found`);
    }

    // 📧 Send transaction invoice email (ONE email for the entire transaction)
    // Skip invoice for free checkouts since there's no payment
    if (!isFreeCheckout) {
      try {
        // Prepare items for invoice (combine all cart items)
        const invoiceItems = cartItems.map(item => ({
          name: item.ticket.name,
          variant: null, // Tickets don't have variants
          quantity: item.quantity,
          unitPrice: Number(item.ticket.price),
          subtotal: Number(item.ticket.price) * item.quantity
        }));

        // Calculate totals
        const subtotal = invoiceItems.reduce((sum, item) => sum + item.subtotal, 0);
        const platformFees = Number(existingTransaction.platformReceives);
        const gatewayFees = Number(existingTransaction.gatewayFee);
        const gatewayIVA = Number(existingTransaction.gatewayIVA);
        const total = Number(existingTransaction.totalPaid);

        // Get customer info from stored data
        const customerInfo = storedData?.customerInfo || {};

        await sendTransactionInvoiceEmail({
          to: existingTransaction.email,
          transactionId: existingTransaction.id,
          clubName: cartItems[0]?.ticket?.club?.name || "Your Club",
          clubAddress: cartItems[0]?.ticket?.club?.address,
          clubPhone: cartItems[0]?.ticket?.club?.phone,
          clubEmail: cartItems[0]?.ticket?.club?.email,
          date: purchaseDateStr, // Use purchase date, not ticket date
          items: invoiceItems,
          subtotal,
          platformFees,
          gatewayFees,
          gatewayIVA,
          total,
          currency: "COP",
          paymentMethod: "Credit/Debit Card",
          paymentProviderRef: transactionId, // Wompi transaction ID
          customerInfo: {
            ...customerInfo,
            email: existingTransaction.email
          }
        });

        console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Transaction invoice email sent successfully`);
      } catch (invoiceError) {
        console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Failed to send transaction invoice email:`, invoiceError);
        // Don't fail the checkout if invoice email fails
      }
    } else {
      console.log(`[WOMPI-TICKET-CHECKOUT] 🎁 FREE checkout - skipping invoice email (no payment)`);
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Ticket checkout completed successfully",
      transactionId: existingTransaction.id,
      totalPaid: existingTransaction.totalPaid,
      ticketCount: cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0),
    });

  } catch (error: any) {
    console.error(`[WOMPI-TICKET-CHECKOUT] Error processing successful checkout:`, error);
    
    // 🔓 Always try to unlock the cart, even if checkout fails
    try {
      const storedData = getStoredTransactionData(transactionId);
      console.log(`[WOMPI-TICKET-CHECKOUT] 🔍 Debug stored data for error path transaction ${transactionId}:`, {
        hasStoredData: !!storedData,
        storedUserId: storedData?.userId,
        storedSessionId: storedData?.sessionId,
        existingTransactionUserId: existingTransaction?.userId
      });
      
      const storedSessionId = storedData?.sessionId || null;
      
      // Try to unlock cart with stored data first
      let unlockSuccess = false;
      if (storedData?.userId || storedData?.sessionId) {
        try {
          unlockSuccess = unlockCart(storedData.userId, storedData.sessionId);
          if (unlockSuccess) {
            console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Cart unlocked after checkout failure using stored data for ${storedData.userId ? 'user' : 'session'}: ${storedData.userId || storedData.sessionId}`);
          }
        } catch (unlockError) {
          console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Failed to unlock cart after checkout failure with stored data:`, unlockError);
        }
      }
      
      // If unlock failed with stored data, try with existingTransaction data as fallback
      if (!unlockSuccess && (existingTransaction?.userId || storedSessionId)) {
        try {
          unlockSuccess = unlockCart(existingTransaction?.userId || null, storedSessionId);
          if (unlockSuccess) {
            console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Cart unlocked after checkout failure using fallback data for ${existingTransaction?.userId ? 'user' : 'session'}: ${existingTransaction?.userId || storedSessionId}`);
          }
        } catch (unlockError) {
          console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Failed to unlock cart after checkout failure with fallback data:`, unlockError);
        }
      }
      
      if (!unlockSuccess) {
        console.warn(`[WOMPI-TICKET-CHECKOUT] ⚠️ Could not unlock cart after checkout failure - no valid userId or sessionId found`);
      }
    } catch (unlockError) {
      console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Failed to unlock cart after checkout failure:`, unlockError);
    }
    
    return res.status(500).json({ 
      error: "Failed to process successful checkout",
      details: error.message 
    });
  }
}

/**
 * Helper function to update transaction status in database
 */
async function updateTransactionStatus(wompiTransactionId: string, status: "APPROVED" | "DECLINED" | "PENDING") {
  try {
    const transactionRepo = AppDataSource.getRepository(PurchaseTransaction);
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: wompiTransactionId }
    });

    if (existingTransaction) {
      existingTransaction.paymentStatus = status;
      await transactionRepo.save(existingTransaction);
      console.log(`[WOMPI-TICKET-CHECKOUT] Updated transaction status to ${status}: ${existingTransaction.id}`);
    } else {
      console.warn(`[WOMPI-TICKET-CHECKOUT] Transaction not found for status update: ${wompiTransactionId}`);
    }
  } catch (error) {
    console.error(`[WOMPI-TICKET-CHECKOUT] Error updating transaction status:`, error);
  }
}