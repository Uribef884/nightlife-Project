import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Ad } from "../entities/Ad";
import { Ticket } from "../entities/Ticket";
import { Event } from "../entities/Event";
import { S3Service } from "../services/s3Service";
import { AuthenticatedRequest } from "../types/express";
import { IsNull, In } from "typeorm";
import { TicketPurchase } from "../entities/TicketPurchase";
import { validateImageUrlWithResponse } from "../utils/validateImageUrl";
import { cleanupAdS3Files } from "../utils/s3Cleanup";
import { validateExternalUrlWithResponse } from "../utils/validateExternalUrl";

function buildAdLink(ad: Ad): string | null {
  if (ad.targetType === "event" && ad.targetId) {
    return `/clubs.html?event=${ad.targetId}`;
  }
  if (ad.targetType === "ticket" && ad.targetId) {
    return `/clubs.html?ticket=${ad.targetId}`;
  }
  if (ad.targetType === "external" && ad.externalUrl) {
    return ad.externalUrl;
  }
  return null;
}

function adToResponse(ad: Ad) {
  return {
    id: ad.id,
    clubId: ad.clubId,
    imageUrl: ad.imageUrl,
    imageBlurhash: ad.imageBlurhash,
    priority: ad.priority,
    isVisible: ad.isVisible,
    targetType: ad.targetType,
    targetId: ad.targetId,
    label: ad.label, // Include the label in the response
    link: buildAdLink(ad),
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
  };
}

function validatePriority(priority: any): boolean {
  return Number.isInteger(priority) && priority >= 1;
}

function validateTargetType(type: any): boolean {
  return type === "event" || type === "ticket" || type === "external";
}

// --- CREATE ADMIN AD ---
export const createAdminAdGlobal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Only admins can create admin ads." });
      return;
    }
    const { priority, isVisible, targetType, targetId, externalUrl } = req.body;
    // Validate priority
    const prio = priority !== undefined ? parseInt(priority) : 1;
    if (!validatePriority(prio)) {
      res.status(400).json({ error: "Priority must be a positive integer (min 1)." });
      return;
    }
    // Validate target and get clubId if targeting ticket/event
    let validatedTargetId: string | null = null;
    let validatedExternalUrl: string | null = null;
    let clubId: string | undefined = undefined;
    
    if (targetType) {
      if (!validateTargetType(targetType)) {
        res.status(400).json({ error: "targetType must be 'ticket', 'event', or 'external' if provided." });
        return;
      }
      
      if (targetType === "external") {
        // External ads validation
        if (!externalUrl) {
          res.status(400).json({ error: "externalUrl is required for external ads." });
          return;
        }
        // External ads cannot have targetId
        if (targetId) {
          res.status(400).json({ error: "External ads cannot have targetId. Use externalUrl instead." });
          return;
        }
        // Validate external URL with cybersecurity checks
        if (!validateExternalUrlWithResponse(externalUrl, res)) {
          return;
        }
        validatedExternalUrl = externalUrl;
        // External ads are always global (no clubId)
        clubId = undefined;
      } else {
        // Internal ads validation (ticket/event)
        if (!targetId) {
          res.status(400).json({ error: "targetId is required for ticket/event ads." });
          return;
        }
        // Internal ads cannot have external URLs
        if (externalUrl) {
          res.status(400).json({ error: "Internal ads (ticket/event) cannot have external URLs." });
          return;
        }
        // Validate existence and get clubId
        if (targetType === "ticket") {
          const ticket = await AppDataSource.getRepository(Ticket).findOne({ where: { id: targetId } });
          if (!ticket) {
            res.status(400).json({ error: "Target ticket not found." });
            return;
          }
          clubId = ticket.clubId; // Automatically get clubId from ticket
        } else if (targetType === "event") {
          const event = await AppDataSource.getRepository(Event).findOne({ where: { id: targetId } });
          if (!event) {
            res.status(400).json({ error: "Target event not found." });
            return;
          }
          clubId = event.clubId; // Automatically get clubId from event
        }
        validatedTargetId = targetId;
      }
    }
    // Validate image
    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }
    const processed = await (await import("../services/imageService")).ImageService.processImage(req.file.buffer);
    // Create ad
    const adRepo = AppDataSource.getRepository(Ad);
    const ad = adRepo.create({
      clubId: clubId, // Use clubId if targeting ticket/event, otherwise undefined
      imageUrl: "", // will be set after upload
      imageBlurhash: processed.blurhash,
      priority: prio,
      isVisible: isVisible !== undefined ? isVisible === "true" || isVisible === true : true,
      targetType: targetType || null,
      targetId: validatedTargetId,
      externalUrl: validatedExternalUrl,
      label: "global", // Admin ads are labeled as "global"
    });
    await adRepo.save(ad);
    // Upload image
    const key = S3Service.generateAdKey(ad);
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);
    ad.imageUrl = uploadResult.url;
    await adRepo.save(ad);
    res.status(201).json(adToResponse(ad));
  } catch (error) {
    console.error("Error creating admin ad:", error);
    res.status(500).json({ error: "Failed to create admin ad." });
  }
};

// --- CREATE CLUB AD ---
export const createClubAd = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "clubowner" && req.user?.role !== "admin") {
      res.status(403).json({ error: "Only club owners and admins can create club ads." });
      return;
    }
    const { priority, isVisible, targetType, targetId, externalUrl } = req.body;
    
    // Get clubId based on user role
    let clubId: string;
    
    if (req.user?.role === "admin") {
      // For admins, use the clubId from the URL parameters
      const paramClubId = req.params.clubId;
      if (!paramClubId) {
        res.status(400).json({ error: "clubId parameter is required for admin ad creation" });
        return;
      }
      clubId = paramClubId;
    } else {
      // For club owners, use their associated clubId
      if (!req.user?.clubId) {
        res.status(400).json({ error: "No clubId found for user." });
        return;
      }
      clubId = req.user.clubId;
    }
    // Rate limiting: max 7 ads per club
    const adRepo = AppDataSource.getRepository(Ad);
    const adCount = await adRepo.count({ where: { clubId } });
    if (adCount >= 7) {
      res.status(400).json({ error: "You have reached the maximum of 7 ads for your club. Please delete an existing ad before uploading a new one." });
      return;
    }
    // Validate priority
    const prio = priority !== undefined ? parseInt(priority) : 1;
    if (!validatePriority(prio)) {
      res.status(400).json({ error: "Priority must be a positive integer (min 1)." });
      return;
    }
    // Validate target - club ads cannot be external
    let validatedTargetId: string | null = null;
    if (targetType) {
      if (targetType === "external") {
        res.status(400).json({ error: "Club ads cannot be external. Only global ads can link to external URLs." });
        return;
      }
      if (!validateTargetType(targetType)) {
        res.status(400).json({ error: "targetType must be 'ticket' or 'event' for club ads." });
        return;
      }
      if (!targetId) {
        res.status(400).json({ error: "targetId is required if targetType is provided." });
        return;
      }
      // Club ads cannot have external URLs
      if (externalUrl) {
        res.status(400).json({ error: "Club ads cannot have external URLs. Only global ads can link to external URLs." });
        return;
      }
      // Validate existence and club ownership
      if (targetType === "ticket") {
        const ticket = await AppDataSource.getRepository(Ticket).findOne({ where: { id: targetId, clubId } });
        if (!ticket) {
          res.status(400).json({ error: "Target ticket not found or not owned by your club." });
          return;
        }
      } else if (targetType === "event") {
        const event = await AppDataSource.getRepository(Event).findOne({ where: { id: targetId, clubId } });
        if (!event) {
          res.status(400).json({ error: "Target event not found or not owned by your club." });
          return;
        }
      }
      validatedTargetId = targetId;
    }
    // Validate image
    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }
    const processed = await (await import("../services/imageService")).ImageService.processImage(req.file.buffer);
    // Create ad
    const ad = adRepo.create({
      clubId,
      imageUrl: "", // will be set after upload
      imageBlurhash: processed.blurhash,
      priority: prio,
      isVisible: isVisible !== undefined ? isVisible === "true" || isVisible === true : true,
      targetType: targetType || null,
      targetId: validatedTargetId,
      externalUrl: null, // Club ads cannot have external URLs
      label: "club", // Club owner ads are labeled as "club"
    });
    await adRepo.save(ad);
    // Upload image
    const key = S3Service.generateAdKey(ad);
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);
    ad.imageUrl = uploadResult.url;
    await adRepo.save(ad);
    res.status(201).json(adToResponse(ad));
  } catch (error) {
    console.error("Error creating club ad:", error);
    res.status(500).json({ error: "Failed to create club ad." });
  }
};

// --- UPDATE AD ---
export const updateAd = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adRepo = AppDataSource.getRepository(Ad);
    const ad = await adRepo.findOne({ where: { id, isActive: true, isDeleted: false } });
    if (!ad) {
      res.status(404).json({ error: "Ad not found." });
      return;
    }
    // Permission check based on label and clubId
    if (ad.label === "global" && req.user?.role !== "admin") {
      res.status(403).json({ error: "Only admins can update global ads." });
      return;
    }
    if (ad.label === "club") {
      if (req.user?.role === "clubowner" && req.user.clubId !== ad.clubId) {
        res.status(403).json({ error: "Only the club owner can update this ad." });
        return;
      }
      if (req.user?.role !== "clubowner" && req.user?.role !== "admin") {
        res.status(403).json({ error: "Only club owners and admins can update club ads." });
        return;
      }
    }
    // Update fields
    const { priority, isVisible, targetType, targetId, externalUrl, imageUrl } = req.body;

    // Validate image URL if provided
    if (imageUrl && !validateImageUrlWithResponse(imageUrl, res)) {
      return;
    }
    if (priority !== undefined) {
      const prio = parseInt(priority);
      if (!validatePriority(prio)) {
        res.status(400).json({ error: "Priority must be a positive integer (min 1)." });
        return;
      }
      ad.priority = prio;
    }
    if (isVisible !== undefined) {
      ad.isVisible = isVisible === "true" || isVisible === true;
    }
    // Target validation - targetType, targetId, and externalUrl cannot be changed once created
    if (targetType !== undefined || targetId !== undefined || externalUrl !== undefined) {
      res.status(400).json({ 
        error: "targetType, targetId, and externalUrl cannot be modified after ad creation. Please delete the ad and create a new one if you need to change the target." 
      });
      return;
    }
    // Image update (optional)
    if (req.file) {
      const processed = await (await import("../services/imageService")).ImageService.processImage(req.file.buffer);
      const oldImageUrl = ad.imageUrl;
      const key = S3Service.generateAdKey(ad);
      const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);
      ad.imageUrl = uploadResult.url;
      ad.imageBlurhash = processed.blurhash;
      await S3Service.deleteFileByUrl(oldImageUrl, ad.imageUrl);
    }
    await adRepo.save(ad);
    res.json(adToResponse(ad));
  } catch (error) {
    console.error("Error updating ad:", error);
    res.status(500).json({ error: "Failed to update ad." });
  }
};

// DELETE /ads/:id — admin only
export const deleteAd = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adRepo = AppDataSource.getRepository(Ad);
    const purchaseRepo = AppDataSource.getRepository(TicketPurchase);

    const ad = await adRepo.findOne({ where: { id } });
    if (!ad) {
      res.status(404).json({ error: "Ad not found" });
      return;
    }

    // Check if ad has related purchases
    let hasRelatedPurchases = false;
    if (ad.targetType === "ticket" && ad.targetId) {
      const existingPurchases = await purchaseRepo.count({ where: { ticketId: ad.targetId } });
      hasRelatedPurchases = existingPurchases > 0;
    } else if (ad.targetType === "event" && ad.targetId) {
      // For events, check if any tickets have purchases
      const { Ticket } = await import("../entities/Ticket");
      const ticketRepo = AppDataSource.getRepository(Ticket);
      const eventTickets = await ticketRepo.find({ where: { eventId: ad.targetId } });
      if (eventTickets.length > 0) {
        const ticketIds = eventTickets.map(t => t.id);
        const existingPurchases = await purchaseRepo.count({ where: { ticketId: In(ticketIds) } });
        hasRelatedPurchases = existingPurchases > 0;
      }
    }

    if (hasRelatedPurchases) {
      // Soft delete - mark as deleted but keep the record
      ad.isDeleted = true;
      ad.deletedAt = new Date();
      ad.isActive = false;
      ad.isVisible = false;
      await adRepo.save(ad);
      
      // Clean up S3 image even for soft delete (since it's no longer needed)
      const s3CleanupResult = await cleanupAdS3Files(ad);
      
      res.json({ 
        message: "Ad soft deleted successfully", 
        deletedAt: ad.deletedAt,
        hasRelatedPurchases,
        s3CleanupResult,
        note: "Ad marked as deleted but preserved due to existing purchases. S3 image has been cleaned up."
      });
    } else {
      // Hard delete - no related purchases, safe to completely remove
      // Clean up S3 image
      const s3CleanupResult = await cleanupAdS3Files(ad);
      
      // Delete ad from DB
      await adRepo.remove(ad);
      res.json({ 
        message: "Ad permanently deleted successfully",
        s3CleanupResult,
        note: "No related purchases found, ad completely removed"
      });
    }
  } catch (error) {
    console.error("Error deleting ad:", error);
    res.status(500).json({ error: "Failed to delete ad." });
  }
};

// --- GET GLOBAL ADS ---
export const getGlobalAds = async (req: Request, res: Response): Promise<void> => {
  try {
    const adRepo = AppDataSource.getRepository(Ad);
    
    // Check if user is authenticated and has admin role
    const authReq = req as AuthenticatedRequest;
    const isAdmin = authReq.user?.role === "admin";
    
    let whereCondition: any = { 
      label: "global", // Use label instead of clubId check
      isDeleted: false 
    };
    
    // If not admin, only show active and visible ads
    if (!isAdmin) {
      whereCondition.isActive = true;
      whereCondition.isVisible = true;
    }
    
    const ads = await adRepo.find({ 
      where: whereCondition, 
      order: { priority: "DESC", createdAt: "DESC" } 
    });
    res.json(ads.map(adToResponse));
  } catch (error) {
    console.error("Error fetching global ads:", error);
    res.status(500).json({ error: "Failed to fetch global ads." });
  }
};

// --- GET CLUB ADS ---
export const getClubAds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clubId } = req.params;
    const adRepo = AppDataSource.getRepository(Ad);
    
    // Check if user is authenticated and has appropriate role
    const authReq = req as AuthenticatedRequest;
    const isAdmin = authReq.user?.role === "admin";
    const isClubOwner = authReq.user?.role === "clubowner" && authReq.user?.clubId === clubId;
    
    let whereCondition: any = { 
      clubId, 
      isDeleted: false 
    };
    
    // If not admin or club owner, only show active and visible ads
    if (!isAdmin && !isClubOwner) {
      whereCondition.isActive = true;
      whereCondition.isVisible = true;
    }
    
    const ads = await adRepo.find({ 
      where: whereCondition, 
      order: { priority: "DESC", createdAt: "DESC" } 
    });
    res.json(ads.map(adToResponse));
  } catch (error) {
    console.error("Error fetching club ads:", error);
    res.status(500).json({ error: "Failed to fetch club ads." });
  }
};

// --- GET MY CLUB ADS ---
export const getMyClubAds = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "clubowner") {
      res.status(403).json({ error: "Only club owners can view their ads." });
      return;
    }
    const clubId = req.user.clubId;
    if (!clubId) {
      res.status(400).json({ error: "No clubId found for user." });
      return;
    }
    const adRepo = AppDataSource.getRepository(Ad);
    const ads = await adRepo.find({ 
      where: { clubId, isDeleted: false }, 
      order: { priority: "DESC", createdAt: "DESC" } 
    });
    res.json(ads.map(adToResponse));
  } catch (error) {
    console.error("Error fetching my club ads:", error);
    res.status(500).json({ error: "Failed to fetch my club ads." });
  }
};

// --- GET GLOBAL ADS (ADMIN) ---
export const getGlobalAdsAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Only admins can view all global ads." });
      return;
    }
    const adRepo = AppDataSource.getRepository(Ad);
    const ads = await adRepo.find({ 
      where: { label: "global" }, // Use label instead of clubId check
      order: { priority: "DESC", createdAt: "DESC" } 
    });
    res.json(ads.map(adToResponse));
  } catch (error) {
    console.error("Error fetching global ads (admin):", error);
    res.status(500).json({ error: "Failed to fetch global ads." });
  }
};

// --- GET CLUB ADS (ADMIN) ---
export const getClubAdsAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Only admins can view all club ads." });
      return;
    }
    const { clubId } = req.params;
    if (!clubId) {
      res.status(400).json({ error: "clubId parameter is required" });
      return;
    }
    const adRepo = AppDataSource.getRepository(Ad);
    const ads = await adRepo.find({ 
      where: { clubId }, 
      order: { priority: "DESC", createdAt: "DESC" } 
    });
    res.json(ads.map(adToResponse));
  } catch (error) {
    console.error("Error fetching club ads (admin):", error);
    res.status(500).json({ error: "Failed to fetch club ads." });
  }
}; 