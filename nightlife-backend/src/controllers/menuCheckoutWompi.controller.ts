import { Request, Response } from "express";
import { wompiService } from "../services/wompi.service";
import { WOMPI_CONFIG } from "../config/wompi";
import { getStoredMenuTransactionData, removeStoredMenuTransactionData } from "./menuInitiateWompi.controller";
import { AuthenticatedRequest } from "../types/express";
import { AppDataSource } from "../config/data-source";
import { MenuPurchaseTransaction } from "../entities/MenuPurchaseTransaction";
import { MenuPurchase } from "../entities/MenuPurchase";
import { MenuCartItem } from "../entities/MenuCartItem";
import { MenuItem } from "../entities/MenuItem";
import { MenuItemVariant } from "../entities/MenuItemVariant";
import { generateEncryptedQR } from "../utils/generateEncryptedQR";
import { sendMenuEmail } from "../services/emailService";
import { computeDynamicPrice } from "../utils/dynamicPricing";
import { getMenuCommissionRate } from "../config/fees";
import { calculatePlatformFee, calculateGatewayFees } from "../utils/menuFeeUtils";
import { differenceInMinutes } from "date-fns";
import QRCode from "qrcode";

export const confirmWompiMenuCheckout = async (req: Request, res: Response) => {
  const typedReq = req as AuthenticatedRequest;
  const { transactionId } = req.body;

  if (!transactionId) {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  try {
    console.log(`[WOMPI-MENU-CHECKOUT] Confirming transaction: ${transactionId}`);

    // Get stored transaction data
    const storedData = getStoredMenuTransactionData(transactionId);
    if (!storedData) {
      return res.status(400).json({ error: "Transaction not found or expired" });
    }

    // Check Wompi transaction status
    const transactionStatus = await wompiService().getTransactionStatus(transactionId);
    
    console.log(`[WOMPI-MENU-CHECKOUT] Transaction status: ${transactionStatus.data.status}`);

    if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.APPROVED) {
      // Transaction is approved, proceed with checkout
      console.log(`[WOMPI-MENU-CHECKOUT] Transaction approved, processing checkout...`);
      
      // Remove stored data to prevent double processing
      removeStoredMenuTransactionData(transactionId);

      // Update the existing pending transaction instead of creating a new one
      return await processWompiSuccessfulMenuCheckout({
        userId: storedData.userId,
        sessionId: storedData.sessionId,
        email: storedData.email,
        req,
        res,
        transactionId,
        cartItems: storedData.cartItems,
      });

    } else if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.DECLINED) {
      console.log(`[WOMPI-MENU-CHECKOUT] Transaction declined: ${transactionId}`);
      
      // Update the existing transaction status to DECLINED
      await updateMenuTransactionStatus(transactionId, "DECLINED");
      
      removeStoredMenuTransactionData(transactionId);
      return res.status(400).json({ 
        error: "Payment was declined",
        status: "DECLINED"
      });

    } else if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.ERROR) {
      console.log(`[WOMPI-MENU-CHECKOUT] Transaction error: ${transactionId}`);
      
      // Update the existing transaction status to ERROR (map to DECLINED in our system)
      await updateMenuTransactionStatus(transactionId, "DECLINED");
      
      removeStoredMenuTransactionData(transactionId);
      return res.status(400).json({ 
        error: "Payment processing error",
        status: "ERROR"
      });

    } else if (transactionStatus.data.status === WOMPI_CONFIG.STATUSES.PENDING) {
      // For pending transactions, poll until resolved
      console.log(`[WOMPI-MENU-CHECKOUT] Transaction pending, polling for status...`);
      
      try {
        const finalStatus = await wompiService().pollTransactionStatus(transactionId);
        
        if (finalStatus.data.status === WOMPI_CONFIG.STATUSES.APPROVED) {
          // Remove stored data to prevent double processing
          removeStoredMenuTransactionData(transactionId);

          // Update the existing pending transaction instead of creating a new one
          return await processWompiSuccessfulMenuCheckout({
            userId: storedData.userId,
            sessionId: storedData.sessionId,
            email: storedData.email,
            req,
            res,
            transactionId,
            cartItems: storedData.cartItems,
          });
        } else {
          // Update the existing transaction status to match Wompi status
          await updateMenuTransactionStatus(transactionId, finalStatus.data.status === "DECLINED" ? "DECLINED" : "DECLINED");
          
          removeStoredMenuTransactionData(transactionId);
          return res.status(400).json({ 
            error: `Payment was ${finalStatus.data.status.toLowerCase()}`,
            status: finalStatus.data.status
          });
        }
      } catch (pollError: any) {
        console.error(`[WOMPI-MENU-CHECKOUT] Polling error:`, pollError);
        return res.status(400).json({ 
          error: pollError.message || "Payment polling failed",
          status: "TIMEOUT"
        });
      }
    }

  } catch (error: any) {
    console.error(`[WOMPI-MENU-CHECKOUT] Error:`, error);
    return res.status(500).json({ 
      error: error.message || "Failed to confirm Wompi checkout" 
    });
  }
};

// Helper endpoint to check transaction status without processing
export const checkWompiMenuTransactionStatus = async (req: Request, res: Response) => {
  const { transactionId } = req.params;

  if (!transactionId) {
    return res.status(400).json({ error: "Transaction ID is required" });
  }

  console.log(`[WOMPI-MENU-STATUS] Checking status for transaction ID: ${transactionId}`);

  try {
    // First check our database for the transaction
    const transactionRepo = AppDataSource.getRepository(MenuPurchaseTransaction);
    
    // Log all transactions to debug
    const allTransactions = await transactionRepo.find({
      select: ['id', 'paymentProviderTransactionId', 'paymentStatus', 'totalPaid', 'email']
    });
    console.log(`[WOMPI-MENU-STATUS] All transactions in database:`, allTransactions);
    
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: transactionId },
      relations: ["purchases"]
    });

    if (existingTransaction) {
      console.log(`[WOMPI-MENU-STATUS] Found transaction in database: ${existingTransaction.id}`);
      console.log(`[WOMPI-MENU-STATUS] Transaction details:`, {
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
        finalizedAt: existingTransaction.usedAt || existingTransaction.createdAt,
      });
    }

    // If not found in database, fall back to Wompi status check
    console.log(`[WOMPI-MENU-STATUS] Transaction not found in database, checking Wompi: ${transactionId}`);
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
    console.error(`[WOMPI-MENU-STATUS] Error:`, error);
    return res.status(500).json({ 
      error: error.message || "Failed to check transaction status" 
    });
  }
};

/**
 * Process successful Wompi menu checkout by updating existing transaction
 * instead of creating a new one (which would cause duplicate key error)
 */
export async function processWompiSuccessfulMenuCheckout({
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
    console.log(`[WOMPI-MENU-CHECKOUT] Processing successful checkout for transaction: ${transactionId}`);

    // Reload cart items with proper relations (mirror legacy)
    const freshCartRepo = AppDataSource.getRepository(MenuCartItem);
    const where = userId !== null ? { userId } : sessionId !== null ? { sessionId } : undefined;
    if (!where) {
      return res.status(400).json({ error: "Missing session or user" });
    }

    const freshCartItems = await freshCartRepo.find({
      where,
      relations: ["menuItem", "variant", "menuItem.club"],
    });

    if (!freshCartItems.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    // Use fresh cart items with proper relations
    cartItems = freshCartItems;
    
    console.log(`[WOMPI-MENU-CHECKOUT] Loaded ${cartItems.length} cart items with relations`);

    // Find and update the existing pending transaction
    const transactionRepo = AppDataSource.getRepository(MenuPurchaseTransaction);
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: transactionId }
    });

    if (!existingTransaction) {
      console.error(`[WOMPI-MENU-CHECKOUT] No pending transaction found for ID: ${transactionId}`);
      return res.status(400).json({ error: "Transaction not found" });
    }

    // Get the current Wompi transaction status to confirm it's actually approved
    const wompiStatus = await wompiService().getTransactionStatus(transactionId);
    const finalStatus = wompiStatus.data.status.toUpperCase();
    
    console.log(`[WOMPI-MENU-CHECKOUT] Wompi transaction status: ${finalStatus}`);
    
    // Only proceed if Wompi confirms the transaction is approved
    if (finalStatus !== "APPROVED") {
      console.error(`[WOMPI-MENU-CHECKOUT] Transaction not approved in Wompi. Status: ${finalStatus}`);
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

    console.log(`🍽️ [WOMPI-MENU-CHECKOUT] USING ORIGINAL TRANSACTION TOTALS:`);
    console.log(`   Total Paid: ${totalPaid}`);
    console.log(`   Total Club Receives: ${totalClubReceives}`);
    console.log(`   Total Platform Receives: ${totalPlatformReceives}`);
    console.log(`   Gateway Fee: ${totalGatewayFee}`);
    console.log(`   Gateway IVA: ${gatewayIVA}`);
    
    // ✅ VALIDATION: Check if this matches what was sent to Wompi
    const wompiValidationStatus = await wompiService().getTransactionStatus(transactionId);
    const wompiAmountInCents = wompiValidationStatus.data.amount_in_cents;
    const ourAmountInCents = Math.round(totalPaid * 100);
    
    console.log(`🔍 [WOMPI-MENU-CHECKOUT] AMOUNT VALIDATION:`);
    console.log(`   Wompi Amount (cents): ${wompiAmountInCents}`);
    console.log(`   Our Stored (cents): ${ourAmountInCents}`);
    console.log(`   Difference: ${wompiAmountInCents - ourAmountInCents}`);
    
    if (Math.abs(wompiAmountInCents - ourAmountInCents) > 1) { // Allow 1 cent rounding diff
      console.error(`❌ [WOMPI-MENU-CHECKOUT] AMOUNT MISMATCH DETECTED!`);
      console.error(`   Wompi charged: ${wompiAmountInCents / 100} COP`);
      console.error(`   We stored: ${ourAmountInCents / 100} COP`);
      console.error(`   This should not happen with the legacy approach!`);
    }

    // Simply update the payment status - amounts remain unchanged
    existingTransaction.paymentStatus = "APPROVED";
    await transactionRepo.save(existingTransaction);
    
    console.log(`[WOMPI-MENU-CHECKOUT] Updated transaction status to APPROVED: ${existingTransaction.id}`);

    // Check cart expiration (mirror legacy)
    console.log(`[WOMPI-MENU-CHECKOUT] Checking cart expiration for ${cartItems.length} items`);
    const oldest = cartItems.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
    const age = differenceInMinutes(new Date(), new Date(oldest.createdAt));
    console.log(`[WOMPI-MENU-CHECKOUT] Cart age: ${age} minutes (oldest item: ${oldest.createdAt})`);
    if (age > 30) {
      console.log(`[WOMPI-MENU-CHECKOUT] Cart expired (${age} minutes > 30), clearing and returning error`);
      const expiredCartRepo = AppDataSource.getRepository(MenuCartItem);
      const whereClause = userId ? { userId } : sessionId ? { sessionId } : null;
      if (whereClause) {
        await expiredCartRepo.delete(whereClause);
      }
      return res.status(400).json({ error: "Cart expired. Please start over." });
    }
    console.log(`[WOMPI-MENU-CHECKOUT] Cart is valid, proceeding with checkout`);

    // Create menu purchases for each cart item with proper pricing and QR codes
    const menuPurchaseRepo = AppDataSource.getRepository(MenuPurchase);
    const menuItemRepo = AppDataSource.getRepository(MenuItem);
    const menuVariantRepo = AppDataSource.getRepository(MenuItemVariant);
    const menuPurchases: MenuPurchase[] = [];
    
    console.log(`[WOMPI-MENU-CHECKOUT] Starting to process ${cartItems.length} cart items`);
    
    for (const cartItem of cartItems) {
      const menuItem = await menuItemRepo.findOne({ 
        where: { id: cartItem.menuItemId },
        relations: ['club'] // Load club for dynamic pricing
      });
      if (!menuItem) {
        console.warn(`[WOMPI-MENU-CHECKOUT] Menu item not found: ${cartItem.menuItemId}`);
        continue;
      }

      let variant: any = undefined;
      if (cartItem.variantId) {
        variant = await menuVariantRepo.findOne({ where: { id: cartItem.variantId } });
      }

      const club = menuItem.club;
      const hasVariants = menuItem.hasVariants;

      let basePrice: number;
      if (hasVariants) {
        const variantPrice = Number(variant?.price);
        if (isNaN(variantPrice)) {
          console.error(`[WOMPI-MENU-CHECKOUT] Invalid price for menuItemId: ${cartItem.menuItemId}`);
          continue;
        }
        basePrice = variantPrice;
      } else {
        if (typeof menuItem.price !== "number") {
          console.error(`[WOMPI-MENU-CHECKOUT] Menu item has no price — MenuItem ID: ${menuItem.id}`);
          continue;
        }
        basePrice = menuItem.price;
      }

      // 🎯 Apply dynamic pricing if enabled
      let dynamicPrice = basePrice;
      let dynamicPricingReason: string | undefined;

      if (hasVariants && variant?.dynamicPricingEnabled) {
        // Variant has dynamic pricing enabled
        dynamicPrice = computeDynamicPrice({
          basePrice,
          clubOpenDays: club.openDays,
          openHours: club.openHours,
        });
      } else if (!hasVariants && menuItem.dynamicPricingEnabled) {
        // Menu item has dynamic pricing enabled
        dynamicPrice = computeDynamicPrice({
          basePrice,
          clubOpenDays: club.openDays,
          openHours: club.openHours,
        });
      }

      // Determine dynamic pricing reason
      if (dynamicPrice !== basePrice) {
        const now = new Date();
        const openHoursArr = Array.isArray(club.openHours) ? club.openHours : [];
        if (openHoursArr.length > 0) {
          const [openHourNum] = openHoursArr[0].open.split(':').map(Number);
          const [closeHourNum] = openHoursArr[0].close.split(':').map(Number);
          const currentHour = now.getHours();
          if (currentHour < openHourNum || currentHour >= closeHourNum) {
            dynamicPricingReason = "closed_day";
          } else {
            dynamicPricingReason = "early";
          }
        }
      }

      // Calculate platform fee
      const platformFeePercentage = getMenuCommissionRate();
      const platformFee = calculatePlatformFee(dynamicPrice, platformFeePercentage);

      console.log(`🍽️ [WOMPI-MENU-CHECKOUT] Item: ${menuItem.name}${variant ? ` (${variant.name})` : ''}`);
      console.log(`   Base Price: ${basePrice}`);
      console.log(`   Dynamic Price: ${dynamicPrice}`);
      console.log(`   Quantity: ${cartItem.quantity}`);
      console.log(`   Platform Fee: ${platformFee} (${platformFeePercentage * 100}%)`);
      console.log(`   Club Receives: ${dynamicPrice}`);
      
      // Create menu purchase
      const menuPurchase = menuPurchaseRepo.create({
        menuItemId: cartItem.menuItemId,
        variantId: cartItem.variantId || undefined,
        userId: existingTransaction.userId,
        sessionId: null, // Clear session since this is now completed
        clubId: existingTransaction.clubId,
        email: existingTransaction.email,
        date: new Date(), // Menu purchases use current date
        quantity: cartItem.quantity,
        originalBasePrice: basePrice,
        priceAtCheckout: dynamicPrice,
        dynamicPricingWasApplied: dynamicPrice !== basePrice,
        dynamicPricingReason,
        clubReceives: dynamicPrice,
        platformFee: platformFee,
        platformFeeApplied: platformFeePercentage,
        isUsed: false,
        purchaseTransactionId: existingTransaction.id, // Link to transaction by ID
      });
      
      // Set the transaction relationship
      menuPurchase.transaction = existingTransaction;
      
      menuPurchases.push(menuPurchase);
      
      console.log(`[WOMPI-MENU-CHECKOUT] Created menu purchase for item: ${cartItem.menuItem?.name || cartItem.menuItemId}, variant: ${cartItem.variant?.name || 'none'}, quantity: ${cartItem.quantity}`);
    }

    // Save all menu purchases first to establish relationships
    await menuPurchaseRepo.save(menuPurchases);
    console.log(`[WOMPI-MENU-CHECKOUT] Saved ${menuPurchases.length} menu purchases`);

    // Generate QR code for the entire transaction
    console.log(`[WOMPI-MENU-CHECKOUT] Generating QR code for transaction: ${existingTransaction.id}, club: ${existingTransaction.clubId}`);
    const payload = {
      id: existingTransaction.id,
      clubId: existingTransaction.clubId,
      type: "menu" as const
    };

    console.log(`[WOMPI-MENU-CHECKOUT] QR payload:`, payload);
    
    let encryptedPayload: string;
    let qrImageDataUrl: string;
    
    try {
      encryptedPayload = await generateEncryptedQR(payload);
      console.log(`[WOMPI-MENU-CHECKOUT] Encrypted payload length: ${encryptedPayload.length}`);
      
      qrImageDataUrl = await QRCode.toDataURL(encryptedPayload);
      console.log(`[WOMPI-MENU-CHECKOUT] QR image data URL generated, length: ${qrImageDataUrl.length}`);

      // Update transaction with the QR payload
      existingTransaction.qrPayload = encryptedPayload;
      await transactionRepo.save(existingTransaction);

      console.log(`[WOMPI-MENU-CHECKOUT] Generated QR code for transaction: ${existingTransaction.id}`);
    } catch (qrError: any) {
      console.error(`[WOMPI-MENU-CHECKOUT] ❌ QR generation failed:`, qrError);
      throw new Error(`Failed to generate QR code: ${qrError.message}`);
    }

    // Calculate total for email
    const emailTotal = menuPurchases.reduce((sum, purchase) => 
      sum + (purchase.priceAtCheckout * purchase.quantity), 0
    );

    // Send menu email
    console.log(`[WOMPI-MENU-CHECKOUT] Preparing to send email to: ${existingTransaction.email}`);
    console.log(`[WOMPI-MENU-CHECKOUT] Club name: ${cartItems[0]?.menuItem?.club?.name ?? "Your Club"}`);
    console.log(`[WOMPI-MENU-CHECKOUT] Email total: ${emailTotal}`);
    console.log(`[WOMPI-MENU-CHECKOUT] QR image data URL length: ${qrImageDataUrl.length}`);
    
    try {
      await sendMenuEmail({
        to: existingTransaction.email,
        qrImageDataUrl,
        clubName: cartItems[0]?.menuItem?.club?.name ?? "Your Club",
        items: cartItems.map((item: any) => ({
          name: item.menuItem.name,
          variant: item.variant?.name ?? null,
          quantity: item.quantity,
          unitPrice: item.variant?.price ?? item.menuItem.price!,
        })),
        total: emailTotal,
      });
      console.log(`[WOMPI-MENU-CHECKOUT] ✅ Menu email sent successfully`);
    } catch (err) {
      console.error(`[WOMPI-MENU-CHECKOUT] ❌ Email failed:`, err);
    }

    // Clear cart items after successful processing
    const cartRepo = AppDataSource.getRepository(MenuCartItem);
    const whereClause = userId ? { userId } : sessionId ? { sessionId } : null;
    
    if (whereClause) {
      await cartRepo.delete(whereClause);
      console.log(`[WOMPI-MENU-CHECKOUT] Cleared cart for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
    }

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Menu checkout completed successfully",
      transactionId: existingTransaction.id,
      totalPaid: existingTransaction.totalPaid,
      itemCount: cartItems.reduce((sum: number, item: any) => sum + item.quantity, 0),
    });

  } catch (error: any) {
    console.error(`[WOMPI-MENU-CHECKOUT] Error processing successful checkout:`, error);
    return res.status(500).json({ 
      error: "Failed to process successful checkout",
      details: error.message 
    });
  }
}

/**
 * Helper function to update menu transaction status in database
 */
async function updateMenuTransactionStatus(wompiTransactionId: string, status: "APPROVED" | "DECLINED" | "PENDING") {
  try {
    const transactionRepo = AppDataSource.getRepository(MenuPurchaseTransaction);
    const existingTransaction = await transactionRepo.findOne({
      where: { paymentProviderTransactionId: wompiTransactionId }
    });

    if (existingTransaction) {
      existingTransaction.paymentStatus = status;
      await transactionRepo.save(existingTransaction);
      console.log(`[WOMPI-MENU-CHECKOUT] Updated transaction status to ${status}: ${existingTransaction.id}`);
    } else {
      console.warn(`[WOMPI-MENU-CHECKOUT] Transaction not found for status update: ${wompiTransactionId}`);
    }
  } catch (error) {
    console.error(`[WOMPI-MENU-CHECKOUT] Error updating transaction status:`, error);
  }
} 