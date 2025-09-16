import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { MenuItemVariant } from "../entities/MenuItemVariant";
import { MenuItem } from "../entities/MenuItem";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { MenuPurchase } from "../entities/MenuPurchase";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput";
import { AuthenticatedRequest } from "../types/express";
import { computeDynamicPrice } from "../utils/dynamicPricing";
import { Club } from "../entities/Club";

export const getVariantsByMenuItemId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const clubRepo = AppDataSource.getRepository(Club);
    
    const menuItem = await itemRepo.findOne({ where: { id: menuItemId }, relations: ["club"] });
    
    if (!menuItem) {
      res.status(404).json({ error: "Elemento de menú no encontrado" });
      return;
    }

    let club = menuItem.club || (await clubRepo.findOne({ where: { id: menuItem.clubId } }));
    
    // Check if the menu item's club uses PDF menu
    if (club && club.menuType === "pdf") {
      res.status(400).json({ 
        error: "Este elemento de menú pertenece a un club que usa un menú PDF. Las variantes de menú estructurados no están disponibles." 
      });
      return;
    }
    
    const variants = await variantRepo.find({
      where: { menuItemId, isActive: true, isDeleted: false },
      order: { name: "ASC" },
    });
    const variantsWithDynamic = variants.map(variant => {
      let dynamicPrice = variant.price;
      if (variant.dynamicPricingEnabled && club) {
        dynamicPrice = computeDynamicPrice({
          basePrice: Number(variant.price),
          clubOpenDays: club.openDays,
          openHours: club.openHours,
        });
      }
      return {
        ...variant,
        dynamicPrice,
      };
    });
    res.json(variantsWithDynamic);
  } catch (err) {
    console.error("Error fetching variants:", err);
    res.status(500).json({ error: "Error al cargar variantes" });
  }
};

export const createMenuItemVariant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden crear variantes" });
      return;
    }

    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name'
    ], { maxLength: 100 });
    
    const { menuItemId, name, price, dynamicPricingEnabled, maxPerPerson } = sanitizedBody;

    if (!name || typeof price !== "number" || price <= 0) {
      res.status(400).json({ error: "Nombre de variante y precio positivo son requeridos" });
      return;
    }

    // Validate minimum cost for variants (no free variants allowed)
    if (price < 1500) {
      res.status(400).json({ error: "El precio debe ser al menos 1500 COP para variantes." });
      return;
    }

    if (maxPerPerson !== undefined && maxPerPerson !== null) {
      if (typeof maxPerPerson !== "number" || maxPerPerson <= 0) {
        res.status(400).json({ error: "maxPerPerson debe ser un número positivo" });
        return;
      }
    }

    const itemRepo = AppDataSource.getRepository(MenuItem);
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);

    const menuItem = await itemRepo.findOneBy({ id: menuItemId });
    if (!menuItem || menuItem.clubId !== user.clubId) {
      res.status(403).json({ error: "No autorizado o elemento de menú no encontrado" });
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
  } catch (err) {
    console.error("Error creating variant:", err);
    res.status(500).json({ error: "Error del servidor al crear variante" });
  }
};

export const updateMenuItemVariant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name'
    ], { maxLength: 100 });
    
    const { name, price, isActive, dynamicPricingEnabled, maxPerPerson } = sanitizedBody;

    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden actualizar variantes" });
      return;
    }

    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    const itemRepo = AppDataSource.getRepository(MenuItem);

    const variant = await variantRepo.findOne({ 
      where: { id, isDeleted: false } 
    });
    if (!variant) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }

    const menuItem = await itemRepo.findOneBy({ id: variant.menuItemId });
    if (!menuItem || menuItem.clubId !== user.clubId) {
      res.status(403).json({ error: "No autorizado o elemento no encontrado" });
      return;
    }

    if (name !== undefined) {
      if (!name) {
        res.status(400).json({ error: "El nombre de la variante es inválido" });
        return;
      }
      const existing = await variantRepo.findOne({ where: { name, menuItemId: menuItem.id } });
      if (existing && existing.id !== variant.id) {
        res.status(400).json({ error: "El nombre de la variante debe ser único" });
        return;
      }
      variant.name = name;
    }

    if (price != null) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        res.status(400).json({ error: "El precio debe ser un número no negativo" });
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
      if (maxPerPerson !== null && (typeof maxPerPerson !== "number" || maxPerPerson <= 0)) {
        res.status(400).json({ error: "maxPerPerson debe ser un número positivo o null" });
        return;
      }
      variant.maxPerPerson = maxPerPerson;
    }

    await variantRepo.save(variant);
    res.json(variant);
  } catch (err) {
    console.error("Error updating variant:", err);
    res.status(500).json({ error: "Error al actualizar variante" });
  }
};

export const deleteMenuItemVariant = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden eliminar variantes" });
      return;
    }

    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    const menuPurchaseRepo = AppDataSource.getRepository(MenuPurchase);

    const variant = await variantRepo.findOne({ 
      where: { id, isDeleted: false } 
    });
    if (!variant) {
      res.status(404).json({ error: "Variante no encontrada" });
      return;
    }

    const item = await itemRepo.findOne({ 
      where: { id: variant.menuItemId, isDeleted: false } 
    });
    if (!item || item.clubId !== user.clubId) {
      res.status(403).json({ error: "No autorizado para eliminar esta variante" });
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
        message: "Variante eliminada exitosamente (soft delete)", 
        deletedAt: variant.deletedAt,
        includedInTickets,
        existingPurchases,
        note: "Variante marcada como eliminada pero preservada debido a compras existentes o paquetes de tickets"
      });
    } else {
      // Hard delete - no associated ticket bundles, safe to completely remove
      await variantRepo.remove(variant);
      res.json({ 
        message: "Variante eliminada permanentemente exitosamente",
        note: "No se encontraron paquetes de tickets asociados, variante eliminada completamente"
      });
    }
  } catch (err) {
    console.error("Error deleting variant:", err);
    res.status(500).json({ error: "Error del servidor al eliminar variante" });
  }
};

// PATCH /menu/variants/:id/toggle-dynamic-pricing — toggle dynamicPricingEnabled for variants
export const toggleMenuItemVariantDynamicPricing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden modificar variantes de elementos del menú" });
      return;
    }
    const repo = AppDataSource.getRepository(MenuItemVariant);
    const variant = await repo.findOne({ 
      where: { id, isDeleted: false }, 
      relations: ["menuItem"] 
    });
    if (!variant || !variant.menuItem || variant.menuItem.clubId !== user.clubId) {
      res.status(403).json({ error: "Variante no encontrada o no pertenece a tu club" });
      return;
    }
    variant.dynamicPricingEnabled = !variant.dynamicPricingEnabled;
    await repo.save(variant);
    res.json({ message: "Precios dinámicos de la variante del elemento de menú cambiados", dynamicPricingEnabled: variant.dynamicPricingEnabled });
  } catch (err) {
    console.error("Error toggling menu item variant dynamic pricing:", err);
    res.status(500).json({ error: "Error del servidor al cambiar precio dinámico" });
  }
};