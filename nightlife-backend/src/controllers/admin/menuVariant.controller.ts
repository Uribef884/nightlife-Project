import { Request, Response } from "express";
import { AppDataSource } from "../../config/data-source";
import { MenuItemVariant } from "../../entities/MenuItemVariant";
import { MenuItem } from "../../entities/MenuItem";
import { TicketIncludedMenuItem } from "../../entities/TicketIncludedMenuItem";
import { MenuPurchase } from "../../entities/MenuPurchase";
import { sanitizeInput, sanitizeObject } from "../../utils/sanitizeInput";
import { AuthenticatedRequest } from "../../types/express";

// Admin function to get variants by menu item ID
export const getVariantsByMenuItemIdAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    
    const variants = await variantRepo.find({
      where: { menuItemId, isActive: true, isDeleted: false },
      order: { name: "ASC" },
    });

    res.json(variants);
  } catch (err) {
    console.error("❌ Error fetching variants:", err);
    res.status(500).json({ error: "Error al cargar variantes" });
  }
};

// Admin function to create menu item variant
export const createMenuItemVariantAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const { name, price, dynamicPricingEnabled, maxPerPerson } = req.body;
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    const itemRepo = AppDataSource.getRepository(MenuItem);

    if (!name || !price) {
      res.status(400).json({ error: "Nombre y precio son requeridos" });
      return;
    }

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      res.status(400).json({ error: "El precio debe ser un número positivo (mayor que 0)" });
      return;
    }

    // Validate minimum cost for variants (no free variants allowed)
    if (parsedPrice < 1500) {
      res.status(400).json({ error: "El precio debe ser al menos 1500 COP para variantes." });
      return;
    }

    const menuItem = await itemRepo.findOneBy({ id: menuItemId });
    if (!menuItem) {
      res.status(404).json({ error: "Elemento de menú no encontrado" });
      return;
    }

    const existing = await variantRepo.findOne({ where: { name, menuItemId } });
    if (existing) {
      res.status(400).json({ error: "El nombre de la variante debe ser único para este elemento" });
      return;
    }

    const variant = variantRepo.create({
      name,
      price,
      menuItemId,
      isActive: true,
      dynamicPricingEnabled: dynamicPricingEnabled !== undefined ? !!dynamicPricingEnabled : true, // Default to true for variants
      maxPerPerson: maxPerPerson || undefined,
    });

    await variantRepo.save(variant);
    res.status(201).json(variant);
  } catch (error) {
    console.error("❌ Error creating menu item variant:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to update menu item variant
export const updateMenuItemVariantAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);

    const variant = await variantRepo.findOne({ 
      where: { id, isDeleted: false },
      relations: ["menuItem"]
    });
    if (!variant) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }

    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name'
    ], { maxLength: 100 });
    
    const { name, price, isActive, dynamicPricingEnabled, maxPerPerson } = sanitizedBody;

    if (name !== undefined) {
      if (!name) {
        res.status(400).json({ error: "El nombre de la variante es inválido" });
        return;
      }
      const existing = await variantRepo.findOne({ where: { name, menuItemId: variant.menuItemId } });
      if (existing && existing.id !== variant.id) {
        res.status(400).json({ error: "El nombre de la variante debe ser único" });
        return;
      }
      variant.name = name;
    }

    if (price != null) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        res.status(400).json({ error: "El precio debe ser un número positivo (mayor que 0)" });
        return;
      }

      // Validate minimum cost for variants (no free variants allowed)
      if (parsedPrice < 1500) {
        res.status(400).json({ error: "El precio debe ser al menos 1500 COP para variantes." });
        return;
      }

      variant.price = parsedPrice;
    }

    if (typeof isActive === "boolean") {
      variant.isActive = isActive;
    }

    if (typeof dynamicPricingEnabled === "boolean") {
      variant.dynamicPricingEnabled = dynamicPricingEnabled;
    }

    if (maxPerPerson !== undefined) {
      if (maxPerPerson === null) {
        variant.maxPerPerson = undefined;
      } else {
        const parsedMaxPerPerson = parseInt(maxPerPerson);
        if (isNaN(parsedMaxPerPerson) || parsedMaxPerPerson <= 0) {
          res.status(400).json({ error: "Max por persona debe ser un entero positivo" });
          return;
        }
        variant.maxPerPerson = parsedMaxPerPerson;
      }
    }

    await variantRepo.save(variant);
    res.status(200).json(variant);
  } catch (error) {
    console.error("❌ Error updating menu item variant:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to delete menu item variant
export const deleteMenuItemVariantAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    const menuPurchaseRepo = AppDataSource.getRepository(MenuPurchase);

        const variant = await variantRepo.findOne({ 
      where: { id, isDeleted: false }, 
      relations: ["menuItem"] 
    });
    if (!variant) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }

    // Check if variant is included in any active ticket bundles
    const includedInTickets = await ticketIncludedMenuItemRepo.count({
      where: { variantId: id }
    });

    // Check if variant has any existing purchases
    const existingPurchases = await menuPurchaseRepo.count({
      where: { variantId: id }
    });

    if (includedInTickets > 0 || existingPurchases > 0) {
      // Soft delete - mark as deleted but keep the record
      variant.isDeleted = true;
      variant.deletedAt = new Date();
      variant.isActive = false; // Also deactivate to prevent new usage
      await variantRepo.save(variant);

      res.json({ 
        message: "Variante eliminada suavemente exitosamente", 
        deletedAt: variant.deletedAt,
        includedInTickets,
        existingPurchases,
        note: "Variante marcada como eliminada pero preservada debido a compras existentes o inclusiones de tickets"
      });
    } else {
      // Hard delete - no associated data, safe to completely remove
      await variantRepo.remove(variant);
      res.json({ 
        message: "Variante eliminada permanentemente exitosamente",
        note: "No associated purchases or ticket inclusions found, variant completely removed"
      });
    }
  } catch (error) {
    console.error("❌ Error deleting menu item variant:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to toggle menu item variant dynamic pricing
export const toggleMenuItemVariantDynamicPricingAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);

    const variant = await variantRepo.findOne({ 
      where: { id, isDeleted: false }, 
      relations: ["menuItem"] 
    });
    if (!variant) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }

    variant.dynamicPricingEnabled = !variant.dynamicPricingEnabled;
    await variantRepo.save(variant);
    res.json({ message: "Precio dinámico de variante de elemento de menú cambiado", dynamicPricingEnabled: variant.dynamicPricingEnabled });
  } catch (error) {
    console.error("❌ Error toggling menu item variant dynamic pricing:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}; 