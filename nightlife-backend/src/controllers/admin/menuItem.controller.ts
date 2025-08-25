import { Request, Response } from "express";
import { AppDataSource } from "../../config/data-source";
import { MenuItem } from "../../entities/MenuItem";
import { AuthenticatedRequest } from "../../types/express";
import { validateImageUrlWithResponse } from "../../utils/validateImageUrl";
import { sanitizeInput, sanitizeObject } from "../../utils/sanitizeInput";
import { S3Service } from "../../services/s3Service";
import { ImageService } from "../../services/imageService";
import { cleanupMenuItemS3Files } from "../../utils/s3Cleanup";

// Admin function to get menu for a specific club
export const getMenuForClubAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clubId } = req.params;
    const menuItemRepo = AppDataSource.getRepository(MenuItem);
    
    const menuItems = await menuItemRepo.find({
      where: { clubId, isActive: true, isDeleted: false },
      relations: ["category", "variants"],
      order: { name: "ASC" }
    });

    res.status(200).json(menuItems);
  } catch (error) {
    console.error("❌ Error fetching menu for club:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin function to get menu item by ID
export const getMenuItemByIdAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const menuItemRepo = AppDataSource.getRepository(MenuItem);
    const { id } = req.params;
    
    const menuItem = await menuItemRepo.findOne({ 
      where: { id, isDeleted: false }, 
      relations: ["category", "variants"] 
    });

    if (!menuItem) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    res.status(200).json(menuItem);
  } catch (error) {
    console.error("❌ Error fetching menu item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin function to create menu item for a specific club
export const createMenuItemAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { clubId } = req.params;
    
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

    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    if (!categoryId) {
      res.status(400).json({ error: "Category ID is required" });
      return;
    }

    // Validate image file
    if (!req.file) {
      res.status(400).json({ error: "Image file is required." });
      return;
    }

    if (hasVariantsBool && priceNum !== null && priceNum !== undefined) {
      res.status(400).json({ error: "Price must be null when hasVariants is true" });
      return;
    }

    if (!hasVariantsBool && (typeof priceNum !== "number" || priceNum <= 0)) {
      res.status(400).json({ error: "Price must be a positive number (greater than 0) if hasVariants is false" });
      return;
    }

    // Validate minimum cost for menu items (no free items allowed)
    if (!hasVariantsBool && priceNum !== undefined && priceNum < 1500) {
      res.status(400).json({ error: "Price must be at least 1500 COP for menu items." });
      return;
    }

    if (hasVariantsBool && maxPerPersonNum !== null && maxPerPersonNum !== undefined) {
      res.status(400).json({ error: "maxPerPerson must be null when hasVariants is true" });
      return;
    }

    if (!hasVariantsBool && (typeof maxPerPersonNum !== "number" || maxPerPersonNum <= 0)) {
      res.status(400).json({ error: "maxPerPerson must be a positive number if hasVariants is false" });
      return;
    }

    // Enforce that parent menu items with variants cannot have dynamic pricing enabled
    if (hasVariantsBool && dynamicPricingEnabledBool) {
      res.status(400).json({ 
        error: "Parent menu items with variants cannot have dynamic pricing enabled. Dynamic pricing should be configured on individual variants instead." 
      });
      return;
    }

    // Process image
    const processed = await ImageService.processImage(req.file.buffer);

    // Create menu item
    const menuItemRepo = AppDataSource.getRepository(MenuItem);
    const newMenuItem = menuItemRepo.create({
      name: name.trim(),
      description: description?.trim() || null,
      price: hasVariantsBool ? undefined : priceNum,
      maxPerPerson: hasVariantsBool ? undefined : maxPerPersonNum,
      hasVariants: hasVariantsBool,
      dynamicPricingEnabled: dynamicPricingEnabledBool,
      categoryId,
      clubId: clubId,
      imageUrl: "", // will be set after upload
      imageBlurhash: processed.blurhash,
      isActive: true,
    });

    await menuItemRepo.save(newMenuItem);

    // Upload image to S3
    const key = S3Service.generateKey(clubId, 'menu-item');
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/jpeg', key);
    
    // Update menu item with image URL
    newMenuItem.imageUrl = uploadResult.url;
    await menuItemRepo.save(newMenuItem);

    res.status(201).json(newMenuItem);
  } catch (error) {
    console.error("❌ Error creating menu item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin function to update menu item
export const updateMenuItemAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const menuItemRepo = AppDataSource.getRepository(MenuItem);

    const menuItem = await menuItemRepo.findOne({ where: { id } });
    if (!menuItem) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    // Sanitize all string inputs
    const sanitizedBody = sanitizeObject(req.body, [
      'name', 'description', 'imageUrl'
    ], { maxLength: 1000 });
    
    const { name, description, imageUrl, isActive, hasVariants, dynamicPricingEnabled, maxPerPerson } = sanitizedBody;

    if (name !== undefined) {
      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }
      menuItem.name = name;
    }

    if (description !== undefined) {
      menuItem.description = description;
    }

    if (imageUrl !== undefined) {
      if (imageUrl && !validateImageUrlWithResponse(imageUrl, res)) {
        return;
      }
      menuItem.imageUrl = imageUrl;
    }

    if (typeof isActive === "boolean") {
      menuItem.isActive = isActive;
    }

    if (typeof hasVariants === "boolean") {
      menuItem.hasVariants = hasVariants;
    }

    if (typeof dynamicPricingEnabled === "boolean") {
      menuItem.dynamicPricingEnabled = dynamicPricingEnabled;
    }

    if (maxPerPerson !== undefined) {
      if (maxPerPerson === null) {
        menuItem.maxPerPerson = undefined;
      } else {
        const parsedMaxPerPerson = parseInt(maxPerPerson);
        if (isNaN(parsedMaxPerPerson) || parsedMaxPerPerson <= 0) {
          res.status(400).json({ error: "Max per person must be a positive integer" });
          return;
        }
        menuItem.maxPerPerson = parsedMaxPerPerson;
      }
    }

    await menuItemRepo.save(menuItem);
    res.status(200).json(menuItem);
  } catch (error) {
    console.error("❌ Error updating menu item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin function to delete menu item
export const deleteMenuItemAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const menuItemId = req.params.id;
    const menuItemRepo = AppDataSource.getRepository(MenuItem);

    const menuItem = await menuItemRepo.findOne({ where: { id: menuItemId } });
    if (!menuItem) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    // Clean up S3 image
    const s3CleanupResult = await cleanupMenuItemS3Files(menuItem);

    menuItem.isDeleted = true;
    await menuItemRepo.save(menuItem);

    res.status(200).json({ 
      message: "Menu item deleted successfully",
      s3CleanupResult,
      note: "S3 image has been cleaned up"
    });
  } catch (error) {
    console.error("❌ Error deleting menu item:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin function to toggle menu item dynamic pricing
export const toggleMenuItemDynamicPricingAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItemId = req.params.id;
    const menuItemRepo = AppDataSource.getRepository(MenuItem);

    const menuItem = await menuItemRepo.findOne({ where: { id: menuItemId } });
    if (!menuItem) {
      res.status(404).json({ error: "Menu item not found" });
      return;
    }

    // Reject if the menu item has variants
    if (menuItem.hasVariants) {
      res.status(400).json({ 
        error: "Parent menu items with variants cannot have dynamic pricing enabled. Dynamic pricing should be configured on individual variants instead." 
      });
      return;
    }

    menuItem.dynamicPricingEnabled = !menuItem.dynamicPricingEnabled;
    await menuItemRepo.save(menuItem);

    res.status(200).json({ dynamicPricingEnabled: menuItem.dynamicPricingEnabled });
  } catch (error) {
    console.error("❌ Error toggling menu item dynamic pricing:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Admin function to update menu item image
export const updateMenuItemImageAdmin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = req.file!; // Guaranteed to exist due to middleware validation

    // Verify menu item exists
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const item = await itemRepo.findOne({ where: { id } });

    if (!item) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    // Process and upload the new image
    const { ImageService } = await import("../../services/imageService");
    const processed = await ImageService.processImage(file.buffer, 800, 600, 80);

    // Upload to S3
    const { S3Service } = await import("../../services/s3Service");
    const key = `clubs/${item.clubId}/menu/items/${id}/image-${Date.now()}.webp`;
    const uploadResult = await S3Service.uploadFile(processed.buffer, 'image/webp', key);

    // Update the menu item with the new image URL
    const oldImageUrl = item.imageUrl;
    item.imageUrl = uploadResult.url;
    await itemRepo.save(item);

    // Clean up the old image if it exists
    if (oldImageUrl && oldImageUrl !== uploadResult.url) {
      try {
        const url = new URL(oldImageUrl);
        const oldKey = url.pathname.substring(1);
        await S3Service.deleteFile(oldKey);
      } catch (deleteError) {
        console.error('⚠️ Warning: Failed to delete old menu item image from S3:', deleteError);
      }
    }

    res.status(200).json({
      message: 'Menu item image updated successfully',
      imageUrl: uploadResult.url
    });
  } catch (error) {
    console.error("❌ Error updating menu item image:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}; 