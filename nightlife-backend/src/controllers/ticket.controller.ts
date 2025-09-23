import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Ticket } from "../entities/Ticket";
import { Club } from "../entities/Club";
import { AuthenticatedRequest } from "../types/express";
import { TicketPurchase } from "../entities/TicketPurchase"; 
import { Event } from "../entities/Event";
import { TicketCategory } from "../entities/Ticket";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { MenuItem } from "../entities/MenuItem";
import { MenuItemVariant } from "../entities/MenuItemVariant";
import { computeDynamicPrice, computeDynamicEventPrice, getEventTicketDynamicPricingReason, getNormalTicketDynamicPricingReason } from "../utils/dynamicPricing";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput";
import { MoreThanOrEqual, IsNull } from "typeorm";
import { cleanupTicketAds } from "../utils/cleanupAds";

// Utility function to get today's date in a timezone-safe way
const getTodayDate = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// CREATE TICKET
export async function createTicket(req: Request, res: Response): Promise<void> {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autorizado" });
      await queryRunner.rollbackTransaction();
      return;
    }

    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description', 'clubId'
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
      eventId, // ✅ clubId removed from destructuring
      dynamicPricingEnabled, // <-- add this to destructuring
      includesMenuItem,
      menuItems, // Array of menu items to include
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
    let club: Club | null = null;

    // 🔐 Admins must specify clubId
    if (user.role === "admin") {
      const { clubId } = req.body;
      if (!clubId) {
        res.status(400).json({ error: "El administrador debe especificar clubId" });
        await queryRunner.rollbackTransaction();
        return;
      }
      club = await clubRepo.findOne({ where: { id: clubId }, relations: ["owner"] });
    }

    // 🔐 Clubowners use their active club
    else if (user.role === "clubowner") {
      // Use the active club from the authenticated user
      if (!user.clubId) {
        res.status(403).json({ error: "No tienes un club activo seleccionado" });
        return;
      }
      
      // Verify the user owns this active club
      if (!user.clubIds?.includes(user.clubId)) {
        res.status(403).json({ error: "No eres propietario del club activo" });
        return;
      }
      
      club = await clubRepo.findOne({ where: { id: user.clubId }, relations: ["owner"] });
    }

    if (!club) {
      res.status(403).json({ error: "No autorizado o club no encontrado" });
      await queryRunner.rollbackTransaction();
      return;
    }

    // 📅 Normalize available date
    let parsedDate: Date | null = null;
    let event: Event | null = null;

    if (eventId) {
      const eventRepo = queryRunner.manager.getRepository(Event);
      event = await eventRepo.findOne({ where: { id: eventId }, relations: ["club"] });

      if (!event || event.clubId !== club.id) {
        res.status(404).json({ error: "Evento no encontrado o no pertenece a tu club" });
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
            error: `No se puede crear un ticket gratuito para ${availableDate} porque ya existe un evento para esa fecha.` 
          });
          await queryRunner.rollbackTransaction();
          return;
        }
      }
    } else {
      dynamicPricing = !!dynamicPricingEnabled;
    }

    const ticketRepo = queryRunner.manager.getRepository(Ticket);
    const ticket = ticketRepo.create({
      name,
      description,
      price,
      maxPerPerson,
      priority,
      isActive: isActive ?? true,
      availableDate: parsedDate ?? undefined,
      quantity: quantity ?? null,
      originalQuantity: quantity ?? null,
      category,
      club, // ✅ set by lookup, not user input
      ...(event ? { event } : {}),
      dynamicPricingEnabled: dynamicPricing,
      includesMenuItem: includesMenuItem ?? false,
    });

    // Validate menu items before saving anything
    if (includesMenuItem && menuItems && menuItems.length > 0) {
      const ticketIncludedMenuItemRepo = queryRunner.manager.getRepository(TicketIncludedMenuItem);
      const menuItemRepo = queryRunner.manager.getRepository(MenuItem);
      const menuItemVariantRepo = queryRunner.manager.getRepository(MenuItemVariant);

      // Check for duplicates within the menuItems array
      const seenCombinations = new Set();
      const duplicates = [];

      for (const menuItem of menuItems) {
        const { menuItemId, variantId } = menuItem;
        const combination = `${menuItemId}-${variantId || 'null'}`;
        
        if (seenCombinations.has(combination)) {
          duplicates.push(combination);
        } else {
          seenCombinations.add(combination);
        }
      }

      if (duplicates.length > 0) {
        res.status(400).json({ 
          error: "Se encontraron elementos de menú duplicados en la solicitud. Cada elemento de menú solo puede incluirse una vez por ticket." 
        });
        await queryRunner.rollbackTransaction();
        return;
      }

      const menuItemRecords = [];

      for (const menuItem of menuItems) {
        const { menuItemId, variantId, quantity } = menuItem;

        if (!menuItemId || !quantity || quantity <= 0) {
          res.status(400).json({ 
            error: "Cada elemento de menú debe tener menuItemId y cantidad positiva" 
          });
          await queryRunner.rollbackTransaction();
          return;
        }

        // Verify menu item exists and belongs to the club
        const menuItemEntity = await menuItemRepo.findOne({
          where: { id: menuItemId, clubId: club.id, isDeleted: false }
        });

        if (!menuItemEntity) {
          res.status(400).json({ 
            error: `Elemento de menú ${menuItemId} no encontrado o no pertenece a tu club` 
          });
          await queryRunner.rollbackTransaction();
          return;
        }

        // Check if menu item has variants
        const variants = await menuItemVariantRepo.find({
          where: { menuItemId, isActive: true, isDeleted: false }
        });

        if (variants.length > 0 && !variantId) {
          res.status(400).json({ 
            error: `El elemento de menú ${menuItemEntity.name} tiene variantes. Por favor especifica un variantId` 
          });
          await queryRunner.rollbackTransaction();
          return;
        }

        if (variantId) {
          // Verify variant exists and belongs to the menu item
          const variant = await menuItemVariantRepo.findOne({
            where: { id: variantId, menuItemId, isActive: true, isDeleted: false }
          });

          if (!variant) {
            res.status(400).json({ 
              error: `Variante ${variantId} no encontrada o no activa para el elemento de menú ${menuItemEntity.name}` 
            });
            await queryRunner.rollbackTransaction();
            return;
          }
        }

        // Prepare the ticket included menu item record
        const ticketIncludedMenuItem = ticketIncludedMenuItemRepo.create({
          // ticketId will be set after ticket is saved
          menuItemId,
          variantId: variantId || undefined,
          quantity
        });

        menuItemRecords.push(ticketIncludedMenuItem);
      }

      // Save the ticket first
      const saved = await ticketRepo.save(ticket);

      // Now set ticketId and save menu item records
      for (const record of menuItemRecords) {
        record.ticketId = saved.id;
      }
      await queryRunner.manager.getRepository(TicketIncludedMenuItem).save(menuItemRecords);

      await queryRunner.commitTransaction();
      res.status(201).json(saved);
      return;
    } else {
      // No menu items, just save the ticket
      const saved = await ticketRepo.save(ticket);
      await queryRunner.commitTransaction();
      res.status(201).json(saved);
      return;
    }
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("❌ Error creating ticket:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  } finally {
    await queryRunner.release();
  }
}

// ✅ UPDATE TICKET
export const updateTicket = async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const { id } = req.params;
  
  // Sanitize all string inputs
  const sanitizedUpdates = sanitizeObject(req.body, [
    'name', 'description'
  ], { maxLength: 500 });
  
  const updates = sanitizedUpdates;

  const ticketRepo = AppDataSource.getRepository(Ticket);
  const purchaseRepo = AppDataSource.getRepository(TicketPurchase);

  const ticket = await ticketRepo.findOne({
    where: { id },
    relations: ["club", "club.owner"],
  });

  if (!ticket) {
    res.status(404).json({ error: "Ticket no encontrado" });
    return;
  }

  if (user.role === "clubowner" && ticket.club.ownerId !== user.id) {
    res.status(403).json({ error: "No estás autorizado para actualizar este ticket" });
    return;
  }

  // ❌ Prevent changing category
  if ("category" in updates && updates.category !== ticket.category) {
    res.status(400).json({
      error: "No se puede cambiar la categoría después de la creación del ticket",
    });
    return;
  }

  // ❌ Prevent changing eventId
  if ("eventId" in updates && updates.eventId !== ticket.eventId) {
    res.status(400).json({
      error: "No se puede cambiar eventId después de la creación del ticket",
    });
    return;
  }

  // ❌ Prevent changing includesMenuItem flag
  if ("includesMenuItem" in updates && updates.includesMenuItem !== ticket.includesMenuItem) {
    res.status(400).json({
      error: "No se puede cambiar la bandera includesMenuItem después de la creación del ticket",
    });
    return;
  }

  if ("availableDate" in updates && updates.availableDate) {
    const normalizedUpdate = new Date(updates.availableDate);
    normalizedUpdate.setHours(0, 0, 0, 0);

    const normalizedExisting = ticket.availableDate
      ? new Date(ticket.availableDate)
      : null;

    if (
      normalizedExisting &&
      normalizedUpdate.getTime() !== normalizedExisting.getTime()
    ) {
      res.status(400).json({ error: "No se puede actualizar availableDate después de la creación" });
      return;
    }
  }

  if ("price" in updates) {
    const newPrice = parseFloat(updates.price);

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


  if ("maxPerPerson" in updates && updates.maxPerPerson < 0) {
    res.status(400).json({ error: "maxPerPerson debe ser un número no negativo" });
    return;
  }

  if ("priority" in updates && updates.priority < 1) {
    res.status(400).json({ error: "la prioridad debe ser al menos 1" });
    return;
  }

  if ("quantity" in updates) {
    const newQuantity = updates.quantity;

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

  if (
    "originalQuantity" in updates &&
    updates.originalQuantity !== ticket.originalQuantity
  ) {
    res.status(400).json({
      error: "originalQuantity no se puede actualizar después de la creación",
    });
    return;
  }

  if ("clubId" in updates && updates.clubId !== ticket.clubId) {
  res.status(400).json({ error: "clubId no se puede actualizar" });
  return;
  }

  Object.assign(ticket, updates);
  await ticketRepo.save(ticket);

  res.json({ message: "Ticket actualizado exitosamente", ticket });
};

  // ✅ GET ALL TICKETS
export async function getAllTickets(req: Request, res: Response): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Ticket);
    const clubRepo = AppDataSource.getRepository(Club);
    const ticketIncludedMenuRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    
    // Filter out past tickets while keeping tickets with null availableDate
    const tickets = await repo.find({
      where: [
        { isActive: true, isDeleted: false, availableDate: IsNull() }, // Always show tickets with null date
        { isActive: true, isDeleted: false, availableDate: MoreThanOrEqual(getTodayDate()) } // Show future tickets
      ],
      relations: ["club", "event"],
      order: { priority: "ASC" },
    });
    
    const formatted = await Promise.all(tickets.map(async (t) => {
      const club = t.club || (await clubRepo.findOne({ where: { id: t.clubId } }));
      let dynamicPrice = t.price;
      if (t.dynamicPricingEnabled && club) {
        const isFree = t.category === "free" || Number(t.price) === 0;
        if (t.category === "event" && t.event) {
          // Event ticket - use event's date and openHours for dynamic pricing
          dynamicPrice = computeDynamicEventPrice(Number(t.price), new Date(t.event.availableDate), t.event.openHours, { isFree });
          
          // Check if event has passed grace period
          if (dynamicPrice === -1) {
            // For ticket display, we'll show the ticket as unavailable instead of blocking
            dynamicPrice = 0; // Set to 0 to indicate unavailable
          }
        } else if (t.category === "event" && t.availableDate) {
          // Fallback: Event ticket without event relation - use ticket's availableDate
          dynamicPrice = computeDynamicEventPrice(Number(t.price), new Date(t.availableDate), undefined, { isFree });
          
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
          const gracePeriodCheck = computeDynamicEventPrice(Number(t.price), new Date(t.event.availableDate), t.event.openHours, { isFree: Number(t.price) === 0 });
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
    
    // Count hidden free tickets for club owners
    let hiddenFreeTicketsCount = 0;
    let hiddenFreeTicketsMessage = null;
    
    if (req.user?.role === "clubowner" || req.user?.role === "admin") {
      hiddenFreeTicketsCount = formatted.length - visibleTickets.length;
      if (hiddenFreeTicketsCount > 0) {
        hiddenFreeTicketsMessage = `${hiddenFreeTicketsCount} ticket(s) gratuito(s) oculto(s) porque existen eventos para la(s) misma(s) fecha(s).`;
      }
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
}

// ✅ GET TICKETS BY CLUB
export async function getTicketsByClub(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const repo = AppDataSource.getRepository(Ticket);
    const clubRepo = AppDataSource.getRepository(Club);
    const ticketIncludedMenuRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    
    // Filter out past tickets while keeping tickets with null availableDate
    const tickets = await repo.find({
      where: [
        { club: { id }, isActive: true, isDeleted: false, availableDate: IsNull() }, // Always show tickets with null date
        { club: { id }, isActive: true, isDeleted: false, availableDate: MoreThanOrEqual(getTodayDate()) } // Show future tickets
      ],
      order: { priority: "ASC" },
      relations: ["club", "event"],
    });
    
    const formatted = await Promise.all(tickets.map(async (t) => {
      const club = t.club || (await clubRepo.findOne({ where: { id: t.clubId } }));
      let dynamicPrice = t.price;
      if (t.dynamicPricingEnabled && club) {
        if (t.category === "event" && t.event) {
          // Event ticket - use event's date and openHours for dynamic pricing
          dynamicPrice = computeDynamicEventPrice(Number(t.price), new Date(t.event.availableDate), t.event.openHours, { isFree: Number(t.price) === 0 });
          
          // Check if event has passed grace period
          if (dynamicPrice === -1) {
            // For ticket display, we'll show the ticket as unavailable instead of blocking
            dynamicPrice = 0; // Set to 0 to indicate unavailable
          }
        } else if (t.category === "event" && t.availableDate) {
          // Fallback: Event ticket without event relation - use ticket's availableDate
          dynamicPrice = computeDynamicEventPrice(Number(t.price), new Date(t.availableDate), undefined, { isFree: Number(t.price) === 0 });
          
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
          const gracePeriodCheck = computeDynamicEventPrice(Number(t.price), new Date(t.event.availableDate), t.event.openHours, { isFree: Number(t.price) === 0 });
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
    
    // Count hidden free tickets for club owners
    let hiddenFreeTicketsCount = 0;
    let hiddenFreeTicketsMessage = null;
    
    if (req.user?.role === "clubowner" || req.user?.role === "admin") {
      hiddenFreeTicketsCount = formatted.length - visibleTickets.length;
      if (hiddenFreeTicketsCount > 0) {
        hiddenFreeTicketsMessage = `${hiddenFreeTicketsCount} ticket(s) gratuito(s) oculto(s) porque existen eventos para la(s) misma(s) fecha(s).`;
      }
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
}

// ✅ GET TICKET BY ID
export async function getTicketById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const clubRepo = AppDataSource.getRepository(Club);
    const { id } = req.params;
    
    // Build where clause based on authentication status
    let whereClause: any = { id, isDeleted: false };
    
    // If no user (public access), only show active tickets
    if (!user) {
      whereClause.isActive = true;
    }
    
    const ticket = await ticketRepo.findOne({ 
      where: whereClause, 
      relations: ["club"] 
    });
    
    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }
    
    // If user is authenticated and is a clubowner, check ownership
    if (user && user.role === "clubowner" && ticket.club.ownerId !== user.id) {
      res.status(403).json({ error: "Prohibido: Este ticket no pertenece a tu club" });
      return;
    }
    const club = ticket.club || (await clubRepo.findOne({ where: { id: ticket.clubId } }));
    let dynamicPrice = ticket.price;
    if (ticket.dynamicPricingEnabled && club) {
      if (ticket.category === "event" && ticket.event) {
        // Use dedicated event function for event tickets
        const { computeDynamicEventPrice } = await import("../utils/dynamicPricing");
        dynamicPrice = computeDynamicEventPrice(
          Number(ticket.price),
          ticket.event.availableDate,
          ticket.event.openHours
        );
      } else {
        // Use general function for non-event tickets
        dynamicPrice = computeDynamicPrice({
          basePrice: Number(ticket.price),
          clubOpenDays: club.openDays,
          openHours: club.openHours,
          availableDate: ticket.availableDate,
          useDateBasedLogic: false,
        });
      }
    }
    const response = {
      ...ticket,
      soldOut: ticket.quantity !== null && ticket.quantity === 0,
      dynamicPrice,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Error fetching ticket by ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// ✅ GET TICKETS FOR MY CLUB
export const getTicketsForMyClub = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Prohibido: Solo los propietarios de club pueden acceder a esto" });
      return;
    }

    const clubRepo = AppDataSource.getRepository(Club);
    const ticketRepo = AppDataSource.getRepository(Ticket);

    // Use the active club from the authenticated user
    if (!user.clubId) {
      res.status(403).json({ error: "No tienes un club activo seleccionado" });
      return;
    }
    
    // Verify the user owns this active club
    if (!user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    const club = await clubRepo.findOne({ where: { id: user.clubId } });

    if (!club) {
      res.status(404).json({ error: "Club activo no encontrado" });
      return;
    }

    const tickets = await ticketRepo.find({
      where: { club: { id: club.id }, isDeleted: false },
      order: { priority: "ASC" },
    });

    const formatted = tickets.map((t) => ({
      ...t,
      soldOut: t.quantity !== null && t.quantity === 0,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching my club's tickets:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// ✅ DELETE TICKET
export async function deleteTicket(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    const { id } = req.params;
    const ticketRepo = AppDataSource.getRepository(Ticket);
    const purchaseRepo = AppDataSource.getRepository(TicketPurchase);
    
    const ticket = await ticketRepo.findOne({ 
      where: { id }, 
      relations: ["club", "club.owner"] 
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (user.role === "clubowner" && ticket.club.ownerId !== user.id) {
      res.status(403).json({ error: "No estás autorizado para eliminar este ticket" });
      return;
    }

    // Check if there are associated purchases
    const associatedPurchases = await purchaseRepo.count({ where: { ticketId: id } });

    // Clean up associated ads automatically
    const adCleanupResult = await cleanupTicketAds(id);

    if (associatedPurchases > 0) {
      // Soft delete - mark as deleted but keep the record
      ticket.isDeleted = true;
      ticket.deletedAt = new Date();
      ticket.isActive = false; // Also deactivate to prevent new purchases
      await ticketRepo.save(ticket);
      
      res.json({ 
        message: "Ticket eliminado exitosamente (soft delete)", 
        deletedAt: ticket.deletedAt,
        associatedPurchases,
        adCleanupResult,
        note: "Ticket marcado como eliminado pero preservado debido a compras existentes. Los anuncios asociados han sido desactivados."
      });
    } else {
      // Hard delete - no associated purchases, safe to completely remove
      await ticketRepo.remove(ticket);
      res.json({ 
        message: "Ticket eliminado permanentemente exitosamente",
        adCleanupResult,
        note: "No se encontraron compras asociadas, ticket eliminado completamente. Los anuncios asociados han sido desactivados."
      });
    }
  } catch (error) {
    console.error("❌ Error deleting ticket:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// ✅ TOGGLE VISIBILITY
export const toggleTicketVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    const { id } = req.params;
    const repo = AppDataSource.getRepository(Ticket);

    const ticket = await repo.findOne({ where: { id }, relations: ["club", "club.owner"] });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (user.role === "clubowner" && ticket.club.ownerId !== user.id) {
      res.status(403).json({ error: "No estás autorizado para modificar este ticket" });
      return;
    }

    ticket.isActive = !ticket.isActive;
    await repo.save(ticket);

    res.json({ message: "Visibilidad del ticket cambiada", isActive: ticket.isActive });
  } catch (error) {
    console.error("❌ Error toggling ticket visibility:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PATCH /tickets/:id/toggle-dynamic-pricing — toggle dynamicPricingEnabled
export const toggleTicketDynamicPricing = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    const { id } = req.params;
    const repo = AppDataSource.getRepository(Ticket);
    const ticket = await repo.findOne({ where: { id }, relations: ["club", "club.owner"] });

    if (!ticket) {
      res.status(404).json({ error: "Ticket no encontrado" });
      return;
    }

    if (user.role === "clubowner" && ticket.club.ownerId !== user.id) {
      res.status(403).json({ error: "No estás autorizado para modificar este ticket" });
      return;
    }

    // Prevent enabling dynamic pricing for free tickets
    if ((ticket.category === TicketCategory.FREE || ticket.price === 0)) {
      if (!ticket.dynamicPricingEnabled) {
        // Don't allow enabling dynamic pricing for free tickets
        res.status(400).json({ error: "Los precios dinámicos no pueden habilitarse para tickets gratuitos. Los tickets gratuitos siempre deben tener un precio fijo de 0." });
        return;
      } else {
        // Allow disabling if currently enabled (shouldn't happen, but for safety)
        ticket.dynamicPricingEnabled = false;
        await repo.save(ticket);
        res.json({ message: "Los precios dinámicos han sido deshabilitados para este ticket gratuito. Los tickets gratuitos siempre deben tener un precio fijo de 0.", dynamicPricingEnabled: ticket.dynamicPricingEnabled });
        return;
      }
    }

    // For paid tickets, allow normal toggle
    ticket.dynamicPricingEnabled = !ticket.dynamicPricingEnabled;
    await repo.save(ticket);

    res.json({ message: "Precios dinámicos del ticket cambiados", dynamicPricingEnabled: ticket.dynamicPricingEnabled });
  } catch (error) {
    console.error("❌ Error toggling ticket dynamic pricing:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// ✅ GET AVAILABLE TICKETS FOR DATE
export async function getAvailableTicketsForDate(req: Request, res: Response): Promise<void> {
  try {
    const { clubId, dateISO } = req.params;
    const { includeInactive } = req.query;
    
    // Validate clubId is a valid UUID
    if (!clubId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clubId)) {
      res.status(400).json({ error: "Formato de clubId inválido" });
      return;
    }
    
    // Validate dateISO format
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      res.status(400).json({ error: "Formato de fecha inválido. Usa YYYY-MM-DD" });
      return;
    }
    
    // Parse date to avoid timezone drift
    const [year, month, day] = dateISO.split("-").map(Number);
    const targetDate = new Date(year, month - 1, day);
    
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: "Fecha inválida" });
      return;
    }
    
    // Helper function to safely convert dates
    const safeDateToString = (date: any): string => {
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }
      if (typeof date === 'string') {
        return date.split('T')[0];
      }
      // Fallback: try to create a Date object
      try {
        return new Date(date).toISOString().split('T')[0];
      } catch {
        return dateISO; // fallback to input date
      }
    };
    
    // Get weekday index (0 = Sunday, 6 = Saturday)
    const weekdayIndex = targetDate.getDay();
    
    // Get weekday name for comparison
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const weekdayName = weekdayNames[weekdayIndex];
    
    // Check if user can see inactive items
    const user = req.user;
    const canSeeInactive = user && (
      user.role === "admin" || 
      (user.role === "clubowner" && includeInactive === "true")
    );
    
    // Find club and validate it exists and is active
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ 
      where: { id: clubId, isActive: true },
      relations: ["owner"]
    });
    
    if (!club) {
      res.status(404).json({ error: "Club no encontrado o inactivo" });
      return;
    }
    
    // If clubowner, verify they own this club
    if (user && user.role === "clubowner" && club.ownerId !== user.id) {
      res.status(403).json({ error: "Prohibido: Solo puedes acceder a tu propio club" });
      return;
    }
    
    // Check if club is open on this weekday
    const isClubOpenOnWeekday = club.openDays && club.openDays.includes(weekdayName);
    
    // Check if there's an event on this date
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({
      where: { 
        clubId: club.id, 
        availableDate: targetDate,
        isActive: true,
        isDeleted: false
      },
      order: { createdAt: "ASC" } // Deterministic selection if multiple events
    });
    
    const dateHasEvent = !!event;
    
    // Get tickets based on event status
    const ticketRepo = AppDataSource.getRepository(Ticket);
    let tickets: any[] = [];
    
    if (dateHasEvent) {
      // Event day: return only event tickets for this date
      tickets = await ticketRepo.find({
        where: {
          clubId: club.id,
          category: TicketCategory.EVENT,
          availableDate: targetDate,
          isDeleted: false,
          ...(canSeeInactive ? {} : { isActive: true })
        },
        order: { priority: "ASC" }
      });
    } else {
      // Non-event day: return general and free tickets
      const generalTickets = await ticketRepo.find({
        where: {
          clubId: club.id,
          category: TicketCategory.GENERAL,
          availableDate: IsNull(), // General covers don't have a specific date
          isDeleted: false,
          ...(canSeeInactive ? {} : { isActive: true })
        },
        order: { priority: "ASC" }
      });
      
      const freeTickets = await ticketRepo.find({
        where: {
          clubId: club.id,
          category: TicketCategory.FREE,
          availableDate: targetDate,
          isDeleted: false,
          ...(canSeeInactive ? {} : { isActive: true }),
        },
        order: { priority: "ASC" }
      });
      
      // Filter free tickets by category only (not price === 0)
      // Include tickets with quantity = 0 so they show as "AGOTADO"
      const validFreeTickets = freeTickets.filter(ticket => 
        ticket.category === TicketCategory.FREE
      );
      
      // Filter general tickets by club open status and 3-week limit
      const threeWeeksFromNow = new Date();
      threeWeeksFromNow.setDate(threeWeeksFromNow.getDate() + 21);
      
      const validGeneralTickets = generalTickets.filter(ticket => {
        // Only show if club is open on this weekday
        if (!isClubOpenOnWeekday) return false;
        
        // Optional: reject dates > 3 weeks out for general covers
        if (targetDate > threeWeeksFromNow) return false;
        
        return true;
      });
      
      tickets = [...validGeneralTickets, ...validFreeTickets];
    }
    
    // Process tickets with dynamic pricing and included menu items
    const processedTickets = await Promise.all(tickets.map(async (ticket) => {
      let dynamicPrice = Number(ticket.price);
      let dynamicPricingReason: string | undefined = undefined;
      
      if (ticket.dynamicPricingEnabled) {
        if (ticket.category === TicketCategory.EVENT) {
          // Event ticket dynamic pricing
          if (event) {
            // Ensure we have a proper Date object for the event
            const eventDate = event.availableDate instanceof Date 
              ? event.availableDate 
              : new Date(event.availableDate);
            
            dynamicPrice = computeDynamicEventPrice(Number(ticket.price), eventDate, event.openHours, { isFree: Number(ticket.price) === 0 });
            if (dynamicPrice === -1) {
              // Event has passed grace period, mark as unavailable
              dynamicPrice = 0;
            }
            dynamicPricingReason = getEventTicketDynamicPricingReason(eventDate, event.openHours);
          } else {
            // Fallback for event tickets without event relation
            dynamicPrice = computeDynamicEventPrice(Number(ticket.price), targetDate, undefined, { isFree: Number(ticket.price) === 0 });
            if (dynamicPrice === -1) {
              dynamicPrice = 0;
            }
            dynamicPricingReason = getEventTicketDynamicPricingReason(targetDate);
          }
        } else if (ticket.category === TicketCategory.GENERAL) {
          // General ticket dynamic pricing
          dynamicPrice = computeDynamicPrice({
            basePrice: Number(ticket.price),
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            availableDate: targetDate,
            useDateBasedLogic: false,
          });
          dynamicPricingReason = getNormalTicketDynamicPricingReason({
            basePrice: Number(ticket.price),
            clubOpenDays: club.openDays,
            openHours: club.openHours,
            availableDate: targetDate,
            useDateBasedLogic: false,
          });
        }
        // Free tickets keep price = 0
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
      
      if (ticket.includesMenuItem) {
        const ticketIncludedMenuRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
        const includedItems = await ticketIncludedMenuRepo.find({
          where: { ticketId: ticket.id },
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
        id: ticket.id,
        name: ticket.name,
        description: ticket.description,
        category: ticket.category,
        availableDate: ticket.availableDate,
        quantity: ticket.quantity,
        maxPerPerson: ticket.maxPerPerson,
        priority: ticket.priority,
        price: Number(ticket.price),
        dynamicPrice,
        dynamicPricingEnabled: ticket.dynamicPricingEnabled,
        dynamicPricingReason,
        includesMenuItem: ticket.includesMenuItem,
        includedMenuItems
      };
    }));
    
    // Separate tickets by category
    const eventTickets = processedTickets.filter(t => t.category === TicketCategory.EVENT);
    const generalTickets = processedTickets.filter(t => t.category === TicketCategory.GENERAL);
    const freeTickets = processedTickets.filter(t => t.category === TicketCategory.FREE);
    
    // Build response
    const response: any = {
      clubId: club.id,
      date: dateISO,
      dateHasEvent,
      event: event ? {
        id: event.id,
        name: event.name,
        availableDate: safeDateToString(event.availableDate),
        bannerUrl: event.bannerUrl
      } : null,
      eventTickets,
      generalTickets,
      freeTickets
    };
    
    res.json(response);
    
  } catch (error) {
    console.error("❌ Error fetching available tickets for date:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// ✅ GET ALL TICKETS FOR CLUB (FOR CALENDAR COLORING)
export async function getAllTicketsForClubCalendar(req: Request, res: Response): Promise<void> {
  try {
    const { clubId } = req.params;
    
    // Validate clubId
    if (!clubId || typeof clubId !== 'string') {
      res.status(400).json({ error: "clubId inválido" });
      return;
    }

    const ticketRepo = AppDataSource.getRepository(Ticket);
    const clubRepo = AppDataSource.getRepository(Club);

    // Check if club exists and is active
    const club = await clubRepo.findOne({ 
      where: { id: clubId, isActive: true, isDeleted: false } 
    });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado o inactivo" });
      return;
    }

    // Get ALL tickets for the club (including free tickets that might be hidden)
    // This is specifically for calendar coloring, not for display
    const tickets = await ticketRepo.find({
      where: {
        clubId: club.id,
        isDeleted: false,
        isActive: true
      },
      select: ['id', 'category', 'availableDate', 'quantity', 'isActive'],
      order: { priority: "ASC" }
    });

    // Return minimal data needed for calendar coloring
    const calendarTickets = tickets.map(ticket => ({
      id: ticket.id,
      category: ticket.category,
      availableDate: ticket.availableDate,
      quantity: ticket.quantity,
      isActive: ticket.isActive
    }));

    res.json({ tickets: calendarTickets });
    
  } catch (error) {
    console.error("❌ Error fetching tickets for calendar:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
