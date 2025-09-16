import { Response } from "express";
import { AuthenticatedRequest } from "../types/express";
import { decryptQR } from "../utils/decryptQR";
import { previewMenuTransaction, previewMenuFromTicketPurchase, validateMenuTransaction, validateMenuFromTicketPurchase, previewUnifiedMenuTransaction, validateUnifiedMenuTransaction } from "../utils/validateQRUtils";
import { AppDataSource } from "../config/data-source";
import { MenuPurchaseTransaction } from "../entities/MenuPurchaseTransaction";
import { UnifiedPurchaseTransaction } from "../entities/UnifiedPurchaseTransaction";
import { TicketPurchase } from "../entities/TicketPurchase";
import { MenuItemFromTicket } from "../entities/MenuItemFromTicket";

export async function previewUnifiedMenuQR(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { qrCode } = req.body;
    if (!qrCode) {
      res.status(400).json({ error: "Código QR es requerido" });
      return;
    }
    let payload;
    try {
      payload = decryptQR(qrCode);
    } catch (err) {
      res.status(400).json({ error: "Código QR inválido" });
      return;
    }
    const user = req.user!;
    if (payload.type === "menu") {
      // Try unified menu transaction first (new simplified structure)
      let validation = await previewUnifiedMenuTransaction(qrCode, user);
      
      if (validation.isValid) {
        // Handle unified menu transaction
        const transaction = validation.transaction!;
        const response = {
          used: transaction.qrPayload && transaction.qrPayload.includes('USED'),
          usedAt: null, // We'll need to add this field to track usage
          items: transaction.menuPurchases.map((purchase: any) => ({
            itemName: purchase.menuItem.name,
            variant: purchase.variant?.name || null,
            quantity: purchase.quantity,
            unitPrice: purchase.priceAtCheckout
          })),
          totalPaid: transaction.menuSubtotal,
          purchaseDate: transaction.createdAt,
          clubId: transaction.clubId,
          transactionId: transaction.id
        };
        res.json(response);
        return;
      }
      
      // Fallback to legacy menu transaction
      const legacyValidation = await previewMenuTransaction(qrCode, user);
      if (!legacyValidation.isValid) {
        res.status(400).json({ error: legacyValidation.error });
        return;
      }
      const legacyTransaction = legacyValidation.transaction!;
      const response = {
        used: legacyTransaction.isUsed,
        usedAt: legacyTransaction.usedAt,
        items: legacyTransaction.purchases.map((purchase: any) => ({
          itemName: purchase.menuItem.name,
          variant: purchase.variant?.name || null,
          quantity: purchase.quantity,
          unitPrice: purchase.priceAtCheckout
        })),
        totalPaid: legacyTransaction.totalPaid,
        purchaseDate: legacyTransaction.createdAt,
        clubId: legacyTransaction.clubId,
        transactionId: legacyTransaction.id
      };
      res.json(response);
    } else if (payload.type === "menu_from_ticket") {
      // Menu QR from ticket - use preview function (no restrictions)
      const validation = await previewMenuFromTicketPurchase(qrCode, user);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      const purchase = validation.purchase!;
      const menuItemFromTicketRepo = AppDataSource.getRepository(MenuItemFromTicket);
      const menuItems = await menuItemFromTicketRepo.find({
        where: { ticketPurchaseId: purchase.id },
        relations: ["menuItem", "variant"]
      });
      const response = {
        used: purchase.isUsedMenu,
        usedAt: purchase.menuQRUsedAt,
        ticketName: purchase.ticket.name,
        eventDate: purchase.date,
        items: menuItems.map(item => ({
          itemName: item.menuItem.name,
          variant: item.variant?.name || null,
          quantity: item.quantity
        })),
        purchaseDate: purchase.createdAt,
        clubId: purchase.clubId,
        purchaseId: purchase.id,
        isFutureEvent: validation.isFutureEvent // Include future event indicator
      };
      res.json(response);
    } else {
      res.status(400).json({ error: "Tipo de QR no soportado" });
    }
  } catch (error) {
    console.error("❌ Error previewing unified menu QR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function confirmUnifiedMenuQR(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { qrCode } = req.body;
    if (!qrCode) {
      res.status(400).json({ error: "QR code es requerido" });
      return;
    }
    let payload;
    try {
      payload = decryptQR(qrCode);
    } catch (err) {
      res.status(400).json({ error: "Código QR inválido" });
      return;
    }
    const user = req.user!;
    if (payload.type === "menu") {
      // Try unified menu transaction first (new simplified structure)
      let validation = await validateUnifiedMenuTransaction(qrCode, user);
      
      if (validation.isValid) {
        // Handle unified menu transaction
        const transaction = validation.transaction!;
        if (transaction.qrPayload && transaction.qrPayload.includes('USED')) {
          res.status(410).json({
            error: "Código QR ya usado",
            usedAt: null // We'll need to add this field to track usage
          });
          return;
        }
        
        // Mark as used by updating qrPayload
        const transactionRepository = AppDataSource.getRepository(UnifiedPurchaseTransaction);
        transaction.qrPayload = transaction.qrPayload + '_USED_' + Date.now();
        await transactionRepository.save(transaction);
        
        const response = {
          used: true,
          usedAt: new Date(),
          items: transaction.menuPurchases.map((purchase: any) => ({
            itemName: purchase.menuItem.name,
            variant: purchase.variant?.name || null,
            quantity: purchase.quantity,
            unitPrice: purchase.priceAtCheckout
          })),
          totalPaid: transaction.menuSubtotal,
          purchaseDate: transaction.createdAt,
          clubId: transaction.clubId,
          transactionId: transaction.id
        };
        res.json(response);
        return;
      }
      
      // Fallback to legacy menu transaction
      const legacyValidation = await validateMenuTransaction(qrCode, user);
      if (!legacyValidation.isValid) {
        res.status(400).json({ error: legacyValidation.error });
        return;
      }
      const legacyTransaction = legacyValidation.transaction!;
      if (legacyTransaction.isUsed) {
        res.status(410).json({
          error: "Código QR ya usado",
          usedAt: legacyTransaction.usedAt
        });
        return;
      }
      const transactionRepository = AppDataSource.getRepository(MenuPurchaseTransaction);
      legacyTransaction.isUsed = true;
      legacyTransaction.usedAt = new Date();
      await transactionRepository.save(legacyTransaction);
      const response = {
        used: true,
        usedAt: legacyTransaction.usedAt,
        items: legacyTransaction.purchases.map((purchase: any) => ({
          itemName: purchase.menuItem.name,
          variant: purchase.variant?.name || null,
          quantity: purchase.quantity,
          unitPrice: purchase.priceAtCheckout
        })),
        totalPaid: legacyTransaction.totalPaid,
        purchaseDate: legacyTransaction.createdAt,
        clubId: legacyTransaction.clubId,
        transactionId: legacyTransaction.id
      };
      res.json(response);
    } else if (payload.type === "menu_from_ticket") {
      // Menu QR from ticket
      const validation = await validateMenuFromTicketPurchase(qrCode, user, false); // isPreview = false (confirmation)
      if (!validation.isValid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      const purchase = validation.purchase!;
      if (purchase.isUsedMenu) {
        res.status(410).json({
          error: "Código QR de menú ya usado",
          usedAt: purchase.menuQRUsedAt
        });
        return;
      }
      const purchaseRepository = AppDataSource.getRepository(TicketPurchase);
      purchase.isUsedMenu = true;
      purchase.menuQRUsedAt = new Date();
      await purchaseRepository.save(purchase);
      const menuItemFromTicketRepo = AppDataSource.getRepository(MenuItemFromTicket);
      const menuItems = await menuItemFromTicketRepo.find({
        where: { ticketPurchaseId: purchase.id },
        relations: ["menuItem", "variant"]
      });
      const response = {
        used: true,
        usedAt: purchase.menuQRUsedAt,
        ticketName: purchase.ticket.name,
        eventDate: purchase.date,
        items: menuItems.map(item => ({
          itemName: item.menuItem.name,
          variant: item.variant?.name || null,
          quantity: item.quantity
        })),
        purchaseDate: purchase.createdAt,
        clubId: purchase.clubId,
        purchaseId: purchase.id,
      };
      res.json(response);
    } else {
      res.status(400).json({ error: "Tipo de QR no soportado" });
    }
  } catch (error) {
    console.error("❌ Error confirming unified menu QR:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
} 