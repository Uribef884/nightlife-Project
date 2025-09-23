import { Response } from "express";
import { AppDataSource } from "../config/data-source";
import { UnifiedPurchaseTransaction } from "../entities/UnifiedPurchaseTransaction";
import { ILike, Between } from "typeorm";
import { AuthenticatedRequest } from "../types/express";
import { JwtPayload } from "../types/jwt";

type Role = JwtPayload["role"];

// Helper function to get the primary club from a transaction
function getPrimaryClub(tx: UnifiedPurchaseTransaction) {
  // Get club from first ticket purchase or menu purchase
  const firstTicketPurchase = tx.ticketPurchases?.[0];
  const firstMenuPurchase = tx.menuPurchases?.[0];
  
  if (firstTicketPurchase?.club) {
    return {
      id: firstTicketPurchase.club.id,
      name: firstTicketPurchase.club.name,
      profileImageUrl: firstTicketPurchase.club.profileImageUrl,
      city: firstTicketPurchase.club.city
    };
  }
  
  if (firstMenuPurchase?.club) {
    return {
      id: firstMenuPurchase.club.id,
      name: firstMenuPurchase.club.name,
      profileImageUrl: firstMenuPurchase.club.profileImageUrl,
      city: firstMenuPurchase.club.city
    };
  }
  
  return null;
}

// Format unified transaction for response
function formatUnifiedTransaction(tx: UnifiedPurchaseTransaction, role: Role) {
  // Format ticket purchases
  const ticketPurchases = (tx.ticketPurchases || []).map(purchase => ({
    id: purchase.id,
    ticketId: purchase.ticketId,
    ticket: {
      ...purchase.ticket,
      event: purchase.ticket.event ? {
        id: purchase.ticket.event.id,
        name: purchase.ticket.event.name,
        description: purchase.ticket.event.description,
        availableDate: purchase.ticket.event.availableDate
      } : null
    },
    club: purchase.club ? {
      id: purchase.club.id,
      name: purchase.club.name,
      profileImageUrl: purchase.club.profileImageUrl,
      city: purchase.club.city
    } : null,
    date: purchase.date,
    email: purchase.email,
    qrCodeEncrypted: purchase.qrCodeEncrypted,
    hasIncludedItems: purchase.hasIncludedItems,
    includedQrCodeEncrypted: purchase.includedQrCodeEncrypted,
    isUsed: purchase.isUsed,
    usedAt: purchase.usedAt,
    isUsedMenu: purchase.isUsedMenu,
    menuQRUsedAt: purchase.menuQRUsedAt,
    originalBasePrice: purchase.originalBasePrice,
    priceAtCheckout: purchase.priceAtCheckout,
    dynamicPricingWasApplied: purchase.dynamicPricingWasApplied,
    dynamicPricingReason: purchase.dynamicPricingReason,
    clubReceives: purchase.clubReceives,
    platformFee: purchase.platformFee,
    platformFeeApplied: purchase.platformFeeApplied,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt
  }));

  // Format menu purchases
  const menuPurchases = (tx.menuPurchases || []).map(purchase => ({
    id: purchase.id,
    menuItemId: purchase.menuItemId,
    menuItem: purchase.menuItem,
    variantId: purchase.variantId,
    variant: purchase.variant,
    club: purchase.club ? {
      id: purchase.club.id,
      name: purchase.club.name,
      profileImageUrl: purchase.club.profileImageUrl,
      city: purchase.club.city
    } : null,
    date: purchase.date,
    email: purchase.email,
    isUsed: purchase.isUsed,
    usedAt: purchase.usedAt,
    quantity: purchase.quantity,
    originalBasePrice: purchase.originalBasePrice,
    priceAtCheckout: purchase.priceAtCheckout,
    dynamicPricingWasApplied: purchase.dynamicPricingWasApplied,
    dynamicPricingReason: purchase.dynamicPricingReason,
    clubReceives: purchase.clubReceives,
    platformFee: purchase.platformFee,
    platformFeeApplied: purchase.platformFeeApplied,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt
  }));

  const base = {
    id: tx.id,
    buyerEmail: tx.buyerEmail,
    userId: tx.user?.id ?? null,
    clubId: tx.clubId,
    club: getPrimaryClub(tx),
    date: tx.date,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
    paymentStatus: tx.paymentStatus,
    paymentProvider: tx.paymentProvider,
    customerFullName: tx.customerFullName,
    customerPhoneNumber: tx.customerPhoneNumber,
    qrPayload: tx.qrPayload,
    unifiedPurchaseTransaction: {
      qrPayload: tx.qrPayload
    },
    ticketPurchases,
    menuPurchases
  };

  if (role === "clubowner") {
    return {
      ...base,
      totalPaid: tx.totalPaid,
      ticketSubtotal: tx.ticketSubtotal,
      menuSubtotal: tx.menuSubtotal,
      clubReceives: tx.clubReceives,
      paymentProviderTransactionId: tx.paymentProviderTransactionId,
      paymentProviderReference: tx.paymentProviderReference,
      processedAt: tx.processedAt
    };
  }

  const result = {
    ...base,
    totalPaid: tx.totalPaid,
    ticketSubtotal: tx.ticketSubtotal,
    menuSubtotal: tx.menuSubtotal
  };
  
  
  return result;
}

// Base function to find unified transactions with filters
async function findUnifiedTransactions(where: any, role: Role, query: any): Promise<UnifiedPurchaseTransaction[]> {
  const txRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);
  const filters: any = { ...where };

  // Date filter
  if (query.startDate && query.endDate) {
    filters.createdAt = Between(new Date(query.startDate), new Date(query.endDate));
  }

  // Email filter
  if (query.email) {
    filters.buyerEmail = ILike(`%${query.email.trim()}%`);
  }

  // User ID filter
  if (query.userId) {
    filters.user = { id: query.userId };
  }

  // Order ID filter
  if (query.orderId) {
    filters.id = query.orderId;
  }

  // Payment status filter
  if (query.paymentStatus) {
    filters.paymentStatus = query.paymentStatus;
  }

  const transactions = await txRepo.find({
    where: filters,
    relations: ["user", "ticketPurchases", "ticketPurchases.ticket", "ticketPurchases.ticket.event", "ticketPurchases.club", "menuPurchases", "menuPurchases.menuItem", "menuPurchases.variant", "menuPurchases.club"],
    order: { createdAt: "DESC" },
  });

  return transactions;
}

// 🧑 Normal User - Get user's unified purchases
export const getUserUnifiedPurchases = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    // Only return APPROVED transactions for user orders
    const results = await findUnifiedTransactions({ 
      user: { id: userId }, 
      paymentStatus: "APPROVED" 
    }, "user", req.query);
    const formatted = results.map((tx) => formatUnifiedTransaction(tx, "user"));
    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching user unified purchases:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// 🧑 Normal User - Get user's unified purchase by ID
export const getUserUnifiedPurchaseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const userId = req.user!.id;
    const txRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);

    const tx = await txRepo.findOne({
      where: { 
        id, 
        user: { id: userId }, 
        paymentStatus: "APPROVED" 
      },
      relations: ["user", "ticketPurchases", "ticketPurchases.ticket", "ticketPurchases.ticket.event", "ticketPurchases.club", "menuPurchases", "menuPurchases.menuItem", "menuPurchases.variant", "menuPurchases.club"]
    });

    if (!tx) {
      res.status(404).json({ error: "No encontrado" });
      return;
    }

    const formatted = formatUnifiedTransaction(tx, "user");
    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching user unified purchase by ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// 🏢 Club Owner - Get club's unified purchases
export const getClubUnifiedPurchases = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const clubId = req.user?.clubId;
    if (!clubId) {
      res.status(403).json({ error: "No hay ID de club asignado" });
      return;
    }

    const txs = await findUnifiedTransactions({ clubId }, "clubowner", req.query);
    const formatted = txs.map((tx) => formatUnifiedTransaction(tx, "clubowner"));
    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching club unified purchases:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// 🏢 Club Owner - Get club's unified purchase by ID
export const getClubUnifiedPurchaseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id;
    const clubId = req.user?.clubId;
    const txRepo = AppDataSource.getRepository(UnifiedPurchaseTransaction);

    const tx = await txRepo.findOne({
      where: { id, clubId: clubId || undefined },
      relations: ["user", "ticketPurchases", "ticketPurchases.ticket", "ticketPurchases.ticket.event", "ticketPurchases.club", "menuPurchases", "menuPurchases.menuItem", "menuPurchases.variant", "menuPurchases.club"]
    });

    if (!tx) {
      res.status(404).json({ error: "No encontrado o no autorizado" });
      return;
    }

    const formatted = formatUnifiedTransaction(tx, "clubowner");
    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching club unified purchase by ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
