import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Event } from "../entities/Event";
import { AuthenticatedRequest } from "../types/express";
import { Ticket } from "../entities/Ticket";
import { TicketIncludedMenuItem } from "../entities/TicketIncludedMenuItem";
import { computeDynamicPrice, computeDynamicEventPrice, getEventTicketDynamicPricingReason } from "../utils/dynamicPricing";
import { validateImageUrlWithResponse } from "../utils/validateImageUrl";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput";
import { MoreThanOrEqual } from "typeorm";
import { cleanupEventAndTicketAds } from "../utils/cleanupAds";
import { cleanupEventS3Files } from "../utils/s3Cleanup";

// Utility function to get today's date in a timezone-safe way
const getTodayDate = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// GET /events — public
export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const eventRepo = AppDataSource.getRepository(Event);
    const events = await eventRepo.find({ 
      where: { isActive: true, isDeleted: false, availableDate: MoreThanOrEqual(getTodayDate()) },
      relations: ["club"],
      order: { availableDate: "DESC", createdAt: "DESC" }
    });
    res.status(200).json(events);
  } catch (err) {
    console.error("❌ Failed to fetch all events:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /events/:id — public
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const eventRepo = AppDataSource.getRepository(Event);
    
    const event = await eventRepo.findOne({
      where: { id, isActive: true, isDeleted: false },
      relations: ["club", "tickets"]
    });

    if (!event) {
      res.status(404).json({ error: "Evento no encontrado" });
      return;
    }

    // Apply dynamic pricing to event tickets if they exist
    if (event.tickets && event.tickets.length > 0) {
      const { computeDynamicEventPrice } = await import("../utils/dynamicPricing");
      const ticketsWithDynamic = await Promise.all(event.tickets.map(async ticket => {
        let dynamicPrice = ticket.price;
        
        if (ticket.dynamicPricingEnabled && event.club) {
          // Use dedicated event function instead of deprecated computeDynamicPrice
          dynamicPrice = computeDynamicEventPrice(
            Number(ticket.price),
            event.availableDate,
            event.openHours,
            { isFree: Number(ticket.price) === 0 }
          );
        }
        
        return {
          ...ticket,
          dynamicPrice,
        };
      }));
      
      event.tickets = ticketsWithDynamic;
    }

    res.status(200).json(event);
  } catch (err) {
    console.error("❌ Failed to fetch event by ID:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /events/club/:clubId — public
export const getEventsByClubId = async (req: Request, res: Response) => {
  try {
    const { clubId } = req.params;
    const { includeHidden } = req.query;
    const eventRepo = AppDataSource.getRepository(Event);
    const ticketIncludedMenuRepo = AppDataSource.getRepository(TicketIncludedMenuItem);
    
    // Build where clause based on includeHidden parameter
    let whereClause: any = { clubId, isDeleted: false };
    
    // Only include active events unless includeHidden=true
    if (includeHidden !== 'true') {
      whereClause.isActive = true;
      whereClause.availableDate = MoreThanOrEqual(getTodayDate());
      console.log('🔍 Filtering events: Active events from today onwards');
    } else {
      console.log('🔍 Filtering events: All events (past and future) - includeHidden=true');
    }
    // If includeHidden=true, include all events (past and future) regardless of isActive status
    
    const events = await eventRepo.find({
      where: whereClause,
      relations: ["club", "tickets"],
      order: { availableDate: "DESC", createdAt: "DESC" }
    });
    
    console.log(`📊 Found ${events.length} events for club ${clubId} (includeHidden: ${includeHidden})`);
    
    // Apply dynamic pricing to event tickets and fetch included menu items
    const eventsWithDynamicPricing = await Promise.all(events.map(async event => {
      if (event.tickets && event.tickets.length > 0) {
        const ticketsWithDynamic = await Promise.all(event.tickets.map(async ticket => {
          let dynamicPrice = ticket.price;
          if (ticket.dynamicPricingEnabled && event.club) {
            // For events, we want to use the event's date and open hours
            // The event date + open hours becomes our "open time" reference
            if (event.openHours && event.openHours.open && event.openHours.close) {
              // Create a date object for when the event opens
              // Parse the event date properly to avoid timezone issues
              let eventDate: Date;
              
              // Handle availableDate which can be Date or string from database
              if (event.availableDate instanceof Date) {
                eventDate = new Date(event.availableDate);
              } else if (typeof event.availableDate === 'string') {
                // If it's a date string like "2025-07-25", parse it as local date
                const dateStr = event.availableDate as string;
                const [year, month, day] = dateStr.split('-').map(Number);
                eventDate = new Date(year, month - 1, day); // month is 0-indexed
              } else {
                // Fallback
                eventDate = new Date(event.availableDate);
              }
              
              // Use the exact same logic as the frontend (ticket controller)
              dynamicPrice = computeDynamicEventPrice(Number(ticket.price), new Date(event.availableDate), event.openHours);
              
              // Check if event has passed grace period
              if (dynamicPrice === -1) {
                // For event display, we'll show the ticket as unavailable instead of blocking
                dynamicPrice = 0; // Set to 0 to indicate unavailable
              }
            } else {
              // Fallback to club's open hours if event doesn't have specific hours
              dynamicPrice = computeDynamicEventPrice(Number(ticket.price), new Date(event.availableDate), event.openHours);
              
              // Check if event has passed grace period
              if (dynamicPrice === -1) {
                // For event display, we'll show the ticket as unavailable instead of blocking
                dynamicPrice = 0; // Set to 0 to indicate unavailable
              }
            }
          } else if (ticket.category === "event") {
            // Grace period check for event tickets when dynamic pricing is disabled
            if (event.openHours && event.openHours.open && event.openHours.close) {
              const gracePeriodCheck = computeDynamicEventPrice(Number(ticket.price), new Date(event.availableDate), event.openHours);
              if (gracePeriodCheck === -1) {
                // For event display, we'll show the ticket as unavailable instead of blocking
                dynamicPrice = 0; // Set to 0 to indicate unavailable
              } else if (gracePeriodCheck > Number(ticket.price)) {
                // If grace period price is higher than base price, use grace period price
                dynamicPrice = gracePeriodCheck;
              }
            } else {
              const gracePeriodCheck = computeDynamicEventPrice(Number(ticket.price), new Date(event.availableDate), event.openHours);
              if (gracePeriodCheck === -1) {
                // For event display, we'll show the ticket as unavailable instead of blocking
                dynamicPrice = 0; // Set to 0 to indicate unavailable
              } else if (gracePeriodCheck > Number(ticket.price)) {
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
          
          if (ticket.includesMenuItem) {
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
            ...ticket,
            dynamicPrice,
            includedMenuItems,
          };
        }));
        return {
          ...event,
          tickets: ticketsWithDynamic,
        };
      }
      return event;
    }));
    
    res.status(200).json(eventsWithDynamicPricing);
  } catch (err) {
    console.error("❌ Failed to fetch events by club:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// GET /events/my-club — club owner only
export const getMyClubEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only club owners can access their club's events
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los propietarios de club pueden acceder a los eventos de su club" });
      return;
    }

    // For non-admin users, they must have a clubId
    if (user.role !== "admin" && !user.clubId) {
      res.status(400).json({ error: "Usuario no asociado con ningún club" });
      return;
    }

    // Verify the user owns this active club
    if (user.role !== "admin" && user.clubId && !user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    const clubId = user.clubId!;
    const eventRepo = AppDataSource.getRepository(Event);
    
    const events = await eventRepo.find({
      where: { clubId },
      relations: ["club", "tickets"],
      order: { availableDate: "DESC", createdAt: "DESC" }
    });

    // Add some useful metadata for each event
    const enrichedEvents = events.map(event => ({
      ...event,
      ticketCount: event.tickets?.length || 0,
      hasActiveTickets: event.tickets?.some(ticket => ticket.isActive) || false
    }));

    res.status(200).json(enrichedEvents);
  } catch (err) {
    console.error("❌ Failed to fetch club events:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// POST /events — clubOwner only
export const createEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description'
    ], { maxLength: 1000 });
    
    const { name, description, availableDate, openHours } = sanitizedBody;
    const user = req.user;

    if (!user || !user.clubId) {
      res.status(403).json({ error: "Prohibido: No hay clubId asociado" });
      return;
    }

    // Verify the user owns this active club
    if (!user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    if (!name || !availableDate || !openHours) {
      res.status(400).json({ error: "Faltan campos requeridos: name, availableDate, o openHours" });
      return;
    }

    // Validate image
    if (!req.file) {
      res.status(400).json({ error: "Archivo de imagen requerido." });
      return;
    }

    // Parse and validate openHours (required)
    let parsedOpenHours = null;
    if (typeof openHours === 'string') {
      try {
        parsedOpenHours = JSON.parse(openHours);
      } catch (error) {
        res.status(400).json({ error: "Formato de openHours inválido. Debe ser JSON válido." });
        return;
      }
    } else if (typeof openHours === 'object') {
      parsedOpenHours = openHours;
    } else {
      res.status(400).json({ error: "openHours es requerido y debe ser proporcionado" });
      return;
    }

    // Validate openHours format
    if (!parsedOpenHours.open || !parsedOpenHours.close) {
      res.status(400).json({ error: "openHours debe tener las propiedades 'open' y 'close'" });
      return;
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(parsedOpenHours.open) || !timeRegex.test(parsedOpenHours.close)) {
      res.status(400).json({ error: "El formato de tiempo debe ser HH:MM (e.g., '22:00', '02:00')" });
      return;
    }

    // 🔒 Normalize date using same pattern as checkout.ts
    const raw = typeof availableDate === "string" ? availableDate.split("T")[0] : availableDate;
    const [year, month, day] = raw.split("-").map(Number);

    if (!year || !month || !day) {
      res.status(400).json({ error: "Formato de availableDate inválido" });
      return;
    }

    const normalizedDate = new Date(year, month - 1, day);
    normalizedDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (normalizedDate < today) {
      res.status(400).json({ error: "La fecha del evento no puede ser en el pasado" });
      return;
    }

    // Process image
    const processed = await (await import("../services/imageService")).ImageService.processImage(req.file.buffer);

    const eventRepo = AppDataSource.getRepository(Event);
    
    // 🔒 Check if event already exists for this date and club
    const existingEvent = await eventRepo.findOne({
      where: { 
        clubId: user.clubId, 
        availableDate: normalizedDate,
        isActive: true,
        isDeleted: false
      }
    });

    if (existingEvent) {
      res.status(400).json({ 
        error: `Un evento ya existe para ${normalizedDate.toISOString().split('T')[0]}. Solo se permite un evento por fecha.` 
      });
      return;
    }

    const newEvent = eventRepo.create({
      name: name.trim(),
      description: description?.trim() || null,
      availableDate: normalizedDate,
      openHours: parsedOpenHours,
      bannerUrl: "", // will be set after upload
      BannerURLBlurHash: processed.blurhash,
      clubId: user.clubId,
    });

    await eventRepo.save(newEvent);

    // Upload image to S3
    const { S3Service } = await import("../services/s3Service");
    const key = S3Service.generateKey(user.clubId, 'event-banner', `${newEvent.id}-${Date.now()}`);
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);
    
    // Update event with banner URL
    newEvent.bannerUrl = uploadResult.url;
    await eventRepo.save(newEvent);

    res.status(201).json(newEvent);
  } catch (err) {
    console.error("❌ Failed to create event:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// DELETE /events/:id — clubOwner only
export const deleteEvent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventId = req.params.id;
    const user = req.user;

    if (!user || !user.clubId) {
      res.status(403).json({ error: "Prohibido: No hay clubId asociado" });
      return;
    }

    // Verify the user owns this active club
    if (!user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ 
      where: { id: eventId },
      relations: ["tickets"]
    });

    if (!event) {
      res.status(404).json({ error: "Evento no encontrado" });
      return;
    }

    if (event.clubId !== user.clubId) {
      res.status(403).json({ error: "Prohibido: No puedes eliminar eventos de otro club" });
      return;
    }

    // Check if event has purchased tickets
    let hasPurchases = false;
    let ticketIds: string[] = [];
    if (event.tickets && event.tickets.length > 0) {
      const { TicketPurchase } = await import("../entities/TicketPurchase");
      const purchaseRepo = AppDataSource.getRepository(TicketPurchase);
      ticketIds = event.tickets.map(ticket => ticket.id);
      const existingPurchases = await purchaseRepo
        .createQueryBuilder("purchase")
        .where("purchase.ticketId IN (:...ticketIds)", { ticketIds })
        .getCount();
      hasPurchases = existingPurchases > 0;
    }

    const ticketRepo = AppDataSource.getRepository(Ticket);

    // Clean up all associated ads (event ads + ticket ads)
    const adCleanupResult = await cleanupEventAndTicketAds(eventId, ticketIds);

    if (hasPurchases) {
      // Soft delete event
      event.isDeleted = true;
      event.deletedAt = new Date();
      event.isActive = false;
      await eventRepo.save(event);
      
      // Soft delete all related tickets
      if (event.tickets && event.tickets.length > 0) {
        for (const ticket of event.tickets) {
          ticket.isDeleted = true;
          ticket.deletedAt = new Date();
          ticket.isActive = false;
          await ticketRepo.save(ticket);
        }
      }
      
      // Clean up S3 banner even for soft delete (since it's no longer needed)
      const s3CleanupResult = await cleanupEventS3Files(event);
      
      res.status(200).json({ 
        message: "Evento y tickets relacionados eliminados suavemente debido a la existencia de compras",
        adCleanupResult,
        s3CleanupResult,
        note: "Associated ads have been automatically deactivated. S3 banner has been cleaned up."
      });
      return;
    }

    // Hard delete (no purchases)
    // Clean up S3 banner
    const s3CleanupResult = await cleanupEventS3Files(event);
    
    await eventRepo.remove(event);

    res.status(200).json({ 
      message: "Evento y tickets asociados eliminados exitosamente",
      adCleanupResult,
      s3CleanupResult,
      note: "Associated ads have been automatically deactivated. S3 banner has been cleaned up."
    });
  } catch (err) {
    console.error("❌ Failed to delete event:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /events/:id — update name and description
export const updateEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description', 'bannerUrl'
    ], { maxLength: 1000 });
    
    const { name, description, availableDate, openHours, bannerUrl } = sanitizedBody;
    const user = req.user;

    // Validate image URL if provided
    if (bannerUrl && !validateImageUrlWithResponse(bannerUrl, res)) {
      return;
    }

    if (!user || !user.clubId) {
      res.status(403).json({ error: "Prohibido: No hay clubId asociado" });
      return;
    }

    // Verify the user owns this active club
    if (!user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    // Prevent changing availableDate
    if (availableDate !== undefined) {
      res.status(400).json({ error: "No se puede actualizar availableDate después de la creación" });
      return;
    }

    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ where: { id } });

    if (!event) {
      res.status(404).json({ error: "Evento no encontrado" });
      return;
    }

    if (event.clubId !== user.clubId) {
      res.status(403).json({ error: "Prohibido: No puedes actualizar eventos de otro club" });
      return;
    }

    // Parse and validate openHours if provided
    if (openHours !== undefined) {
      let parsedOpenHours = null;
      if (openHours) {
        if (typeof openHours === 'string') {
          try {
            parsedOpenHours = JSON.parse(openHours);
          } catch (error) {
            res.status(400).json({ error: "Formato de openHours inválido. Debe ser JSON válido." });
            return;
          }
        } else if (typeof openHours === 'object') {
          parsedOpenHours = openHours;
        }

        // Validate openHours format
        if (parsedOpenHours) {
          if (!parsedOpenHours.open || !parsedOpenHours.close) {
            res.status(400).json({ error: "openHours debe tener las propiedades 'open' y 'close'" });
            return;
          }

          // Validate time format (HH:MM)
          const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(parsedOpenHours.open) || !timeRegex.test(parsedOpenHours.close)) {
            res.status(400).json({ error: "El formato de tiempo debe ser HH:MM (e.g., '22:00', '02:00')" });
            return;
          }
        }
      }
      event.openHours = parsedOpenHours;
    }

    // Update fields
    if (name !== undefined) {
      event.name = name.trim();
    }
    if (description !== undefined) {
      event.description = description?.trim() || null;
    }

    await eventRepo.save(event);
    res.json(event);
  } catch (err) {
    console.error("❌ Failed to update event:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /events/:id/image — update event image
export const updateEventImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user || !user.clubId) {
      res.status(403).json({ error: "Prohibido: No hay clubId asociado" });
      return;
    }

    // Verify the user owns this active club
    if (!user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "Archivo de imagen requerido." });
      return;
    }

    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ where: { id } });

    if (!event) {
      res.status(404).json({ error: "Evento no encontrado" });
      return;
    }

    if (event.clubId !== user.clubId) {
      res.status(403).json({ error: "Prohibido: No puedes actualizar eventos de otro club" });
      return;
    }

    // Process new image
    const processed = await (await import("../services/imageService")).ImageService.processImage(req.file.buffer);

    // Store reference to old image for deletion
    const oldBannerUrl = event.bannerUrl;

    // Generate new S3 key with unique identifier
    const { S3Service } = await import("../services/s3Service");
    const key = S3Service.generateKey(user.clubId, 'event-banner', `${event.id}-${Date.now()}`);

    // Upload new image
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);

    // Update event
    event.bannerUrl = uploadResult.url;
    event.BannerURLBlurHash = processed.blurhash;
    await eventRepo.save(event);

    // Delete old image from S3 if it exists and is different
    if (oldBannerUrl && oldBannerUrl !== uploadResult.url) {
      try {
        const url = new URL(oldBannerUrl);
        const oldKey = url.pathname.substring(1);
        await S3Service.deleteFile(oldKey);
      } catch (deleteError) {
        console.error('⚠️ Warning: Failed to delete old event banner from S3:', deleteError);
        // Don't fail the request - new image is already uploaded
      }
    }

    res.json(event);
  } catch (err) {
    console.error("❌ Failed to update event image:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PUT /events/:id/toggle-visibility — toggle event visibility
export const toggleEventVisibility = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }

    if (!user.clubId) {
      res.status(403).json({ error: "Prohibido: No hay clubId asociado" });
      return;
    }

    // Verify the user owns this active club
    if (!user.clubIds?.includes(user.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }

    const { id } = req.params;
    const eventRepo = AppDataSource.getRepository(Event);
    const ticketRepo = AppDataSource.getRepository(Ticket);
    
    const event = await eventRepo.findOne({ 
      where: { id },
      relations: ["tickets"]
    });

    if (!event) {
      res.status(404).json({ error: "Evento no encontrado" });
      return;
    }

    if (event.clubId !== user.clubId) {
      res.status(403).json({ error: "No estás autorizado para modificar este evento" });
      return;
    }

    // Toggle event visibility
    event.isActive = !event.isActive;
    await eventRepo.save(event);

    // Toggle visibility for all child tickets
    if (event.tickets && event.tickets.length > 0) {
      for (const ticket of event.tickets) {
        ticket.isActive = event.isActive;
        await ticketRepo.save(ticket);
      }
    }

    res.json({ 
      message: "Evento y todos los tickets hijos visibilidad alternada", 
      isActive: event.isActive,
      ticketsUpdated: event.tickets?.length || 0
    });
  } catch (err) {
    console.error("❌ Failed to toggle event visibility:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};


