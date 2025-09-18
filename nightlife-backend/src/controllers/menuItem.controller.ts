import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { MenuItem } from "../entities/MenuItem";
import { MenuCategory } from "../entities/MenuCategory";
import { MenuItemVariant } from "../entities/MenuItemVariant";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { MenuPurchase } from "../entities/MenuPurchase";
import { Club } from "../entities/Club";
import { Event } from "../entities/Event";
import { AuthenticatedRequest } from "../types/express";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput";
import { computeDynamicPrice } from "../utils/dynamicPricing";
import { validateImageUrlWithResponse } from "../utils/validateImageUrl";
import { S3Service } from "../services/s3Service";
import { ImageService } from "../services/imageService";
import { cleanupMenuItemS3Files } from "../utils/s3Cleanup";
import { UnifiedCartService } from "../services/unifiedCart.service";

export const createMenuItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description'
    ], { maxLength: 500 });
    
    const {
      name,
      description,
      price,
      maxPerPerson,
      hasVariants,
      categoryId,
      dynamicPricingEnabled
    } = sanitizedBody;

    // Parse boolean values from form data
    const hasVariantsBool = hasVariants === "true" || hasVariants === true;
    const dynamicPricingEnabledBool = dynamicPricingEnabled === "true" || dynamicPricingEnabled === true;
    const priceNum = price && price !== "" ? Number(price) : undefined;
    const maxPerPersonNum = maxPerPerson && maxPerPerson !== "" ? Number(maxPerPerson) : undefined;

    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden crear elementos de menú" });
      return;
    }

    // Check if club is in structured menu mode
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ where: { ownerId: user.id } });
    
    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    if (club.menuType !== "structured") {
      res.status(400).json({ 
        error: "Club debe estar en modo de menú estructurado para crear elementos de menú. Cambia a modo estructurado primero." 
      });
      return;
    }

    if (!name) {
      res.status(400).json({ error: "El nombre es requerido" });
      return;
    }

    const category = await AppDataSource.getRepository(MenuCategory).findOne({
      where: { id: categoryId },
      relations: ["club"]
    });

    if (!category || category.club.id !== user.clubId) {
      res.status(403).json({ error: "Categoría inválida o no pertenece a tu club" });
      return;
    }

    if (hasVariantsBool && priceNum !== null && priceNum !== undefined) {
      res.status(400).json({ error: "El precio debe ser null cuando hasVariants es true" });
      return;
    }

    if (!hasVariantsBool && (typeof priceNum !== "number" || priceNum <= 0)) {
      res.status(400).json({ error: "El precio debe ser un número positivo (mayor que 0) si hasVariants es false" });
      return;
    }

    // Validate minimum cost for menu items (no free items allowed)
    if (!hasVariantsBool && priceNum !== undefined && priceNum < 1500) {
      res.status(400).json({ error: "El precio debe ser al menos 1500 COP para elementos de menú." });
      return;
    }

    if (hasVariantsBool && maxPerPersonNum !== null && maxPerPersonNum !== undefined) {
      res.status(400).json({ error: "maxPerPerson debe ser null cuando hasVariants es true" });
      return;
    }

    if (!hasVariantsBool && (typeof maxPerPersonNum !== "number" || maxPerPersonNum <= 0)) {
      res.status(400).json({ error: "maxPerPerson debe ser un número positivo si hasVariants es false" });
      return;
    }

    // Enforce that parent menu items with variants cannot have dynamic pricing enabled
    if (hasVariantsBool && dynamicPricingEnabledBool) {
      res.status(400).json({ 
        error: "Los elementos de menú padre con variantes no pueden tener precios dinámicos habilitados. Los precios dinámicos deben configurarse en variantes individuales." 
      });
      return;
    }

    // Validate image file
    if (!req.file) {
      res.status(400).json({ error: "Archivo de imagen requerido." });
      return;
    }

    // Process image
    const processed = await (await import("../services/imageService")).ImageService.processImage(req.file.buffer);

    // Create menu item
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const item = new MenuItem();
    item.name = name;
    item.description = description ?? undefined;
    item.price = hasVariantsBool ? undefined : priceNum;
    item.maxPerPerson = hasVariantsBool ? undefined : maxPerPersonNum;
    item.hasVariants = hasVariantsBool;
    item.dynamicPricingEnabled = dynamicPricingEnabledBool;
    item.categoryId = categoryId;
    item.clubId = user.clubId;
    item.imageUrl = ""; // will be set after upload
    item.imageBlurhash = processed.blurhash;
    item.isActive = true;

    await itemRepo.save(item);

    // Upload image to S3
    const { S3Service } = await import("../services/s3Service");
    const key = S3Service.generateKey(user.clubId, 'menu-item');
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);
    
    // Update item with image URL
    item.imageUrl = uploadResult.url;
    await itemRepo.save(item);

    res.status(201).json(item);
  } catch (err) {
    console.error("Error creating menu item:", err);
    res.status(500).json({ error: "Error del servidor al crear elemento" });
  }
};

export const updateMenuItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    
    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description', 'imageUrl'
    ], { maxLength: 500 });
    
    const {
      name,
      description,
      imageUrl,
      price,
      maxPerPerson,
      hasVariants,
      dynamicPricingEnabled
    } = sanitizedBody;

    // Validate image URL if provided
    if (imageUrl && !validateImageUrlWithResponse(imageUrl, res)) {
      return;
    }

    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden actualizar elementos de menú" });
      return;
    }

    const repo = AppDataSource.getRepository(MenuItem);
    const item = await repo.findOne({
      where: { id },
      relations: ["club"]
    });

    if (!item || item.clubId !== user.clubId) {
      res.status(403).json({ error: "Elemento no encontrado o no pertenece a tu club" });
      return;
    }

    if (typeof hasVariants === "boolean" && hasVariants !== item.hasVariants) {
      res.status(400).json({ error: "No se puede cambiar hasVariants después de la creación del elemento" });
      return;
    }

    if (typeof name === "string") {
      const sanitizedName = sanitizeInput(name);
      if (!sanitizedName) {
        res.status(400).json({ error: "El nombre es requerido" });
        return;
      }
      item.name = sanitizedName;
    }

    if (typeof description === "string") {
      item.description = sanitizeInput(description) ?? undefined;
    }

    if (typeof imageUrl === "string") {
      item.imageUrl = imageUrl;
    }

    // Parse boolean values from form data for validation
    const hasVariantsBool = item.hasVariants;
    const priceNum = price && price !== "" ? Number(price) : undefined;
    const maxPerPersonNum = maxPerPerson && maxPerPerson !== "" ? Number(maxPerPerson) : undefined;

    // Only validate price if it's provided in the request
    if (price !== undefined) {
      if (hasVariantsBool && priceNum !== null && priceNum !== undefined) {
        res.status(400).json({ error: "El precio debe ser null cuando hasVariants es true" });
        return;
      }

      if (!hasVariantsBool && (typeof priceNum !== "number" || priceNum <= 0)) {
        res.status(400).json({ error: "El precio debe ser un número positivo (mayor que 0) si hasVariants es false" });
        return;
      }

      // Validate minimum cost for menu items (no free items allowed)
      if (!hasVariantsBool && priceNum !== undefined && priceNum < 1500) {
        res.status(400).json({ error: "El precio debe ser al menos 1500 COP para elementos de menú." });
        return;
      }
    }

    // Only validate maxPerPerson if it's provided in the request
    if (maxPerPerson !== undefined) {
      if (hasVariantsBool && maxPerPersonNum !== null && maxPerPersonNum !== undefined) {
        res.status(400).json({ error: "maxPerPerson debe ser null cuando hasVariants es true" });
        return;
      }

      if (!hasVariantsBool && (typeof maxPerPersonNum !== "number" || maxPerPersonNum <= 0)) {
        res.status(400).json({ error: "maxPerPerson debe ser un número positivo si hasVariants es false" });
        return;
      }
    }

    // Update price if provided and valid
    if (price !== undefined) {
      if (hasVariantsBool) {
        item.price = undefined;
      } else {
        item.price = priceNum;
      }
    }

    // Update maxPerPerson if provided and valid
    if (maxPerPerson !== undefined) {
      if (hasVariantsBool) {
        item.maxPerPerson = undefined;
      } else {
        item.maxPerPerson = maxPerPersonNum;
      }
    }

    if (dynamicPricingEnabled !== undefined) {
      // Enforce that parent menu items with variants cannot have dynamic pricing enabled
      if (item.hasVariants && dynamicPricingEnabled) {
        res.status(400).json({ 
          error: "Los elementos de menú padre con variantes no pueden tener precios dinámicos habilitados. Los precios dinámicos deben configurarse en variantes individuales." 
        });
        return;
      }
      item.dynamicPricingEnabled = !!dynamicPricingEnabled;
    }

    await repo.save(item);
    res.json(item);
  } catch (err) {
    console.error("Error updating menu item:", err);
    res.status(500).json({ error: "Error del servidor al actualizar elemento" });
  }
};

export const getAllMenuItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const repo = AppDataSource.getRepository(MenuItem);
    const clubRepo = AppDataSource.getRepository(Club);
    const items = await repo.find({
      where: { isActive: true, isDeleted: false },
      relations: ["variants", "club"],
      order: { name: "ASC" },
    });

    // Filter out inactive and soft-deleted variants
    const itemsWithDynamic = await Promise.all(items.map(async item => {
      if (item.variants) {
        item.variants = item.variants.filter(v => v.isActive && !v.isDeleted);
      }
      const club = item.club || (await clubRepo.findOne({ where: { id: item.clubId } }));
      
      // Skip items from clubs that use PDF menus
      if (club && club.menuType === "pdf") {
        return null;
      }
      
      let dynamicPrice = null;
      if (item.dynamicPricingEnabled && !item.hasVariants && club) {
        // Use the new event-aware dynamic pricing logic
        const cartService = new UnifiedCartService();
        dynamicPrice = await cartService.calculateMenuDynamicPrice({
          basePrice: Number(item.price),
          clubOpenDays: club.openDays,
          openHours: club.openHours,
          selectedDate: undefined, // No specific date for general menu display
          clubId: club.id,
        });
      }
      let variants = item.variants;
      if (item.hasVariants && variants && club) {
        variants = await Promise.all(variants.map(async variant => {
          let vDynamicPrice = variant.price;
          if (variant.dynamicPricingEnabled) {
            // Use the new event-aware dynamic pricing logic for variants
            const cartService = new UnifiedCartService();
            vDynamicPrice = await cartService.calculateMenuDynamicPrice({
              basePrice: Number(variant.price),
              clubOpenDays: club.openDays,
              openHours: club.openHours,
              selectedDate: undefined, // No specific date for general menu display
              clubId: club.id,
            });
          }
          return {
            ...variant,
            dynamicPrice: vDynamicPrice,
          };
        }));
      }
      return {
        ...item,
        dynamicPrice,
        variants,
      };
    }));
    
    // Filter out null items (from PDF menu clubs)
    const filteredItems = itemsWithDynamic.filter(item => item !== null);
    
    res.json(filteredItems);
  } catch (err) {
    console.error("Error fetching all menu items:", err);
    res.status(500).json({ error: "Error al cargar elementos del menú" });
  }
};

export const getMenuItemById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const repo = AppDataSource.getRepository(MenuItem);
    const item = await repo.findOne({
      where: { id, isDeleted: false },
      relations: ["category", "club", "variants"],
    });

    if (!item) {
      res.status(404).json({ error: "Elemento de menú no encontrado" });
      return;
    }

    // Check if the item's club uses PDF menu
    if (item.club && item.club.menuType === "pdf") {
      res.status(400).json({ 
        error: "Este elemento de menú pertenece a un club que usa un menú PDF. Los elementos de menú estructurados no están disponibles." 
      });
      return;
    }

    // Filter inactive and soft-deleted variants
    item.variants = item.variants?.filter(v => v.isActive && !v.isDeleted) ?? [];

    res.json(item);
  } catch (err) {
    console.error("Error fetching menu item by ID:", err);
    res.status(500).json({ error: "Error al cargar elemento del menú" });
  }
};

export const getItemsForMyClub = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden acceder a esto" });
      return;
    }

    const repo = AppDataSource.getRepository(MenuItem);
    const items = await repo.find({
      where: {
        clubId: user.clubId,
        isActive: true,
        isDeleted: false,
      },
      relations: ["category", "variants"],
      order: { name: "ASC" },
    });

    items.forEach(item => {
      if (item.variants) {
        item.variants = item.variants.filter(v => v.isActive && !v.isDeleted);
      }
    });

    res.json(items);
  } catch (err) {
    console.error("Error fetching items for my club:", err);
    res.status(500).json({ error: "Error al cargar tus elementos del menú" });
  }
};

export const deleteMenuItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;

    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Only club owners can delete menu items" });
      return;
    }

    const itemRepo = AppDataSource.getRepository(MenuItem);
    const variantRepo = AppDataSource.getRepository(MenuItemVariant);
    const ticketIncludedMenuItemRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    const menuPurchaseRepo = AppDataSource.getRepository(MenuPurchase);

    const item = await itemRepo.findOne({ 
      where: { id, isDeleted: false } 
    });

    if (!item || item.clubId !== user.clubId) {
      res.status(403).json({ error: "Elemento no encontrado o no pertenece a tu club" });
      return;
    }

    // Check if menu item is included in any active ticket bundles
    const includedInTickets = await ticketIncludedMenuItemRepo.count({
      where: { menuItemId: id }
    });

    // Check if menu item has any existing purchases
    const existingPurchases = await menuPurchaseRepo.count({
      where: { menuItemId: id }
    });

    if (includedInTickets > 0 || existingPurchases > 0) {
      // Soft delete - mark as deleted but keep the record
      item.isDeleted = true;
      item.deletedAt = new Date();
      item.isActive = false; // Also deactivate to prevent new usage
      await itemRepo.save(item);

      // Also soft delete all variants of this menu item
      const variants = await variantRepo.find({ where: { menuItemId: id } });
      for (const variant of variants) {
        variant.isDeleted = true;
        variant.deletedAt = new Date();
        variant.isActive = false;
        await variantRepo.save(variant);
      }

      // Clean up S3 image even for soft delete (since it's no longer needed)
      const s3CleanupResult = await cleanupMenuItemS3Files(item);

      res.json({ 
        message: "Elemento de menú eliminado exitosamente (soft delete)", 
        deletedAt: item.deletedAt,
        includedInTickets,
        existingPurchases,
        s3CleanupResult,
        note: "Elemento de menú marcado como eliminado pero preservado debido a compras existentes o paquetes de tickets. La imagen S3 ha sido limpiada."
      });
    } else {
      // Hard delete - no associated ticket bundles, safe to completely remove
      // Clean up S3 image
      const s3CleanupResult = await cleanupMenuItemS3Files(item);
      
      await variantRepo.delete({ menuItemId: id });
      await itemRepo.remove(item);

      res.json({ 
        message: "Elemento de menú eliminado permanentemente exitosamente",
        s3CleanupResult,
        note: "No se encontraron paquetes de tickets asociados, elemento de menú eliminado completamente. La imagen S3 ha sido limpiada."
      });
    }
  } catch (err) {
    console.error("Error deleting menu item:", err);
      res.status(500).json({ error: "Error al eliminar elemento del menú" });
  }
};

  export const getMenuForClub = async (req: Request, res: Response): Promise<void> => {
    try {
      const { clubId } = req.params;
      const repo = AppDataSource.getRepository(MenuItem);
      const clubRepo = AppDataSource.getRepository(Club);
      const club = await clubRepo.findOne({ where: { id: clubId } });

      if (!club) {
        res.status(404).json({ error: "Club no encontrado" });
        return;
      }

      // Check if club uses PDF menu
      if (club.menuType === "pdf") {
        res.status(400).json({ 
          error: "This club uses a PDF menu. Structured menu items are not available." 
        });
        return;
      }

      const items = await repo.find({
        where: {
          clubId,
          isActive: true,
          isDeleted: false,
        },
        relations: ["category", "variants"],
        order: {
          category: {
            name: "ASC",
          },
          name: "ASC",
        },
      });

      items.forEach(item => {
        if (item.variants) {
          item.variants = item.variants.filter(v => v.isActive);
        }
      });

      const itemsWithDynamic = await Promise.all(items.map(async item => {
        let dynamicPrice = null;
        if (item.dynamicPricingEnabled && !item.hasVariants && club) {
        // Use the new event-aware dynamic pricing logic
        const cartService = new UnifiedCartService();
        dynamicPrice = await cartService.calculateMenuDynamicPrice({
          basePrice: Number(item.price),
          clubOpenDays: club.openDays,
          openHours: club.openHours,
          selectedDate: undefined, // No specific date for general menu display
          clubId: club.id,
        });
        }
        let variants = item.variants;
        if (item.hasVariants && variants && club) {
          variants = await Promise.all(variants.map(async variant => {
            let vDynamicPrice = variant.price;
            if (variant.dynamicPricingEnabled) {
            // Use the new event-aware dynamic pricing logic for variants
            const cartService = new UnifiedCartService();
            vDynamicPrice = await cartService.calculateMenuDynamicPrice({
              basePrice: Number(variant.price),
              clubOpenDays: club.openDays,
              openHours: club.openHours,
              selectedDate: undefined, // No specific date for general menu display
              clubId: club.id,
            });
            }
            return {
              ...variant,
              dynamicPrice: vDynamicPrice,
            };
          }));
        }
        return {
          ...item,
          dynamicPrice,
          variants,
        };
      }));

      res.json(itemsWithDynamic);
    } catch (err) {
      console.error("Error loading menu for club:", err);
      res.status(500).json({ error: "Error al cargar el menú del club" });
    }
  };

  export const getPublicMenuForClub = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clubId } = req.params;
    const { date } = req.query; // Get the selected date from query params
    
    const repo = AppDataSource.getRepository(MenuItem);
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ where: { id: clubId } });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    // Check if club uses PDF menu
    if (club.menuType === "pdf") {
      res.status(400).json({ 
        error: "Este club usa un menú PDF. Los elementos de menú estructurados no están disponibles." 
      });
      return;
    }

    const items = await repo.find({
      where: {
        clubId,
        isActive: true,
        isDeleted: false,
      },
      relations: ["category", "variants"],
      order: {
        category: { name: "ASC" },
        name: "ASC",
      },
    });

    // Filter inactive and soft-deleted variants and group by category
    const grouped: Record<string, any> = {};

    await Promise.all(items.map(async item => {
      const variants = item.variants?.filter(v => v.isActive && !v.isDeleted) ?? [];
      let dynamicPrice = null;
      if (item.dynamicPricingEnabled && !item.hasVariants && club) {
        // Parse the selected date if provided, otherwise use current time
        let availableDate: Date | undefined;
        if (date && typeof date === 'string') {
          const [year, month, day] = date.split("-").map(Number);
          availableDate = new Date(year, month - 1, day);
        }
        
        // Use the new event-aware dynamic pricing logic
        const cartService = new UnifiedCartService();
        dynamicPrice = await cartService.calculateMenuDynamicPrice({
          basePrice: Number(item.price),
          clubOpenDays: club.openDays,
          openHours: club.openHours,
          selectedDate: availableDate,
          clubId: club.id,
        });
      }
      const publicItem = {
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        price: item.hasVariants ? null : item.price,
        dynamicPricingEnabled: item.dynamicPricingEnabled,
        dynamicPrice,
        variants: item.hasVariants
          ? await Promise.all(variants.map(async v => {
              let vDynamicPrice = v.price;
              if (v.dynamicPricingEnabled && club) {
                // Parse the selected date if provided, otherwise use current time
                let availableDate: Date | undefined;
                if (date && typeof date === 'string') {
                  const [year, month, day] = date.split("-").map(Number);
                  availableDate = new Date(year, month - 1, day);
                }
                
                // Use the new event-aware dynamic pricing logic for variants
                const cartService = new UnifiedCartService();
                vDynamicPrice = await cartService.calculateMenuDynamicPrice({
                  basePrice: Number(v.price),
                  clubOpenDays: club.openDays,
                  openHours: club.openHours,
                  selectedDate: availableDate,
                  clubId: club.id,
                });
              }
              return {
                id: v.id,
                name: v.name,
                price: v.price,
                dynamicPricingEnabled: v.dynamicPricingEnabled,
                dynamicPrice: vDynamicPrice,
              };
            }))
          : [],
      };

      const catKey = item.category?.id || "uncategorized";
      if (!grouped[catKey]) {
        grouped[catKey] = {
          id: item.category?.id || null,
          name: item.category?.name || "Uncategorized",
          items: []
        };
      }
      grouped[catKey].items.push(publicItem);
    }));

    const result = Object.values(grouped);

    res.json(result);
  } catch (err) {
    console.error("Error loading public menu:", err);
    res.status(500).json({ error: "Error al cargar el menú público" });
  }
};

/**
 * Get available menu items for a club on a specific date with event information
 * Similar to getAvailableTicketsForDate but for menu items
 */
export const getAvailableMenuForDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clubId, date } = req.params;

    if (!clubId || !date) {
      res.status(400).json({ error: "clubId y date son requeridos" });
      return;
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      res.status(400).json({ error: "Date debe ser en formato YYYY-MM-DD" });
      return;
    }

    const repo = AppDataSource.getRepository(MenuItem);
    const clubRepo = AppDataSource.getRepository(Club);
    const eventRepo = AppDataSource.getRepository(Event);

    // Get club
    const club = await clubRepo.findOne({
      where: { id: clubId, isActive: true, isDeleted: false }
    });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado o inactivo" });
      return;
    }

    // Check if there's an event on this date
    const eventDate = new Date(date);
    const event = await eventRepo.findOne({
      where: {
        clubId: clubId,
        availableDate: eventDate,
        isActive: true,
        isDeleted: false
      }
    });

    // Get menu items for the club
    const items = await repo.find({
      where: { 
        clubId: clubId, 
        isActive: true, 
        isDeleted: false 
      },
      relations: ["variants", "category"],
      order: { name: "ASC" },
    });

    // Filter out inactive and soft-deleted variants
    const itemsWithDynamic = await Promise.all(items.map(async item => {
      if (item.variants) {
        item.variants = item.variants.filter(v => v.isActive && !v.isDeleted);
      }
      
      let dynamicPrice = null;
      if (item.dynamicPricingEnabled && !item.hasVariants) {
        // Use the new event-aware dynamic pricing logic
        const cartService = new UnifiedCartService();
        dynamicPrice = await cartService.calculateMenuDynamicPrice({
          basePrice: Number(item.price),
          clubOpenDays: club.openDays,
          openHours: club.openHours,
          selectedDate: eventDate,
          clubId: club.id,
        });
      }
      
      let variants = item.variants;
      if (item.hasVariants && variants) {
        variants = await Promise.all(variants.map(async variant => {
          let vDynamicPrice = variant.price;
          if (variant.dynamicPricingEnabled) {
            // Use the new event-aware dynamic pricing logic for variants
            const cartService = new UnifiedCartService();
            vDynamicPrice = await cartService.calculateMenuDynamicPrice({
              basePrice: Number(variant.price),
              clubOpenDays: club.openDays,
              openHours: club.openHours,
              selectedDate: eventDate,
              clubId: club.id,
            });
          }
          return {
            ...variant,
            dynamicPrice: vDynamicPrice,
          } as any;
        }));
      }

      return {
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        imageBlurhash: item.imageBlurhash,
        price: item.hasVariants ? null : item.price,
        dynamicPricingEnabled: item.dynamicPricingEnabled,
        dynamicPrice,
        clubId: item.clubId,
        categoryId: item.categoryId,
        category: item.category ? {
          id: item.category.id,
          name: item.category.name,
          clubId: item.category.clubId,
          isActive: item.category.isActive,
        } : null,
        maxPerPerson: item.hasVariants ? null : item.maxPerPerson,
        hasVariants: item.hasVariants,
        isActive: item.isActive,
        isDeleted: item.isDeleted,
        variants: item.hasVariants
          ? variants.map((v: any) => ({
              id: v.id,
              name: v.name,
              price: v.price,
              dynamicPricingEnabled: v.dynamicPricingEnabled,
              dynamicPrice: v.dynamicPrice,
              maxPerPerson: v.maxPerPerson,
              isActive: v.isActive,
              isDeleted: v.isDeleted,
            }))
          : [],
      };
    }));

    // Group items by category
    const grouped: Record<string, any> = {};
    itemsWithDynamic.forEach(item => {
      const catKey = item.category?.id || "uncategorized";
      if (!grouped[catKey]) {
        grouped[catKey] = {
          id: item.category?.id || null,
          name: item.category?.name || "Uncategorized",
          items: []
        };
      }
      grouped[catKey].items.push(item);
    });

    const result = {
      clubId: club.id,
      date: date,
      dateHasEvent: !!event,
      event: event ? {
        id: event.id,
        name: event.name,
        availableDate: event.availableDate.toISOString().split('T')[0],
        bannerUrl: event.bannerUrl,
      } : null,
      categories: Object.values(grouped),
    };

    res.json(result);
  } catch (err) {
    console.error("Error loading available menu for date:", err);
    res.status(500).json({ error: "Error al cargar el menú disponible" });
  }
};

// PATCH /menu/items/:id/toggle-dynamic-pricing — toggle dynamicPricingEnabled
export const toggleMenuItemDynamicPricing = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { id } = req.params;
    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden modificar elementos de menú" });
      return;
    }
    const repo = AppDataSource.getRepository(MenuItem);
    const item = await repo.findOne({ where: { id } });
    if (!item || item.clubId !== user.clubId) {
      res.status(403).json({ error: "Elemento no encontrado o no pertenece a tu club" });
      return;
    }
    if (item.hasVariants) {
      res.status(400).json({ error: "No se pueden cambiar los precios dinámicos en elementos de menú con variantes. Usa el cambio de variante en su lugar." });
      return;
    }
    item.dynamicPricingEnabled = !item.dynamicPricingEnabled;
    await repo.save(item);
    res.json({ message: "Precios dinámicos del elemento de menú cambiados", dynamicPricingEnabled: item.dynamicPricingEnabled });
  } catch (err) {
    console.error("Error toggling menu item dynamic pricing:", err);
    res.status(500).json({ error: "Error del servidor cambiando precios dinámicos" });
  }
};

// Update menu item image
export const updateMenuItemImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const file = req.file!; // Guaranteed to exist due to middleware validation

    // Only club owners can upload menu item images
    if (user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden subir imágenes de elementos de menú" });
      return;
    }

    // Verify menu item ownership
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const item = await itemRepo.findOne({ where: { id } });

    if (!item || item.clubId !== user.clubId) {
      res.status(404).json({ error: 'Elemento de menú no encontrado o no autorizado' });
      return;
    }

    // Store reference to old image for deletion after successful upload
    const oldImageUrl = item.imageUrl;

    // Process image
    const processed = await ImageService.processImage(file.buffer);
    
    // Generate unique key with timestamp to ensure new URL
    const timestamp = Date.now();
    const key = S3Service.generateKey(item.clubId, 'menu-item-image', `${id}-${timestamp}`);
    const uploadResult = await S3Service.uploadFile(
      processed.buffer,
      'image/jpeg',
      key
    );

    // Update menu item
    item.imageUrl = uploadResult.url;
    item.imageBlurhash = processed.blurhash;
    await itemRepo.save(item);

    // Delete old image from S3 if upload and DB update were successful
    // Only delete if the URLs are different (same key = same URL = no deletion needed)
    if (oldImageUrl && oldImageUrl !== uploadResult.url) {
      try {
        // Parse the S3 URL to extract the key
        const url = new URL(oldImageUrl);
        const oldKey = url.pathname.substring(1); // Remove leading slash
        
        await S3Service.deleteFile(oldKey);
      } catch (deleteError) {
        console.error('⚠️ Warning: Failed to delete old menu item image from S3:', deleteError);
        // Don't fail the request - new image is already uploaded successfully
      }
    }

    res.json({
      message: 'Menu item image uploaded successfully',
      imageUrl: uploadResult.url,
      blurhash: processed.blurhash,
      itemId: item.id
    });
  } catch (error) {
    console.error('Error uploading menu item image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

