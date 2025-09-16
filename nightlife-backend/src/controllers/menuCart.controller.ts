import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { MenuCartItem } from "../entities/MenuCartItem";
import { MenuItem } from "../entities/MenuItem";
import { Club } from "../entities/Club";
import { computeDynamicPrice } from "../utils/dynamicPricing";
import { UnifiedCartService } from "../services/unifiedCart.service";
import { AuthenticatedRequest } from "../types/express";
import { CartItem } from "../entities/TicketCartItem";
import { summarizeCartTotals } from "../utils/cartSummary";
import { isCartLockedSmart } from "../utils/cartLock";

// ✅ Ownership check for deletion
function ownsMenuCartItem(item: MenuCartItem, userId?: string, sessionId?: string): boolean {
  if (userId) return item.userId === userId;
  return item.sessionId === sessionId;
}

export const addToMenuCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { menuItemId, variantId, quantity } = req.body;
    const userId: string | undefined = req.user?.id;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    // Ensure we have either a userId or sessionId
    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    if (!menuItemId || quantity == null || quantity <= 0) {
      res.status(400).json({ error: "Campos faltantes o inválidos" });
      return;
    }

    // 🛑 Check if cart is locked for payment processing (smart check that auto-unlocks empty carts)
    const isLocked = await isCartLockedSmart(userId || null, sessionId || null, 'menu');
    if (isLocked) {
      res.status(423).json({ 
        error: "El carrito está siendo procesado actualmente. Por favor espera a que se complete tu pago antes de agregar más elementos." 
      });
      return;
    }

    // 🛑 Enforce ticket cart exclusivity
    const ticketCartRepo = AppDataSource.getRepository(CartItem);
    const existingTicketItems = await ticketCartRepo.find({ where: userId ? { userId } : { sessionId } });
    if (existingTicketItems.length > 0) {
      res.status(400).json({ error: "Debes completar o limpiar tu carrito de tickets antes de ordenar elementos del menú." });
      return;
    }

    // Check menu item and club
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const cartRepo = AppDataSource.getRepository(MenuCartItem);

    const menuItem = await itemRepo.findOne({
      where: { id: menuItemId },
      relations: ["variants", "club"]
    });

    if (!menuItem) {
      res.status(404).json({ error: "Elemento de menú no encontrado" });
      return;
    }

    // Check if club is in structured menu mode
    if (menuItem.club.menuType !== "structured") {
      const errorMessage = menuItem.club.menuType === "none" 
        ? "Este club no ofrece ordenamiento de menú." 
        : "El menú de este club no está disponible para ordenamiento. Por favor, contacte al club directamente.";
      
      res.status(400).json({ error: errorMessage });
      return;
    }

    if (!menuItem || !menuItem.isActive) {
      res.status(400).json({ error: "Elemento de menú inválido o inactivo" });
      return;
    }

    if (menuItem.hasVariants && !variantId) {
      res.status(400).json({ error: "Variante es requerida para este elemento" });
      return;
    }

    if (!menuItem.hasVariants && variantId) {
      res.status(400).json({ error: "Este elemento no usa variantes" });
      return;
    }

    const existingMenuItems = await cartRepo.find({ where: userId ? { userId } : { sessionId } });
    if (existingMenuItems.length > 0) {
      const existingClubId = existingMenuItems[0].clubId;
      if (existingClubId !== menuItem.clubId) {
        res.status(400).json({
          error: "Solo puedes agregar elementos de un club a tu carrito. Por favor, limpia tu carrito primero."
        });
        return;
      }
    }

    // Check maxPerPerson based on whether item has variants
    if (menuItem.hasVariants) {
      // For items with variants, check the variant's maxPerPerson
      if (variantId) {
        const variant = menuItem.variants.find(v => v.id === variantId);
        if (variant && variant.maxPerPerson && quantity > variant.maxPerPerson) {
          res.status(400).json({
            error: `Max per person para la variante "${variant.name}" es ${variant.maxPerPerson}`
          });
          return;
        }
      }
    } else {
      // For items without variants, check the parent's maxPerPerson
      if (menuItem.maxPerPerson && quantity > menuItem.maxPerPerson) {
        res.status(400).json({
          error: `Max per person para este elemento es ${menuItem.maxPerPerson}`
        });
        return;
      }
    }

    const basePrice = menuItem.hasVariants
      ? menuItem.variants.find(v => v.id === variantId)?.price ?? 0
      : menuItem.price!;

    const where = userId
      ? { userId, menuItemId, variantId: variantId || null }
      : { sessionId, menuItemId, variantId: variantId || null };

    const existing = await cartRepo.findOne({ where });

    if (existing) {
      const newTotal = existing.quantity + quantity;
      
      // Check maxPerPerson again for existing items
      if (menuItem.hasVariants) {
        if (variantId) {
          const variant = menuItem.variants.find(v => v.id === variantId);
          if (variant && variant.maxPerPerson && newTotal > variant.maxPerPerson) {
            res.status(400).json({
              error: `Max per person para la variante "${variant.name}" es ${variant.maxPerPerson}`
            });
            return;
          }
        }
      } else {
        if (menuItem.maxPerPerson && newTotal > menuItem.maxPerPerson) {
          res.status(400).json({
            error: `Max per person para este elemento es ${menuItem.maxPerPerson}`
          });
          return;
        }
      }
      
      existing.quantity = newTotal;
      await cartRepo.save(existing);
      res.json(existing);
    } else {
      const newItem = cartRepo.create({
        menuItemId,
        variantId: variantId || null,
      });

      newItem.userId = userId ?? null;
      newItem.sessionId = sessionId ?? null;
      newItem.quantity = quantity;
      newItem.clubId = menuItem.clubId;

      await cartRepo.save(newItem);
      res.status(201).json(newItem);
    }
  } catch (err) {
    console.error("❌ Error adding to menu cart:", err);
    res.status(500).json({ error: "Error del servidor al agregar elemento" });
  }
};

export const updateMenuCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, quantity } = req.body;
    const userId = req.user?.id ?? null;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    // Ensure we have either a userId or sessionId
    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    if (!id || !quantity || quantity <= 0) {
      res.status(400).json({ error: "Valid ID and quantity are required" });
      return;
    }

    // 🛑 Check if cart is locked for payment processing (smart check that auto-unlocks empty carts)
    const isLocked = await isCartLockedSmart(userId || null, sessionId || null, 'menu');
    if (isLocked) {
      res.status(423).json({ 
        error: "Carrito está siendo procesado actualmente. Por favor, espera a que se complete tu pago antes de modificar elementos." 
      });
      return;
    }

    const cartRepo = AppDataSource.getRepository(MenuCartItem);
    const itemRepo = AppDataSource.getRepository(MenuItem);

    const cartItem = await cartRepo.findOne({ where: { id } });
    if (!cartItem) {
      res.status(404).json({ error: "Elemento del carrito no encontrado" });
      return;
    }

    if (cartItem.userId !== userId && cartItem.sessionId !== sessionId) {
      res.status(403).json({ error: "No autorizado para actualizar este elemento" });
      return;
    }

    const menuItem = await itemRepo.findOne({ 
      where: { id: cartItem.menuItemId },
      relations: ["variants"]
    });
    if (!menuItem || !menuItem.isActive) {
      res.status(400).json({ error: "Elemento no disponible" });
      return;
    }

    // Check maxPerPerson based on whether item has variants
    if (menuItem.hasVariants) {
      // For items with variants, check the variant's maxPerPerson
      if (cartItem.variantId) {
        const variant = menuItem.variants.find(v => v.id === cartItem.variantId);
        if (variant && variant.maxPerPerson && quantity > variant.maxPerPerson) {
          res.status(400).json({
            error: `Max per person para la variante "${variant.name}" es ${variant.maxPerPerson}`
          });
          return;
        }
      }
    } else {
      // For items without variants, check the parent's maxPerPerson
      if (menuItem.maxPerPerson && quantity > menuItem.maxPerPerson) {
        res.status(400).json({
          error: `Max per person para este elemento es ${menuItem.maxPerPerson}`
        });
        return;
      }
    }

    cartItem.quantity = quantity;
    await cartRepo.save(cartItem);

    res.json(cartItem);
  } catch (err) {
    console.error("❌ Error updating cart item:", err);
    res.status(500).json({ error: "Error del servidor al actualizar elemento" });
  }
};

export const getMenuCartItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    const cartRepo = AppDataSource.getRepository(MenuCartItem);
    const whereClause = userId ? { userId } : { sessionId };

    const items = await cartRepo.find({
      where: whereClause,
      relations: ["menuItem", "variant", "menuItem.club"],
      order: { createdAt: "DESC" },
    });

    // Calculate dynamic prices for each item
    const itemsWithDynamicPrices = await Promise.all(items.map(async item => {
      const { menuItem, variant } = item;
      const club = menuItem.club;
      const basePrice = menuItem.hasVariants
        ? Number(variant?.price ?? 0)
        : Number(menuItem.price!);

      let dynamicPrice = basePrice;

      if (menuItem.hasVariants && variant) {
        if (variant.dynamicPricingEnabled && club) {
          const cartService = new UnifiedCartService();
          dynamicPrice = await cartService.calculateMenuDynamicPrice({
            basePrice,
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            selectedDate: undefined, // No specific date for cart display
            clubId: club.id,
          });
        }
      } else {
        if (menuItem.dynamicPricingEnabled && club) {
          const cartService = new UnifiedCartService();
          dynamicPrice = await cartService.calculateMenuDynamicPrice({
            basePrice,
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            selectedDate: undefined, // No specific date for cart display
            clubId: club.id,
          });
        }
      }

      // Add dynamic price to the menuItem object
      return {
        ...item,
        menuItem: {
          ...menuItem,
          dynamicPrice: dynamicPrice
        }
      };
    }));

    res.status(200).json(itemsWithDynamicPrices);
  } catch (err) {
    console.error("❌ Error fetching menu cart items:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const getMenuCartSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    const cartRepo = AppDataSource.getRepository(MenuCartItem);
    const whereClause = userId ? { userId } : { sessionId };

    const items = await cartRepo.find({
      where: whereClause,
      relations: ["menuItem", "variant", "menuItem.club"],
      order: { createdAt: "DESC" },
    });

    const pricingInfo = await Promise.all(items.map(async item => {
      const { menuItem, variant } = item;
      const club = menuItem.club;
      const basePrice = menuItem.hasVariants
        ? Number(variant?.price ?? 0)
        : Number(menuItem.price!);

      let dynamicPrice = basePrice;

      if (menuItem.hasVariants && variant) {
        if (variant.dynamicPricingEnabled && club) {
          const cartService = new UnifiedCartService();
          dynamicPrice = await cartService.calculateMenuDynamicPrice({
            basePrice,
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            selectedDate: undefined, // No specific date for cart summary
            clubId: club.id,
          });
        }
      } else {
        if (menuItem.dynamicPricingEnabled && club) {
          const cartService = new UnifiedCartService();
          dynamicPrice = await cartService.calculateMenuDynamicPrice({
            basePrice,
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            selectedDate: undefined, // No specific date for cart summary
            clubId: club.id,
          });
        }
      }

      return {
        itemTotal: dynamicPrice * item.quantity
      };
    }));

    const summary = summarizeCartTotals(pricingInfo, "menu");
    res.status(200).json(summary);
  } catch (err) {
    console.error("❌ Error fetching menu cart summary:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ✅ DELETE /menu/cart/:id — secure delete
export const removeMenuCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    // Ensure we have either a userId or sessionId
    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    const cartRepo = AppDataSource.getRepository(MenuCartItem);
    const item = await cartRepo.findOneBy({ id });

    if (!item) {
      res.status(404).json({ error: "Elemento del carrito no encontrado" });
      return;
    }

    // 🛑 Check if cart is locked for payment processing (smart check that auto-unlocks empty carts)
    const isLocked = await isCartLockedSmart(userId || null, sessionId || null, 'menu');
    if (isLocked) {
      res.status(423).json({ 
        error: "Carrito está siendo procesado actualmente. Por favor, espera a que se complete tu pago antes de eliminar elementos." 
      });
      return;
    }

    if (!ownsMenuCartItem(item, userId, sessionId)) {
      res.status(403).json({ error: "No puedes eliminar el carrito de otro usuario" });
      return;
    }

    await cartRepo.remove(item);
    res.status(204).send();
  } catch (err) {
    console.error("❌ Error removing menu cart item:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const clearMenuCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    // Ensure we have either a userId or sessionId
    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    const cartRepo = AppDataSource.getRepository(MenuCartItem);
    const whereClause = userId ? { userId } : { sessionId };

    await cartRepo.delete(whereClause);
    res.status(204).send();
  } catch (err) {
    console.error("❌ Error clearing menu cart:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

//Used if user want to add tickets to existing menu cart
export const clearTicketCartFromMenu = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const sessionId: string | undefined = !userId && req.sessionId ? req.sessionId : undefined;

    // Ensure we have either a userId or sessionId
    if (!userId && !sessionId) {
      res.status(401).json({ error: "Token faltante o inválido" });
      return;
    }

    const cartRepo = AppDataSource.getRepository(CartItem); // TicketCartItem
    const whereClause = userId ? { userId } : { sessionId };

    await cartRepo.delete(whereClause);
    res.status(204).send();
  } catch (err) {
    console.error("❌ Error clearing ticket cart from menu flow:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
