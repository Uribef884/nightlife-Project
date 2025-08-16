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
import { sendTicketEmail, sendMenuFromTicketEmail } from "../services/emailService";
import { computeDynamicEventPrice, computeDynamicPrice, getNormalTicketDynamicPricingReason, getEventTicketDynamicPricingReason } from "../utils/dynamicPricing";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { MenuItemFromTicket } from "../entities/MenuItemFromTicket";
import { getTicketCommissionRate } from "../config/fees";
import { calculatePlatformFee, calculateGatewayFees } from "../utils/ticketfeeUtils";
import { differenceInMinutes } from "date-fns";
import * as QRCode from "qrcode";

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
      
      // Remove stored data to prevent double processing
      removeStoredTransactionData(transactionId);

      // Update the existing pending transaction instead of creating a new one
      return await processWompiSuccessfulCheckout({
        userId: storedData.userId,
        sessionId: storedData.sessionId,
        email: storedData.email,
        req,
        res,
        transactionId,
        cartItems: storedData.cartItems,
      });

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
          // Remove stored data to prevent double processing
          removeStoredTransactionData(transactionId);

          // Update the existing pending transaction instead of creating a new one
          return await processWompiSuccessfulCheckout({
            userId: storedData.userId,
            sessionId: storedData.sessionId,
            email: storedData.email,
            req,
            res,
            transactionId,
            cartItems: storedData.cartItems,
          });
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

    // Find and update the existing pending transaction
    const transactionRepo = AppDataSource.getRepository(PurchaseTransaction);
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: transactionId }
    });

    if (!existingTransaction) {
      console.error(`[WOMPI-TICKET-CHECKOUT] No pending transaction found for ID: ${transactionId}`);
      return res.status(400).json({ error: "Transaction not found" });
    }

    // Get the current Wompi transaction status to confirm it's actually approved
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

    // 🎯 USE EXISTING TRANSACTION TOTALS (legacy approach)
    // Don't recalculate - use the amounts that were calculated at initiate time
    const totalPaid = Number(existingTransaction.totalPaid);
    const totalClubReceives = Number(existingTransaction.clubReceives);
    const totalPlatformReceives = Number(existingTransaction.platformReceives);
    const totalGatewayFee = Number(existingTransaction.gatewayFee);
    const gatewayIVA = Number(existingTransaction.gatewayIVA);

    console.log(`🎫 [WOMPI-TICKET-CHECKOUT] USING ORIGINAL TRANSACTION TOTALS:`);
    console.log(`   Total Paid: ${totalPaid}`);
    console.log(`   Total Club Receives: ${totalClubReceives}`);
    console.log(`   Total Platform Receives: ${totalPlatformReceives}`);
    console.log(`   Gateway Fee: ${totalGatewayFee}`);
    console.log(`   Gateway IVA: ${gatewayIVA}`);
    
    // ✅ VALIDATION: Check if this matches what was sent to Wompi
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

        // Send email for this ticket
        try {
          await sendTicketEmail({
            to: existingTransaction.email,
            ticketName: ticket.name,
            date: dateStr,
            qrImageDataUrl: qrDataUrl,
            clubName: ticket.club?.name || "Your Club",
            index: i,
            total: cartItem.quantity,
          });
          console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Email sent for ticket ${i + 1}/${cartItem.quantity}`);
        } catch (err) {
          console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Email failed for ticket ${i + 1}:`, err);
        }

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
              // Generate menu QR payload
              const menuPayload = {
                type: "menu_from_ticket" as const,
                ticketPurchaseId: ticketPurchase.id,
                clubId: existingTransaction.clubId,
                items: includedMenuItems.map(item => ({
                  menuItemId: item.menuItemId,
                  variantId: item.variantId || undefined,
                  quantity: item.quantity
                }))
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

              // Send menu email
              const menuItems = includedMenuItems.map(item => ({
                name: item.menuItem.name,
                variant: item.variant?.name || null,
                quantity: item.quantity
              }));

              await sendMenuFromTicketEmail({
                to: existingTransaction.email,
                email: existingTransaction.email,
                ticketName: ticket.name,
                date: dateStr,
                qrImageDataUrl: menuQrDataUrl,
                clubName: ticket.club?.name || "Your Club",
                items: menuItems,
                index: i,
                total: cartItem.quantity,
              });

              console.log(`[WOMPI-TICKET-CHECKOUT] ✅ Menu email sent for ticket ${i + 1}/${cartItem.quantity}`);
            }
          } catch (err) {
            console.error(`[WOMPI-TICKET-CHECKOUT] ❌ Menu items for ticket ${i + 1} failed:`, err);
          }
        }

        console.log(`[WOMPI-TICKET-CHECKOUT] Created ticket purchase: ${ticketPurchase.id}`);
      }
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