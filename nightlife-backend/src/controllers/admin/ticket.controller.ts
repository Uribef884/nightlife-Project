import { Request, Response } from "express";
import { AppDataSource } from "../../config/data-source";
import { Ticket, TicketCategory } from "../../entities/Ticket";
import { Club } from "../../entities/Club";
import { Event } from "../../entities/Event";
import { AuthenticatedRequest } from "../../types/express";
import { TicketIncludedMenuItem } from "../../entities/TicketIncludedMenuItem";
import { MenuItem } from "../../entities/MenuItem";
import { MenuItemVariant } from "../../entities/MenuItemVariant";
import { validateTicketInput } from "../../utils/ticketValidators";
import { sanitizeInput, sanitizeObject } from "../../utils/sanitizeInput";
import { TicketPurchase } from "../../entities/TicketPurchase";
import { computeDynamicPrice, computeDynamicEventPrice } from "../../utils/dynamicPricing";
import { cleanupTicketAds } from "../../utils/cleanupAds";

// Admin function to get tickets by club ID
export const getTicketsByClubAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clubId } = req.params;
    const repo = AppDataSource.getRepository(Ticket);
    const clubRepo = AppDataSource.getRepository(Club);
    const ticketIncludedMenuRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    
    const tickets = await repo.find({
      where: { club: { id: clubId }, isDeleted: false },
      order: { priority: "ASC" },
      relations: ["club", "event"],
    });
    
    const formatted = await Promise.all(tickets.map(async (t) => {
      const club = t.club || (await clubRepo.findOne({ where: { id: t.clubId } }));
      let dynamicPrice = t.price;
      
      if (t.dynamicPricingEnabled && club) {
        if (t.category === "event" && t.event) {
          // Event ticket - use event's date and openHours for dynamic pricing
          dynamicPrice = computeDynamicEventPrice(Number(t.price), new Date(t.event.availableDate), t.event.openHours);
          
          // Check if event has passed grace period
          if (dynamicPrice === -1) {
            // For ticket display, we'll show the ticket as unavailable instead of blocking
            dynamicPrice = 0; // Set to 0 to indicate unavailable
          }
        } else if (t.category === "event" && t.availableDate) {
          // Fallback: Event ticket without event relation - use ticket's availableDate
          dynamicPrice = computeDynamicEventPrice(Number(t.price), new Date(t.availableDate), undefined);
          
          // Check if event has passed grace period
          if (dynamicPrice === -1) {
            // For ticket display, we'll show the ticket as unavailable instead of blocking
            dynamicPrice = 0; // Set to 0 to indicate unavailable
          }
        } else {
          // General ticket - use time-based dynamic pricing
          dynamicPrice = computeDynamicPrice({
            basePrice: Number(t.price),
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            availableDate: t.availableDate,
            useDateBasedLogic: false,
          });
        }
      } else if (t.category === "event") {
        // Grace period check for event tickets when dynamic pricing is disabled
        if (t.event) {
          const gracePeriodCheck = computeDynamicEventPrice(Number(t.price), new Date(t.event.availableDate), t.event.openHours);
          if (gracePeriodCheck === -1) {
            // For ticket display, we'll show the ticket as unavailable instead of blocking
            dynamicPrice = 0; // Set to 0 to indicate unavailable
          } else if (gracePeriodCheck > Number(t.price)) {
            // If grace period price is higher than base price, use grace period price
            dynamicPrice = gracePeriodCheck;
          }
        } else if (t.availableDate) {
          const eventDate = new Date(t.availableDate);
          const gracePeriodCheck = computeDynamicEventPrice(Number(t.price), eventDate);
          if (gracePeriodCheck === -1) {
            // For ticket display, we'll show the ticket as unavailable instead of blocking
            dynamicPrice = 0; // Set to 0 to indicate unavailable
          } else if (gracePeriodCheck > Number(t.price)) {
            // If grace period price is higher than base price, use grace period price
            dynamicPrice = gracePeriodCheck;
          }
        }
      }
      
      // Fetch included menu items if this ticket includes them
      let includedMenuItems: Array<{
        id: string;
        menuItemId: string;
        menuItemName: string;
        variantId?: string;
        variantName: string | null;
        quantity: number;
      }> = [];
      
      if (t.includesMenuItem) {
        const includedItems = await ticketIncludedMenuRepo.find({
          where: { ticketId: t.id },
          relations: ["menuItem", "variant"]
        });
        
        includedMenuItems = includedItems.map(item => ({
          id: item.id,
          menuItemId: item.menuItemId,
          menuItemName: item.menuItem?.name || 'Unknown Item',
          variantId: item.variantId,
          variantName: item.variant?.name || null,
          quantity: item.quantity
        }));
      }
      
      return {
        ...t,
        soldOut: t.quantity !== null && t.quantity === 0,
        dynamicPrice,
        includedMenuItems,
      };
    }));
    
    // 🔒 Filter out free tickets when events exist for the same date
    const filteredTickets = await Promise.all(formatted.map(async (ticket) => {
      if (ticket.category === "free" && ticket.availableDate) {
        // Check if an event exists for this date
        const eventRepo = AppDataSource.getRepository(Event);
        const existingEvent = await eventRepo.findOne({
          where: { 
            clubId: ticket.clubId, 
            availableDate: ticket.availableDate,
            isActive: true,
            isDeleted: false
          }
        });
        
        // Hide free ticket if event exists for same date
        if (existingEvent) {
          return null;
        }
      }
      return ticket;
    }));
    
    // Remove null entries (hidden tickets)
    const visibleTickets = filteredTickets.filter(ticket => ticket !== null);
    
    // Count hidden free tickets for admins
    let hiddenFreeTicketsCount = 0;
    let hiddenFreeTicketsMessage = null;
    
    hiddenFreeTicketsCount = formatted.length - visibleTickets.length;
    if (hiddenFreeTicketsCount > 0) {
      hiddenFreeTicketsMessage = `${hiddenFreeTicketsCount} ticket(s) gratuitos ocultos porque existen eventos para la(s) misma(s) fecha(s).`;
    }
    
    const response: any = { tickets: visibleTickets };
    if (hiddenFreeTicketsMessage) {
      response.message = hiddenFreeTicketsMessage;
    }
    
    res.json(response);
  } catch (error) {
    console.error("❌ Error fetching tickets:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to create ticket for a specific club
export const createTicketAdmin = async (req: Request, res: Response): Promise<void> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const { clubId } = req.params;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autorizado" });
      await queryRunner.rollbackTransaction();
      return;
    }

    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description'
    ], { maxLength: 500 });

    const {
      name,
      description,
      price,
      maxPerPerson,
      priority,
      isActive,
      availableDate,
      quantity,
      category,
      eventId,
      dynamicPricingEnabled,
      includesMenuItem,
      menuItems,
    } = sanitizedBody;

    if (!name || price == null || maxPerPerson == null || priority == null || !category) {
      res.status(400).json({ error: "Campos requeridos faltantes" });
      await queryRunner.rollbackTransaction();
      return;
    }

    if (price < 0 || maxPerPerson < 0 || priority < 1) {
      res.status(400).json({ error: "Precio, maxPerPerson o prioridad inválidos" });
      await queryRunner.rollbackTransaction();
      return;
    }

    // Validate minimum cost for paid tickets (exclude free tickets)
    if (price !== 0 && price < 1500) {
      res.status(400).json({ error: "El precio debe ser al menos 1500 COP para tickets pagos. Usa precio 0 para tickets gratuitos." });
      await queryRunner.rollbackTransaction();
      return;
    }

    // Validate includesMenuItem and menuItems consistency
    if (includesMenuItem && (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0)) {
      res.status(400).json({ 
        error: "Cuando includesMenuItem es true, se debe proporcionar el array menuItems con al menos un elemento" 
      });
      await queryRunner.rollbackTransaction();
      return;
    }

    if (!includesMenuItem && menuItems && menuItems.length > 0) {
      res.status(400).json({ 
        error: "Cuando includesMenuItem es false, no se debe proporcionar menuItems" 
      });
      await queryRunner.rollbackTransaction();
      return;
    }

    const clubRepo = queryRunner.manager.getRepository(Club);
    const club = await clubRepo.findOne({ where: { id: clubId }, relations: ["owner"] });
    
    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      await queryRunner.rollbackTransaction();
      return;
    }

    // 📅 Normalize available date and validate it's not in the past
    let parsedDate: Date | null = null;
    let event: any = null;

    if (eventId) {
      const eventRepo = queryRunner.manager.getRepository(Event);
      event = await eventRepo.findOne({ 
        where: { id: eventId }, 
        relations: ["club"] 
      });

      if (!event || event.clubId !== club.id) {
        res.status(404).json({ error: "Evento no encontrado o no pertenece a este club" });
        await queryRunner.rollbackTransaction();
        return;
      }

      const [year, month, day] = String(event.availableDate).split("T")[0].split("-").map(Number);
      parsedDate = new Date(year, month - 1, day);
    } else if (availableDate) {
      const [year, month, day] = availableDate.split("-").map(Number);
      parsedDate = new Date(year, month - 1, day);
      parsedDate.setHours(0, 0, 0, 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsedDate < today) {
        res.status(400).json({ error: "La fecha disponible no puede ser en el pasado" });
        await queryRunner.rollbackTransaction();
        return;
      }
         }

     // ❌ Prevent dynamic pricing for free tickets
     let dynamicPricing = false;
     if (category === TicketCategory.FREE || price == 0) {
       if (dynamicPricingEnabled) {
         res.status(400).json({ error: "Los precios dinámicos no pueden habilitarse para tickets gratuitos. Los tickets gratuitos siempre deben tener un precio fijo de 0." });
         await queryRunner.rollbackTransaction();
         return;
       }
       dynamicPricing = false;
       
       // 🔒 Check if event exists for this date when creating free tickets
       if (availableDate && parsedDate) {
         const eventRepo = queryRunner.manager.getRepository(Event);
         const existingEvent = await eventRepo.findOne({
           where: { 
             clubId: club.id, 
             availableDate: parsedDate,
             isActive: true,
             isDeleted: false
           }
         });

         if (existingEvent) {
           res.status(400).json({ 
             error: `Cannot create free ticket for ${availableDate} because an event already exists for that date.` 
           });
           await queryRunner.rollbackTransaction();
           return;
         }
       }
     } else {
       dynamicPricing = !!dynamicPricingEnabled;
     }

     const ticketRepo = queryRunner.manager.getRepository(Ticket);
     const newTicket = ticketRepo.create({
       name: name.trim(),
       description: description?.trim() || null,
       price: Number(price),
       maxPerPerson: Number(maxPerPerson),
       priority: Number(priority),
       isActive: isActive !== false,
       availableDate: parsedDate ?? undefined,
       quantity: quantity !== undefined ? Number(quantity) : undefined,
       originalQuantity: quantity !== undefined ? Number(quantity) : undefined,
       category,
       eventId: eventId || null,
       dynamicPricingEnabled: dynamicPricing,
       includesMenuItem: includesMenuItem || false,
       clubId: clubId,
     });

    await ticketRepo.save(newTicket);

    // Handle included menu items if specified
    if (includesMenuItem && menuItems && Array.isArray(menuItems)) {
      const ticketIncludedMenuRepo = queryRunner.manager.getRepository(TicketIncludedMenuItem);
      const menuItemRepo = queryRunner.manager.getRepository(MenuItem);
      const variantRepo = queryRunner.manager.getRepository(MenuItemVariant);
      
      // Track added combinations to prevent duplicates
      const addedCombinations = new Set();
      
                    for (const menuItem of menuItems) {
         const combinationKey = `${menuItem.menuItemId}-${menuItem.variantId || 'null'}`;
         
         if (addedCombinations.has(combinationKey)) {
           // Get menu item name for error message
           const menuItemEntity = await menuItemRepo.findOne({ where: { id: menuItem.menuItemId } });
           const itemName = menuItemEntity?.name || 'Unknown Item';
           
           let variantName = '';
           if (menuItem.variantId) {
             const variant = await variantRepo.findOne({ where: { id: menuItem.variantId } });
             variantName = ` (${variant?.name || 'Unknown Variant'})`;
           }
           
           res.status(400).json({ 
             error: `Item "${itemName}${variantName}" ya está incluido en este combo de ticket` 
           });
           await queryRunner.rollbackTransaction();
           return;
         }
         
         // Get menu item entity for validation
         const menuItemEntity = await menuItemRepo.findOne({ where: { id: menuItem.menuItemId } });
         const itemName = menuItemEntity?.name || 'Unknown Item';
         
         // ❌ Ensure menu item belongs to the same club as the ticket
         if (menuItemEntity && menuItemEntity.clubId !== clubId) {
           res.status(400).json({ 
             error: `Menu item "${itemName}" no pertenece al mismo club que este ticket` 
           });
           await queryRunner.rollbackTransaction();
           return;
         }
         
         // ❌ Prevent linking parent menu items with variants
         if (menuItemEntity?.hasVariants && !menuItem.variantId) {
           res.status(400).json({ 
             error: `No se puede vincular el elemento de menú principal "${itemName}" directamente. Por favor, especifique una variante en su lugar.` 
           });
           await queryRunner.rollbackTransaction();
           return;
         }
         
         // ❌ Prevent linking menu items without variants when variant is specified
         if (menuItemEntity && !menuItemEntity.hasVariants && menuItem.variantId) {
           res.status(400).json({ 
             error: `Menu item "${itemName}" no tiene variantes. Por favor, elimine el variantId.` 
           });
           await queryRunner.rollbackTransaction();
           return;
         }
         
         addedCombinations.add(combinationKey);
         
         const includedItem = ticketIncludedMenuRepo.create({
           ticketId: newTicket.id,
           menuItemId: menuItem.menuItemId,
           variantId: menuItem.variantId || null,
           quantity: menuItem.quantity || 1,
         });
         await ticketIncludedMenuRepo.save(includedItem);
       }
    }

    await queryRunner.commitTransaction();
    res.status(201).json(newTicket);
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("❌ Error creating ticket:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    await queryRunner.release();
  }
};

// Admin function to get ticket by ID
export const getTicketByIdAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const { id } = req.params;
    const ticket = await ticketRepo.findOne({ 
      where: { id, isDeleted: false }, 
      relations: ["club", "event"] 
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error("❌ Error fetching ticket:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to update ticket
export const updateTicketAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const purchaseRepo = AppDataSource.getRepository(TicketPurchase);

    const ticket = await ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    // Sanitize inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description'
    ], { maxLength: 500 });

    const {
      name,
      description,
      price,
      maxPerPerson,
      priority,
      isActive,
      availableDate,
      quantity,
      category,
      eventId,
      dynamicPricingEnabled,
      includesMenuItem,
    } = sanitizedBody;

    // ❌ Prevent changing category
    if ("category" in sanitizedBody && sanitizedBody.category !== ticket.category) {
      res.status(400).json({
        error: "No se puede cambiar la categoría después de la creación del ticket",
      });
      return;
    }

    // ❌ Prevent changing eventId
    if ("eventId" in sanitizedBody && sanitizedBody.eventId !== ticket.eventId) {
      res.status(400).json({
        error: "No se puede cambiar eventId después de la creación del ticket",
      });
      return;
    }

    // ❌ Prevent changing includesMenuItem flag
    if ("includesMenuItem" in sanitizedBody && sanitizedBody.includesMenuItem !== ticket.includesMenuItem) {
      res.status(400).json({
        error: "No se puede cambiar la bandera includesMenuItem después de la creación del ticket",
      });
      return;
    }

    // ❌ Prevent changing availableDate
    if ("availableDate" in sanitizedBody && sanitizedBody.availableDate) {
      const normalizedUpdate = new Date(sanitizedBody.availableDate);
      normalizedUpdate.setHours(0, 0, 0, 0);

      const normalizedExisting = ticket.availableDate
        ? new Date(ticket.availableDate)
        : null;

      if (
        normalizedExisting &&
        normalizedUpdate.getTime() !== normalizedExisting.getTime()
      ) {
        res.status(400).json({ error: "No se puede actualizar la fecha disponible después de la creación del ticket" });
        return;
      }
    }

    // ❌ Prevent invalid price changes
    if ("price" in sanitizedBody) {
      const newPrice = parseFloat(sanitizedBody.price);

      if (isNaN(newPrice) || newPrice < 0) {
        res.status(400).json({ error: "El precio debe ser un número no negativo" });
        return;
      }

      // Validate minimum cost for paid tickets (exclude free tickets)
      if (newPrice !== 0 && newPrice < 1500) {
        res.status(400).json({ error: "El precio debe ser al menos 1500 COP para tickets pagos. Usa precio 0 para tickets gratuitos." });
        return;
      }

      // Lock based on category
      if (ticket.category === TicketCategory.FREE && newPrice !== 0) {
        res.status(400).json({
          error: "No se puede cambiar el precio de un ticket gratuito a un valor diferente de cero",
        });
        return;
      }

      if (
        ticket.category !== TicketCategory.FREE &&
        ticket.price === 0 &&
        newPrice > 0
      ) {
        res.status(400).json({
          error: "No se puede cambiar un ticket gratuito a un ticket pagado",
        });
        return;
      }

      if (
        ticket.category !== TicketCategory.FREE &&
        ticket.price > 0 &&
        newPrice === 0
      ) {
        res.status(400).json({
          error: "No se puede cambiar un ticket pagado a gratuito",
        });
        return;
      }
    }

    // ❌ Prevent invalid maxPerPerson
    if ("maxPerPerson" in sanitizedBody && sanitizedBody.maxPerPerson < 0) {
      res.status(400).json({ error: "maxPerPerson debe ser un número no negativo" });
      return;
    }

    // ❌ Prevent invalid priority
    if ("priority" in sanitizedBody && sanitizedBody.priority < 1) {
      res.status(400).json({ error: "priority debe ser al menos 1" });
      return;
    }

    // ❌ Prevent invalid quantity changes
    if ("quantity" in sanitizedBody) {
      const newQuantity = sanitizedBody.quantity;

      if (ticket.quantity === null) {
        res.status(400).json({
          error: "No se puede actualizar la cantidad para tickets creados sin cantidad",
        });
        return;
      }

      if (ticket.quantity !== null && newQuantity === null) {
        res.status(400).json({
          error: "No se puede eliminar la cantidad de tickets que originalmente tenían una",
        });
        return;
      }

      if (newQuantity != null && newQuantity < 0) {
        res.status(400).json({ error: "La cantidad debe ser no negativa" });
        return;
      }

      if (newQuantity != null) {
        const soldCount = await purchaseRepo.count({ where: { ticketId: ticket.id } });

        if (newQuantity < soldCount) {
          res.status(400).json({
            error: `No se puede reducir la cantidad por debajo del número de tickets ya vendidos (${soldCount})`,
          });
          return;
        }
      }
    }

    // ❌ Prevent changing originalQuantity
    if (
      "originalQuantity" in sanitizedBody &&
      sanitizedBody.originalQuantity !== ticket.originalQuantity
    ) {
      res.status(400).json({
        error: "originalQuantity no se puede actualizar después de la creación",
      });
      return;
    }

    // ❌ Prevent changing clubId
    if ("clubId" in sanitizedBody && sanitizedBody.clubId !== ticket.clubId) {
      res.status(400).json({ error: "clubId no se puede actualizar" });
      return;
    }

    // ❌ Prevent enabling dynamic pricing for free tickets
    if ("dynamicPricingEnabled" in sanitizedBody) {
      if ((ticket.category === TicketCategory.FREE || ticket.price === 0) && sanitizedBody.dynamicPricingEnabled) {
        res.status(400).json({ error: "Los precios dinámicos no pueden habilitarse para tickets gratuitos. Los tickets gratuitos siempre deben tener un precio fijo de 0." });
        return;
      }
    }

    // Apply valid updates
    if (name !== undefined) ticket.name = name.trim();
    if (description !== undefined) ticket.description = description?.trim() || null;
    if (price !== undefined) ticket.price = Number(price);
    if (maxPerPerson !== undefined) ticket.maxPerPerson = Number(maxPerPerson);
    if (priority !== undefined) ticket.priority = Number(priority);
    if (isActive !== undefined) ticket.isActive = isActive;
    if (availableDate !== undefined) ticket.availableDate = availableDate ? new Date(availableDate) : undefined;
    if (quantity !== undefined) ticket.quantity = quantity !== null ? Number(quantity) : undefined;
    if (category !== undefined) ticket.category = category;
    if (eventId !== undefined) ticket.eventId = eventId || null;
    if (dynamicPricingEnabled !== undefined) ticket.dynamicPricingEnabled = dynamicPricingEnabled;
    if (includesMenuItem !== undefined) ticket.includesMenuItem = includesMenuItem;

    await ticketRepo.save(ticket);
    res.status(200).json(ticket);
  } catch (error) {
    console.error("❌ Error updating ticket:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to delete ticket
export const deleteTicketAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const purchaseRepo = AppDataSource.getRepository(TicketPurchase);

    const ticket = await ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    // Check if there are associated purchases
    const associatedPurchases = await purchaseRepo.count({ where: { ticketId: ticketId } });

    // Clean up associated ads automatically
    const adCleanupResult = await cleanupTicketAds(ticketId);

    if (associatedPurchases > 0) {
      // Soft delete - mark as deleted but keep the record
      ticket.isDeleted = true;
      ticket.deletedAt = new Date();
      ticket.isActive = false; // Also deactivate to prevent new purchases
      await ticketRepo.save(ticket);
      
      res.status(200).json({ 
        message: "Ticket eliminado suavemente exitosamente", 
        deletedAt: ticket.deletedAt,
        associatedPurchases,
        adCleanupResult,
        note: "Ticket marked as deleted but preserved due to existing purchases. Associated ads have been deactivated."
      });
    } else {
      // Hard delete - no associated purchases, safe to completely remove
      await ticketRepo.remove(ticket);
      res.status(200).json({ 
        message: "Ticket eliminado permanentemente exitosamente",
        adCleanupResult,
        note: "No associated purchases found, ticket completely removed. Associated ads have been deactivated."
      });
    }
  } catch (error) {
    console.error("❌ Error deleting ticket:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to toggle ticket visibility
export const toggleTicketVisibilityAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const ticketRepo = AppDataSource.getRepository(Ticket);

    const ticket = await ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    ticket.isActive = !ticket.isActive;
    await ticketRepo.save(ticket);

    res.status(200).json({ isActive: ticket.isActive });
  } catch (error) {
    console.error("❌ Error toggling ticket visibility:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Admin function to toggle ticket dynamic pricing
export const toggleTicketDynamicPricingAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id;
    const ticketRepo = AppDataSource.getRepository(Ticket);

    const ticket = await ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    // ❌ Prevent enabling dynamic pricing for free tickets
    if ((ticket.category === TicketCategory.FREE || ticket.price === 0)) {
      if (!ticket.dynamicPricingEnabled) {
        // Don't allow enabling dynamic pricing for free tickets
        res.status(400).json({ error: "Los precios dinámicos no pueden habilitarse para tickets gratuitos. Los tickets gratuitos siempre deben tener un precio fijo de 0." });
        return;
      } else {
        // Allow disabling if currently enabled (shouldn't happen, but for safety)
        ticket.dynamicPricingEnabled = false;
        await ticketRepo.save(ticket);
        res.status(200).json({ message: "Los precios dinámicos han sido deshabilitados para este ticket gratuito. Los tickets gratuitos siempre deben tener un precio fijo de 0.", dynamicPricingEnabled: ticket.dynamicPricingEnabled });
        return;
      }
    }

    // For paid tickets, allow normal toggle
    ticket.dynamicPricingEnabled = !ticket.dynamicPricingEnabled;
    await ticketRepo.save(ticket);

    res.status(200).json({ message: "Precio dinámico del ticket cambiado", dynamicPricingEnabled: ticket.dynamicPricingEnabled });
  } catch (error) {
    console.error("❌ Error toggling ticket dynamic pricing:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}; 