import { Response } from "express";
import { AppDataSource } from "../config/data-source";
import { MenuPurchase } from "../entities/MenuPurchase";
import { ILike, Between } from "typeorm";
import { AuthenticatedRequest } from "../types/express";
import { JwtPayload } from "../types/jwt";

type Role = JwtPayload["role"];

function formatTransaction(tx: MenuPurchase, role: Role) {
  const base = {
    id: tx.id,
    email: tx.email,
    date: tx.date,
    clubId: tx.clubId,
    menuItemId: tx.menuItemId,
    variantId: tx.variantId,
    quantity: tx.quantity,
    originalBasePrice: tx.originalBasePrice,
    priceAtCheckout: tx.priceAtCheckout,
    dynamicPricingWasApplied: tx.dynamicPricingWasApplied,
    clubReceives: tx.clubReceives,
    platformFee: tx.platformFee,
    platformFeeApplied: tx.platformFeeApplied,
    isUsed: tx.isUsed,
    createdAt: tx.createdAt,
    menuItem: tx.menuItem,
    variant: tx.variant,
    transaction: tx.transaction
  };

  // Admin can see everything
  if (role === "admin") {
    return {
      ...base,
      userId: tx.userId,
      sessionId: tx.sessionId,
      transactionId: tx.transactionId
    };
  }

  return base;
}

async function findMenuPurchases(where: any, role: Role, query: any): Promise<MenuPurchase[]> {
  const txRepo = AppDataSource.getRepository(MenuPurchase);
  const filters: any = { ...where };

  if (query.startDate && query.endDate) {
    filters.date = Between(query.startDate, query.endDate);
  }

  if (query.email) {
    filters.email = ILike(`%${query.email}%`);
  }

  if (query.isUsed !== undefined) {
    filters.isUsed = query.isUsed === 'true';
  }

  const purchases = await txRepo.find({
    where: filters,
    relations: ["menuItem", "variant", "menuItem.club", "transaction"],
    order: { createdAt: "DESC" },
    take: query.limit ? parseInt(query.limit) : 50,
    skip: query.offset ? parseInt(query.offset) : 0,
  });

  return purchases;
}

export const getClubMenuPurchases = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const clubId = req.params.clubId;
  const role = req.user!.role;

  if (role !== "admin") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const purchases = await findMenuPurchases({ clubId }, role, req.query);
    const formattedPurchases = purchases.map(tx => formatTransaction(tx, role));
    
    res.json({
      purchases: formattedPurchases,
      total: formattedPurchases.length
    });
  } catch (err) {
    console.error("❌ Error fetching club menu purchases:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getClubMenuPurchaseById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params.id;
  const clubId = req.params.clubId;
  const role = req.user!.role;

  if (role !== "admin") {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const purchaseRepo = AppDataSource.getRepository(MenuPurchase);
    const purchase = await purchaseRepo.findOne({
      where: { id, clubId },
      relations: ["menuItem", "variant", "menuItem.club", "transaction"]
    });

    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }

    res.json(formatTransaction(purchase, role));
  } catch (err) {
    console.error("❌ Error fetching menu purchase:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
