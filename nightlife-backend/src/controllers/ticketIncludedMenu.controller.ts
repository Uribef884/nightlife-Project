import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { Ticket } from "../entities/Ticket";
import { MenuItem } from "../entities/MenuItem";
import { MenuItemVariant } from "../entities/MenuItemVariant";
import { AuthenticatedRequest } from "../types/express";

export async function getTicketIncludedMenuItems(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { ticketId } = req.params;

    if (!ticketId) {
      res.status(400).json({ error: "Ticket ID es requerido" });
      return;
    }

    // Verify ticket exists and supports included menu items
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const ticket = await ticketRepo.findOne({
      where: { id: ticketId, isDeleted: false }
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (!ticket.includesMenuItem) {
      res.status(400).json({ error: "Este ticket no soporta elementos de menú incluidos" });
      return;
    }

    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    const includedItems = await ticketIncludedMenuItemRepo.find({
      where: { ticketId },
      relations: ["menuItem", "variant"]
    });

    const formattedItems = includedItems.map(item => ({
      id: item.id,
      menuItemId: item.menuItemId,
      menuItemName: item.menuItem.name,
      variantId: item.variantId,
      variantName: item.variant?.name || null,
      quantity: item.quantity
    }));

    res.json(formattedItems);
  } catch (error) {
    console.error("❌ Error getting ticket included menu items:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function addTicketIncludedMenuItem(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { ticketId } = req.params;
    const { menuItemId, variantId, quantity } = req.body;

    if (!ticketId || !menuItemId || !quantity) {
      res.status(400).json({ error: "Ticket ID, menu item ID, y cantidad son requeridos" });
      return;
    }

    // Validate quantity - must be positive and within limits
    if (quantity <= 0) {
      res.status(400).json({ error: "Cantidad debe ser mayor que 0" });
      return;
    }

    if (quantity > 15) {
      res.status(400).json({ error: "Cantidad de un solo elemento de menú en un paquete no puede exceder 15" });
      return;
    }

    // Verify ticket exists and belongs to the club owner
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const ticket = await ticketRepo.findOne({
      where: { id: ticketId, isDeleted: false },
      relations: ["club"]
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (ticket.club.ownerId !== req.user!.id) {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }

    // Check if ticket supports included menu items
    if (!ticket.includesMenuItem) {
      res.status(400).json({ error: "Este ticket no soporta elementos de menú incluidos" });
      return;
    }

    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);

    // Verify menu item exists and belongs to the same club
    const menuItemRepo = AppDataSource.getRepository(MenuItem);
    const menuItem = await menuItemRepo.findOne({
      where: { id: menuItemId, clubId: ticket.clubId }
    });

    if (!menuItem) {
      res.status(404).json({ error: "Elemento de menú no encontrado o no pertenece a este club" });
      return;
    }

    // ❌ Prevent linking parent menu items with variants
    if (menuItem.hasVariants && !variantId) {
      res.status(400).json({ 
        error: `No se puede vincular el elemento de menú principal "${menuItem.name}" directamente. Por favor, especifique una variante en su lugar.` 
      });
      return;
    }

    // ❌ Prevent linking menu items without variants when no variant is specified
    if (!menuItem.hasVariants && variantId) {
      res.status(400).json({ 
        error: `El elemento de menú "${menuItem.name}" no tiene variantes. Por favor, elimine el variantId.` 
      });
      return;
    }

    // If variant is specified, verify it exists
    if (variantId) {
      const variantRepo = AppDataSource.getRepository(MenuItemVariant);
      const variant = await variantRepo.findOne({
        where: { id: variantId, menuItemId }
      });

      if (!variant) {
        res.status(404).json({ error: "Variante del elemento de menú no encontrada" });
        return;
      }
    }

    // Check if this combination already exists
    const existing = await ticketIncludedMenuItemRepo.findOne({
      where: { ticketId, menuItemId, variantId: variantId || null }
    });

    if (existing) {
      const itemName = menuItem.name;
      let variantName = '';
      if (variantId) {
        const variantRepo = AppDataSource.getRepository(MenuItemVariant);
        const variant = await variantRepo.findOne({ where: { id: variantId } });
        variantName = ` (${variant?.name || 'Unknown Variant'})`;
      }
      res.status(400).json({ 
        error: `Item "${itemName}${variantName}" ya está incluido en este combo de ticket` 
      });
      return;
    }

    const includedItem = ticketIncludedMenuItemRepo.create({
      ticketId,
      menuItemId,
      variantId: variantId || null,
      quantity
    });

    await ticketIncludedMenuItemRepo.save(includedItem);

    res.status(201).json({
      message: "Elemento de menú agregado al ticket",
      item: {
        id: includedItem.id,
        menuItemId: includedItem.menuItemId,
        variantId: includedItem.variantId,
        quantity: includedItem.quantity
      }
    });
  } catch (error) {
    console.error("❌ Error adding ticket included menu item:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function removeTicketIncludedMenuItem(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { ticketId, itemId } = req.params;

    if (!ticketId || !itemId) {
      res.status(400).json({ error: "Ticket ID e item ID son requeridos" });
      return;
    }

    // Verify ticket exists and belongs to the club owner
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const ticket = await ticketRepo.findOne({
      where: { id: ticketId, isDeleted: false },
      relations: ["club"]
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (ticket.club.ownerId !== req.user!.id) {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }

    // Check if ticket supports included menu items
    if (!ticket.includesMenuItem) {
      res.status(400).json({ error: "Este ticket no soporta elementos de menú incluidos" });
      return;
    }

    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    const item = await ticketIncludedMenuItemRepo.findOne({
      where: { id: itemId, ticketId }
    });

    if (!item) {
      res.status(404).json({ error: "Elemento de menú incluido no encontrado" });
      return;
    }

    await ticketIncludedMenuItemRepo.remove(item);

    res.json({ message: "Elemento de menú removido del ticket" });
  } catch (error) {
    console.error("❌ Error removing ticket included menu item:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function updateTicketIncludedMenuItem(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { ticketId, itemId } = req.params;
    const { quantity } = req.body;

    if (!ticketId || !itemId || quantity === undefined) {
      res.status(400).json({ error: "Ticket ID, item ID, y cantidad son requeridos" });
      return;
    }

    // Validate quantity - must be positive and within limits
    if (quantity <= 0) {
      res.status(400).json({ error: "Cantidad debe ser mayor que 0" });
      return;
    }

    if (quantity > 15) {
      res.status(400).json({ error: "Cantidad de un solo elemento de menú en un paquete no puede exceder 15" });
      return;
    }

    // Verify ticket exists and belongs to the club owner
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const ticket = await ticketRepo.findOne({
      where: { id: ticketId, isDeleted: false },
      relations: ["club"]
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (ticket.club.ownerId !== req.user!.id) {
      res.status(403).json({ error: "Acceso denegado" });
      return;
    }

    // Check if ticket supports included menu items
    if (!ticket.includesMenuItem) {
      res.status(400).json({ error: "Este ticket no soporta elementos de menú incluidos" });
      return;
    }

    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    const item = await ticketIncludedMenuItemRepo.findOne({
      where: { id: itemId, ticketId }
    });

    if (!item) {
      res.status(404).json({ error: "Elemento de menú incluido no encontrado" });
      return;
    }

    item.quantity = quantity;
    await ticketIncludedMenuItemRepo.save(item);

    res.json({
      message: "Cantidad del elemento de menú actualizada",
      item: {
        id: item.id,
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        quantity: item.quantity
      }
    });
  } catch (error) {
    console.error("❌ Error updating ticket included menu item:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
} 