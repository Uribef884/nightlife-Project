import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Club } from "../entities/Club";
import { User } from "../entities/User";
import { AuthenticatedRequest } from "../types/express"; 
import { TicketPurchase } from "../entities/TicketPurchase";
import { MenuPurchase } from "../entities/MenuPurchase";
import { validateImageUrlWithResponse } from "../utils/validateImageUrl";
import { sanitizeInput, sanitizeObject } from "../utils/sanitizeInput";
import { cleanupClubS3Files } from "../utils/s3Cleanup";
import { AuthInputSanitizer } from "../utils/authInputSanitizer";
import { secureQuery, createQueryContext } from "../utils/secureQuery";

// CREATE CLUB
export async function createClub(req: AuthenticatedRequest, res: Response): Promise<void> {
  const repo = AppDataSource.getRepository(Club);
  const userRepo = AppDataSource.getRepository(User);

  // Sanitize all string inputs (without maxLength to allow validation to catch limits)
  const sanitizedBody = sanitizeObject(req.body, [
    'name', 'description', 'address', 'city', 'googleMaps', 
    'musicType', 'instagram', 'whatsapp', 'dressCode', 
    'extraInfo', 'profileImageUrl', 'profileImageBlurhash'
  ]);

  const {
    name,
    description,
    address,
    city,
    googleMaps,
    musicType,
    instagram,
    whatsapp,
    openHours,
    openDays,
    dressCode,
    minimumAge,
    extraInfo,
    priority,
    profileImageUrl,
    profileImageBlurhash,
    latitude,
    longitude,
    ownerId,
  } = sanitizedBody;

  // Validate image URLs
  if (profileImageUrl && !validateImageUrlWithResponse(profileImageUrl, res)) {
    return;
  }

  // Validate character limits
  if (description && description.length > 1000) {
    res.status(400).json({ error: "Descripción no puede exceder 1000 caracteres" });
    return;
  }
  if (dressCode && dressCode.length > 500) {
    res.status(400).json({ error: "Código de vestimenta no puede exceder 500 caracteres" });
    return;
  }
  if (extraInfo && extraInfo.length > 500) {
    res.status(400).json({ error: "Información adicional no puede exceder 500 caracteres" });
    return;
  }

  const admin = req.user;
  if (!admin || admin.role !== "admin") {
    res.status(403).json({ error: "Prohibido: Solo los administradores pueden crear clubs" });
    return;
  }

  if (!ownerId || typeof ownerId !== "string" || ownerId.trim() === "") {
    res.status(400).json({ error: "Falta o campo ownerId inválido" });
    return;
  }

  // --- VALIDATION FOR openDays and openHours ---
  if (!Array.isArray(openDays) || openDays.length === 0) {
    res.status(400).json({ error: "openDays debe ser un array no vacío de días" });
    return;
  }
  if (!Array.isArray(openHours)) {
    res.status(400).json({ error: "openHours debe ser un array de objetos { day, open, close }" });
    return;
  }
  const openDaysSet = new Set(openDays);
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  for (const entry of openHours) {
    if (!entry.day || !openDaysSet.has(entry.day)) {
      res.status(400).json({ error: `El día '${entry.day}' no está en openDays` });
      return;
    }
    if (!timeRegex.test(entry.open) || !timeRegex.test(entry.close)) {
      res.status(400).json({ error: `Formato de tiempo inválido para el día '${entry.day}'. Use 24-hour HH:MM format.` });
      return;
    }
  }
  // Check that every day in openDays has a corresponding entry in openHours
  const openHoursDays = new Set(openHours.map(h => h.day));
  for (const day of openDays) {
    if (!openHoursDays.has(day)) {
      res.status(400).json({ error: `El día '${day}' en openDays no tiene una entrada correspondiente en openHours` });
      return;
    }
  }
  // --- END VALIDATION ---

  const owner = await userRepo.findOneBy({ id: ownerId });
  if (!owner) {
    res.status(404).json({ error: "Usuario con el ownerId proporcionado no encontrado" });
    return;
  }

  // Check if the user is already an owner of another club
  const existingClub = await repo.findOne({ where: { ownerId } });
  if (existingClub) {
    res.status(400).json({ error: "Usuario ya es propietario de otro club" });
    return;
  }

  const club = repo.create({
    name,
    description,
    address,
    city,
    googleMaps,
    musicType,
    instagram,
    whatsapp,
    openHours,
    openDays,
    dressCode,
    minimumAge,
    extraInfo,
    priority: priority && priority >= 1 ? priority : 1,
    profileImageUrl,
    profileImageBlurhash,
    latitude,
    longitude,
    owner,
    ownerId: owner.id,
  });

  await repo.save(club);

  // Update user's role and clubId
  if (owner.role === "user") {
    owner.role = "clubowner";
  }
  owner.clubId = club.id;
  await userRepo.save(owner);

  res.status(201).json(club);
}

// UPDATE CLUB (ADMIN ONLY)
export async function updateClub(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Club);
    const userRepo = AppDataSource.getRepository(User);
    const { id } = req.params;
    const user = req.user;

    // Admin only
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Prohibido: Solo los administradores pueden actualizar clubs" });
      return;
    }

    const club = await repo.findOne({ where: { id }, relations: ["owner"] });
    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    // Sanitize all string inputs (without maxLength to allow validation to catch limits)
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description', 'address', 'city', 'googleMaps', 
      'musicType', 'instagram', 'whatsapp', 'dressCode', 
      'extraInfo', 'profileImageUrl', 'profileImageBlurhash', 'pdfMenuUrl'
    ]);

    // --- VALIDATION FOR openDays and openHours (if present in update) ---
    const { openDays, openHours, ownerId, profileImageUrl, pdfMenuUrl } = sanitizedBody;

    // Validate character limits
    if (sanitizedBody.description && sanitizedBody.description.length > 1000) {
      res.status(400).json({ error: "Descripción no puede exceder 1000 caracteres" });
      return;
    }
    if (sanitizedBody.dressCode && sanitizedBody.dressCode.length > 500) {
      res.status(400).json({ error: "Código de vestimenta no puede exceder 500 caracteres" });
      return;
    }
    if (sanitizedBody.extraInfo && sanitizedBody.extraInfo.length > 500) {
      res.status(400).json({ error: "Información adicional no puede exceder 500 caracteres" });
      return;
    }

    // Validate image URLs
    if (profileImageUrl && !validateImageUrlWithResponse(profileImageUrl, res)) {
      return;
    }
    if (pdfMenuUrl && !validateImageUrlWithResponse(pdfMenuUrl, res)) {
      return;
    }
    if (openDays !== undefined) {
      if (!Array.isArray(openDays) || openDays.length === 0) {
        res.status(400).json({ error: "openDays debe ser un array no vacío de días" });
        return;
      }
    }
    if (openHours !== undefined) {
      if (!Array.isArray(openHours)) {
        res.status(400).json({ error: "openHours debe ser un array de objetos { day, open, close }" });
        return;
      }
      const daysSet = new Set(openDays !== undefined ? openDays : club.openDays);
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      for (const entry of openHours) {
        if (!entry.day || !daysSet.has(entry.day)) {
          res.status(400).json({ error: `Open hour day '${entry.day}' is not in openDays` });
          return;
        }
        if (!timeRegex.test(entry.open) || !timeRegex.test(entry.close)) {
          res.status(400).json({ error: `Formato de tiempo inválido para el día '${entry.day}'. Use 24-hour HH:MM format.` });
          return;
        }
      }
      // Check that every day in openDays has a corresponding entry in openHours
      const openHoursDays = new Set(openHours.map(h => h.day));
      const daysToCheck = openDays !== undefined ? openDays : club.openDays;
      for (const day of daysToCheck) {
        if (!openHoursDays.has(day)) {
          res.status(400).json({ error: `El día '${day}' en openDays no tiene una entrada correspondiente en openHours` });
          return;
        }
      }
    }
    // --- END VALIDATION ---

    // Handle owner change if provided
    if (ownerId !== undefined && ownerId !== club.ownerId) {
      // Validate new owner
      if (!ownerId || typeof ownerId !== "string" || ownerId.trim() === "") {
        res.status(400).json({ error: "ownerId inválido proporcionado" });
        return;
      }

      const newOwner = await userRepo.findOneBy({ id: ownerId });
      if (!newOwner) {
        res.status(404).json({ error: "Nuevo usuario propietario no encontrado" });
        return;
      }

      // Check if new owner is already an owner of another club
      const existingClub = await repo.findOne({ where: { ownerId } });
      if (existingClub && existingClub.id !== club.id) {
        res.status(400).json({ error: "Nuevo propietario ya es propietario de otro club" });
        return;
      }

      // Update old owner's clubId and role
      const oldOwner = club.owner;
      if (oldOwner) {
        // Use raw SQL to ensure NULL is set in database
        await userRepo.query('UPDATE "user" SET "clubId" = NULL WHERE id = $1', [oldOwner.id]);
        
        // Only demote to user if they don't have other roles (like admin)
        if (oldOwner.role === "clubowner") {
          oldOwner.role = "user";
          await userRepo.save(oldOwner);
        }
      }

      // Update new owner's clubId and role
      newOwner.clubId = club.id;
      if (newOwner.role === "user") {
        newOwner.role = "clubowner";
      }
      await userRepo.save(newOwner);

      // Update club's owner
      club.owner = newOwner;
      club.ownerId = newOwner.id;
    }

    const { priority, ...allowedUpdates } = req.body;

    if (priority && priority < 1) {
      allowedUpdates.priority = 1;
    } else if (priority) {
      allowedUpdates.priority = priority;
    }

    // Remove ownerId from allowedUpdates since we handle it separately
    delete allowedUpdates.ownerId;

    repo.merge(club, allowedUpdates);
    const updated = await repo.save(club);
    res.json(updated);
  } catch (error) {
    console.error("❌ Error updating club:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// UPDATE MY CLUB (CLUB OWNER ONLY)
export async function updateMyClub(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Club);
    const user = req.user;

    // Club owner only
    if (!user || user.role !== "clubowner") {
      res.status(403).json({ error: "Prohibido: Solo los propietarios de club pueden actualizar sus clubs" });
      return;
    }

    if (!user.clubId) {
      res.status(400).json({ error: "No hay club asociado con este usuario" });
      return;
    }

    const club = await repo.findOne({ 
      where: { id: user.clubId, isActive: true, isDeleted: false }, 
      relations: ["owner"] 
    });
    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    // Sanitize all string inputs (without maxLength to allow validation to catch limits)
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description', 'address', 'city', 'googleMaps', 
      'musicType', 'instagram', 'whatsapp', 'dressCode', 
      'extraInfo', 'profileImageUrl', 'profileImageBlurhash', 'pdfMenuUrl'
    ]);

    // --- VALIDATION FOR openDays and openHours (if present in update) ---
    const { openDays, openHours, ownerId, profileImageUrl, pdfMenuUrl, ...allowedUpdates } = sanitizedBody;
    
    // Prevent club owners from updating ownerId
    if (ownerId !== undefined) {
      res.status(403).json({ error: "Prohibido: Los propietarios de club no pueden actualizar el campo ownerId" });
      return;
    }

    // Validate character limits
    if (sanitizedBody.description && sanitizedBody.description.length > 1000) {
      res.status(400).json({ error: "Descripción no puede exceder 1000 caracteres" });
      return;
    }
    if (sanitizedBody.dressCode && sanitizedBody.dressCode.length > 500) {
      res.status(400).json({ error: "Código de vestimenta no puede exceder 500 caracteres" });
      return;
    }
    if (sanitizedBody.extraInfo && sanitizedBody.extraInfo.length > 500) {
      res.status(400).json({ error: "Información adicional no puede exceder 500 caracteres" });
      return;
    }

    // Validate image URLs
    if (profileImageUrl && !validateImageUrlWithResponse(profileImageUrl, res)) {
      return;
    }
    if (pdfMenuUrl && !validateImageUrlWithResponse(pdfMenuUrl, res)) {
      return;
    }

    if (openDays !== undefined) {
      if (!Array.isArray(openDays) || openDays.length === 0) {
        res.status(400).json({ error: "openDays debe ser un array no vacío de días" });
        return;
      }
    }
    if (openHours !== undefined) {
      if (!Array.isArray(openHours)) {
        res.status(400).json({ error: "openHours debe ser un array de objetos { day, open, close }" });
        return;
      }
      const daysSet = new Set(openDays !== undefined ? openDays : club.openDays);
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      for (const entry of openHours) {
        if (!entry.day || !daysSet.has(entry.day)) {
          res.status(400).json({ error: `El día '${entry.day}' no está en openDays` });
          return;
        }
        if (!timeRegex.test(entry.open) || !timeRegex.test(entry.close)) {
          res.status(400).json({ error: `Formato de tiempo inválido para el día '${entry.day}'. Use 24-hour HH:MM format.` });
          return;
        }
      }
      // Check that every day in openDays has a corresponding entry in openHours
      const openHoursDays = new Set(openHours.map(h => h.day));
      const daysToCheck = openDays !== undefined ? openDays : club.openDays;
      for (const day of daysToCheck) {
        if (!openHoursDays.has(day)) {
          res.status(400).json({ error: `El día '${day}' en openDays no tiene una entrada correspondiente en openHours` });
          return;
        }
      }
    }
    // --- END VALIDATION ---

    const { priority, ...updateData } = allowedUpdates;

    if (priority && priority < 1) {
      updateData.priority = 1;
    } else if (priority) {
      updateData.priority = priority;
    }

    repo.merge(club, updateData);
    const updated = await repo.save(club);
    res.json(updated);
  } catch (error) {
    console.error("❌ Error updating my club:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// DELETE CLUB
export async function deleteClub(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Club);
    const { id } = req.params;
    const user = req.user;

    const club = await repo.findOne({
      where: { id },
      relations: ["owner"]
    });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    const isAdmin = user?.role === "admin";
    const isOwner = user?.role === "clubowner" && club.ownerId === user.id;

    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: "No estás autorizado para eliminar este club" });
      return;
    }

    // Check if club has any related purchases
    const ticketPurchaseRepo = AppDataSource.getRepository(TicketPurchase);
    const menuPurchaseRepo = AppDataSource.getRepository(MenuPurchase);
    
    // Check for ticket purchases
    const ticketPurchaseCount = await ticketPurchaseRepo.count({
      where: { clubId: id }
    });
    
    // Check for menu purchases
    const menuPurchaseCount = await menuPurchaseRepo.count({
      where: { clubId: id }
    });
    
    const hasPurchases = ticketPurchaseCount > 0 || menuPurchaseCount > 0;

    if (hasPurchases) {
      // Soft delete - mark as deleted but keep the record
      club.isDeleted = true;
      club.deletedAt = new Date();
      club.isActive = false; // Also deactivate to prevent new usage
      await repo.save(club);

      // Clean up S3 files even for soft delete (since they're no longer needed)
      const s3CleanupResult = await cleanupClubS3Files(club);

      res.json({ 
        message: "Club eliminado suavemente exitosamente", 
        deletedAt: club.deletedAt,
        ticketPurchaseCount,
        menuPurchaseCount,
        s3CleanupResult,
        note: "Club marked as deleted but preserved due to existing purchases. S3 files have been cleaned up."
      });
    } else {
      // Hard delete - no associated purchases, safe to completely remove
      // Clean up S3 files
      const s3CleanupResult = await cleanupClubS3Files(club);
      
      await repo.remove(club);
      res.json({ 
        message: "Club eliminado permanentemente exitosamente",
        s3CleanupResult,
        note: "No associated purchases found, club completely removed. S3 files have been cleaned up."
      });
    }
  } catch (error) {
    console.error("❌ Error deleting club:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getAllClubs(req: Request, res: Response): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Club);
    const clubs = await repo.find({
      where: { isActive: true, isDeleted: false },
      order: { priority: "ASC" }
    });

    const publicClubs = clubs.map(club => ({
      id: club.id,
      name: club.name,
      description: club.description,
      address: club.address,
      city: club.city,
      googleMaps: club.googleMaps,
      latitude: club.latitude,
      longitude: club.longitude,
      musicType: club.musicType,
      instagram: club.instagram,
      whatsapp: club.whatsapp,
      openHours: club.openHours,
      openDays: club.openDays,
      dressCode: club.dressCode,
      minimumAge: club.minimumAge,
      extraInfo: club.extraInfo,
      profileImageUrl: club.profileImageUrl,
      profileImageBlurhash: club.profileImageBlurhash,
      priority: club.priority,
      menuType: club.menuType,
      pdfMenuUrl: club.pdfMenuUrl,
      pdfMenuName: club.pdfMenuName,
    }));

    res.json(publicClubs);
  } catch (error) {
    console.error("❌ Error fetching clubs:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

export async function getClubById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = req.user;
    const repo = AppDataSource.getRepository(Club);

    const club = await repo.findOne({ 
      where: { id, isActive: true, isDeleted: false }, 
      relations: ["owner"] 
    });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    const isAdmin = user?.role === "admin";
    const isOwner = user?.role === "clubowner" && user.id === club.ownerId;
    const isBouncer = user?.role === "bouncer";

    if (isAdmin || isOwner) {
      res.status(200).json(club); // return full object
    } else {
      // return public view
      const publicFields = {
        id: club.id,
        name: club.name,
        description: club.description,
        address: club.address,
        city: club.city,
        googleMaps: club.googleMaps,
        latitude: club.latitude,
        longitude: club.longitude,
        musicType: club.musicType,
        instagram: club.instagram,
        whatsapp: club.whatsapp,
        openHours: club.openHours,
        openDays: club.openDays,
        dressCode: club.dressCode,
        minimumAge: club.minimumAge,
        extraInfo: club.extraInfo,
        profileImageUrl: club.profileImageUrl,
        profileImageBlurhash: club.profileImageBlurhash,
        priority: club.priority,
        menuType: club.menuType,
        pdfMenuUrl: club.pdfMenuUrl,
        pdfMenuName: club.pdfMenuName,
      };
      res.status(200).json(publicFields);
    }
  } catch (error) {
    console.error("❌ Error fetching club:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

const ALLOWED_MUSIC_TYPES = ["Electronic", "Techno", "Reggaeton", "Crossover", "Salsa", "Pop"];
const ALLOWED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function coerceToStringArray(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map(String).map(s => s.trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export async function getFilteredClubs(req: Request, res: Response): Promise<void> {
  try {
    // Enhanced input validation and sanitization for search
    const { query, city, musicType, openDays } = req.query;
    
    // Sanitize search query
    let sanitizedQuery: string | undefined;
    if (query && typeof query === "string") {
      const queryValidation = AuthInputSanitizer.sanitizeSearchQuery(query);
      if (!queryValidation.isValid) {
        res.status(400).json({ 
          error: "Invalid search query",
          details: queryValidation.error
        });
        return;
      }
      sanitizedQuery = queryValidation.sanitizedValue;
    }

    // Sanitize city parameter
    let sanitizedCity: string | undefined;
    if (city && typeof city === "string") {
      const cityValidation = AuthInputSanitizer.sanitizeSearchQuery(city);
      if (!cityValidation.isValid) {
        res.status(400).json({ 
          error: "Invalid city parameter",
          details: cityValidation.error
        });
        return;
      }
      sanitizedCity = cityValidation.sanitizedValue;
    }

    // Use secure query with monitoring
    const repo = secureQuery.getRepository(Club);
    const context = createQueryContext('search_clubs', (req as any).user?.id, (req as any).sessionId);

    // Build where conditions properly for TypeORM
    const whereConditions: any = {
      isActive: true,
      isDeleted: false
    };

    if (sanitizedCity) {
      whereConditions.city = sanitizedCity;
    }

    const clubs = await secureQuery.find(repo, {
      where: whereConditions
    }, context);

    // Apply additional filters
    let filteredClubs = clubs;

    // Music type filter
    if (musicType) {
      const musicArray = Array.isArray(musicType) ? musicType : [musicType];
      const validMusic = musicArray
        .filter(type => typeof type === 'string' && ALLOWED_MUSIC_TYPES.includes(type))
        .map(type => type as string);
      if (validMusic.length > 0) {
        filteredClubs = filteredClubs.filter(club => 
          validMusic.some(type => club.musicType.includes(type))
        );
      }
    }

    // Open days filter
    if (openDays) {
      const daysArray = Array.isArray(openDays) ? openDays : [openDays];
      const validDays = daysArray
        .filter(day => typeof day === 'string' && ALLOWED_DAYS.includes(day))
        .map(day => day as string);
      if (validDays.length > 0) {
        filteredClubs = filteredClubs.filter(club => 
          validDays.some(day => club.openDays.includes(day))
        );
      }
    }

    // Apply text search filtering if query provided
    if (sanitizedQuery) {
      const trimmed = sanitizedQuery.toLowerCase();
      filteredClubs = filteredClubs.filter(club => 
        club.name.toLowerCase().includes(trimmed) ||
        (club.description && club.description.toLowerCase().includes(trimmed)) ||
        club.address.toLowerCase().includes(trimmed) ||
        club.musicType.some(type => type.toLowerCase().includes(trimmed))
      );
    }

    // Sort by priority
    filteredClubs.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const publicClubs = filteredClubs.map(club => ({
      id: club.id,
      name: club.name,
      description: club.description,
      address: club.address,
      googleMaps: club.googleMaps,
      latitude: club.latitude,
      longitude: club.longitude,
      city: club.city,
      musicType: club.musicType,
      instagram: club.instagram,
      whatsapp: club.whatsapp,
      openHours: club.openHours,
      openDays: club.openDays,
      dressCode: club.dressCode,
      minimumAge: club.minimumAge,
      extraInfo: club.extraInfo,
      profileImageUrl: club.profileImageUrl,
      profileImageBlurhash: club.profileImageBlurhash,
      priority: club.priority,
      menuType: club.menuType,
      pdfMenuUrl: club.pdfMenuUrl,
      pdfMenuName: club.pdfMenuName,
    }));

    res.json(publicClubs);
  } catch (error) {
    console.error("❌ Error filtering clubs:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

// GET CITIES
export async function getCities(req: Request, res: Response): Promise<void> {
  try {
    const repo = AppDataSource.getRepository(Club);
    
    // Get all unique cities from active, non-deleted clubs
    const cities = await repo
      .createQueryBuilder("club")
      .select("DISTINCT club.city", "city")
      .where("club.isActive = :isActive", { isActive: true })
      .andWhere("club.isDeleted = :isDeleted", { isDeleted: false })
      .orderBy("club.city", "ASC")
      .getRawMany();
    
    // Extract city names from the result
    const cityNames = cities.map(cityObj => cityObj.city);
    
    res.json(cityNames);
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({ error: "Error al obtener ciudades" });
  }
}