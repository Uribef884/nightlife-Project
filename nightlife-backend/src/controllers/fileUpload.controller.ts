import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { S3Service } from '../services/s3Service';
import { ImageService } from '../services/imageService';
import { AppDataSource } from '../config/data-source';
import { Club } from '../entities/Club';
import { MenuItem } from '../entities/MenuItem';
import { Event } from '../entities/Event';
import { Ad } from "../entities/Ad";
import { validateImageUrlWithResponse } from '../utils/validateImageUrl';
import PDFService from "../services/pdfService";

// Upload menu PDF
export const uploadMenuPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const file = req.file!; // Guaranteed to exist due to middleware validation

    // File validation is handled by middleware

    // Only club owners can upload PDF menu
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los dueños de clubes pueden subir menús PDF" });  
      return;
    }

    // Get clubId based on user role
    let clubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      clubId = req.params.clubId;
      if (!clubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido para subidas de administrador" });
        return;
      }
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: 'Usuario no asociado con ningún club' });
        return;
      }
      clubId = user.clubId;
    }

    // Get club info first to check current PDF and validate
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ where: { id: clubId } });
    
    if (!club) {
      res.status(404).json({ error: 'Club no encontrado' });
      return;
    }

    // Check if club is in PDF mode
    if (club.menuType !== "pdf") {
      let errorMessage = "El club debe estar en modo menú PDF para subir un PDF. Cambia a modo PDF primero.";
      
      if (club.menuType === "structured") {
        errorMessage = "No se puede subir menú PDF cuando el club está en modo menú estructurado. Cambia a modo PDF primero para subir un menú PDF.";
      } else if (club.menuType === "none") {
        errorMessage = "No se puede subir menú PDF cuando el club no tiene menú habilitado. Cambia a modo PDF primero para subir un menú PDF.";
      }
      
      res.status(400).json({ 
        error: errorMessage 
      });
      return;
    }

    // Store reference to old PDF for deletion after successful upload
    const oldPdfUrl = club.pdfMenuUrl;
    const oldMenuId = club.pdfMenuId;

    // Generate new menu ID
    const newMenuId = `menu-${Date.now()}`;

    // Upload new PDF
    const key = S3Service.generateKey(clubId, 'menu-pdf');
    
    const uploadResult = await S3Service.uploadFile(
      file.buffer,
      file.mimetype,
      key
    );

    // Convert PDF to images and generate manifest
    const pdfService = new PDFService();
    let manifest = null;
    
    try {
      manifest = await pdfService.convertPDFToImages(
        file.buffer,
        clubId,
        newMenuId
      );
      console.log(`✅ PDF converted to ${manifest.pageCount} images`);
    } catch (conversionError) {
      console.error('⚠️ Warning: PDF conversion failed:', conversionError);
      // Don't fail the request - PDF is uploaded, just conversion failed
    }

    // Update club with new PDF URL and menu ID
    club.pdfMenuUrl = uploadResult.url;
    club.pdfMenuName = `menu-${Date.now()}.pdf`;
    club.pdfMenuId = newMenuId;
    if (manifest) {
      club.pdfMenuManifest = JSON.stringify(manifest);
    }
    await clubRepo.save(club);

    // Delete old PDF and images from S3 if upload and DB update were successful
    if (oldPdfUrl && oldPdfUrl !== uploadResult.url) {
      try {
        // Parse the S3 URL to extract the key
        const url = new URL(oldPdfUrl);
        const oldKey = url.pathname.substring(1); // Remove leading slash
        
        await S3Service.deleteFile(oldKey);
        
        // Also clean up old images if they exist
        if (oldMenuId) {
          await pdfService.cleanupOldMenuAssets(clubId, oldMenuId);
        }
      } catch (deleteError) {
        console.error('⚠️ Warning: Failed to delete old PDF/images from S3:', deleteError);
        // Don't fail the request - new PDF is already uploaded successfully
      }
    } else if (oldPdfUrl === uploadResult.url) {
      console.log(`⏭️ Skipping deletion - old and new URLs are identical (file was overwritten)`);
    }

    res.json({
      message: 'Menú PDF subido exitosamente',
      pdfMenuUrl: uploadResult.url,
      pdfMenuName: club.pdfMenuName,
      pdfMenuId: newMenuId,
      size: uploadResult.size,
      manifest: manifest ? {
        pageCount: manifest.pageCount,
        format: manifest.format,
        width: manifest.width,
        height: manifest.height
      } : null
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Error al subir PDF' });
  }
};

// Remove PDF menu
export const removePdfMenu = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only club owners can remove PDF menu
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los dueños de clubes pueden eliminar menús PDF" });
      return;
    }

    // Get clubId based on user role
    let clubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      clubId = req.params.clubId;
      if (!clubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido para operaciones de administrador" });
        return;
      }
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: 'Usuario no asociado con ningún club' });
        return;
      }
      clubId = user.clubId;
    }

    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ where: { id: clubId } });

    if (!club) {
      res.status(404).json({ error: 'Club no encontrado' });
      return;
    }

    if (!club.pdfMenuUrl) {
      res.status(404).json({ error: 'No hay menú PDF para eliminar' });
      return;
    }

    // Extract S3 key from URL to delete from S3
    try {
      // Parse the S3 URL to extract the key
      // URL format: https://bucket-name.s3.region.amazonaws.com/key/path
      const url = new URL(club.pdfMenuUrl);
      const key = url.pathname.substring(1); // Remove leading slash
      
      // Delete from S3
      await S3Service.deleteFile(key);
    } catch (s3Error) {
      console.error('Error deleting file from S3:', s3Error);
      // Continue with database cleanup even if S3 deletion fails
    }

    // Clear PDF menu info from database - use update to explicitly set NULL
    await clubRepo.update(club.id, {
      pdfMenuUrl: null as any,
      pdfMenuName: null as any
    });

    res.json({
      message: 'Menú PDF eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error removing PDF menu:', error);
    res.status(500).json({ error: 'Error al eliminar menú PDF' });
  }
};

// Upload club profile image
export const uploadClubProfileImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const file = req.file!; // Guaranteed to exist due to middleware validation

    // Only club owners can upload profile image
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los dueños de clubes pueden subir imagen de perfil" });
      return;
    }

    // Get clubId based on user role
    let clubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      const paramClubId = req.params.clubId;
      if (!paramClubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido para subidas de administrador" });
        return;
      }
      clubId = paramClubId;
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: 'Usuario no asociado con ningún club' });
        return;
      }
      clubId = user.clubId;
    }

    // Get club info first to check current image
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ where: { id: clubId } });
    
    if (!club) {
      res.status(404).json({ error: 'Club no encontrado' });
      return;
    }

    // Store reference to old image for deletion after successful upload
    const oldImageUrl = club.profileImageUrl;

    // Process image and generate BlurHash
    const processed = await ImageService.processImage(file.buffer);
    
    const key = S3Service.generateKey(clubId, 'profile-image');
    const uploadResult = await S3Service.uploadFile(
      processed.buffer,
      'image/jpeg',
      key
    );

    // Update club with new image
    club.profileImageUrl = uploadResult.url;
    club.profileImageBlurhash = processed.blurhash;
    await clubRepo.save(club);

    // Delete old image from S3 if upload and DB update were successful
    if (oldImageUrl) {
      try {
        // Parse the S3 URL to extract the key
        const url = new URL(oldImageUrl);
        const oldKey = url.pathname.substring(1); // Remove leading slash
        
        console.log(`🗑️ Attempting to delete old profile image with key: ${oldKey}`);
        await S3Service.deleteFile(oldKey);
        console.log(`✅ Deleted old profile image: ${oldKey}`);
      } catch (deleteError) {
        console.error('⚠️ Warning: Failed to delete old profile image from S3:', deleteError);
        // Don't fail the request - new image is already uploaded successfully
      }
    }

    res.json({
      message: 'Imagen de perfil subida exitosamente',
      imageUrl: uploadResult.url,
      blurhash: processed.blurhash,
      width: processed.width,
      height: processed.height
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
};

// Upload menu item image
export const uploadMenuItemImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { itemId, menuItemId } = req.params;
    const menuItemIdToUse = menuItemId || itemId; // Support both parameter names
    const file = req.file!; // Guaranteed to exist due to middleware validation

    // Only club owners can upload menu item images
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los dueños de clubes pueden subir imágenes de artículos del menú" });
      return;
    }

    // Get clubId based on user role
    let expectedClubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      const paramClubId = req.params.clubId;
      if (!paramClubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido para subidas de administrador" });
        return;
      }
      expectedClubId = paramClubId;
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: 'Usuario no asociado con ningún club' });
        return;
      }
      expectedClubId = user.clubId;
    }

    // Verify menu item ownership
    const itemRepo = AppDataSource.getRepository(MenuItem);
    const item = await itemRepo.findOne({ where: { id: menuItemIdToUse } });

    if (!item) {
      res.status(404).json({ error: 'Artículo del menú no encontrado' });
      return;
    }

    // Check if menu item belongs to the expected club
    if (item.clubId !== expectedClubId) {
      res.status(403).json({ 
        error: `El artículo del menú '${item.name}' no pertenece al club especificado` 
      });
      return;
    }

    // Store reference to old image for deletion after successful upload
    const oldImageUrl = item.imageUrl;

    // Process image
    const processed = await ImageService.processImage(file.buffer);
    
    const key = S3Service.generateKey(item.clubId, 'menu-item-image', menuItemIdToUse);
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
      message: 'Imagen del artículo del menú subida exitosamente',
      imageUrl: uploadResult.url,
      blurhash: processed.blurhash,
      itemId: item.id
    });
  } catch (error) {
    console.error('Error uploading menu item image:', error);
    res.status(500).json({ error: 'Error al subir imagen' });
  }
};

// Upload event banner image
export const uploadEventBanner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { eventId } = req.params;
    const file = req.file!; // Guaranteed to exist due to middleware validation


    // Only club owners can upload event banners
    if (user.role !== "admin" && user.role !== "clubowner") {
      console.log('❌ Access denied - user role:', user.role);
      res.status(403).json({ error: "Solo los dueños de clubes pueden subir banners de eventos" });
      return;
    }


    // Get clubId based on user role
    let expectedClubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      const paramClubId = req.params.clubId;
      if (!paramClubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido para subidas de administrador" });
        return;
      }
      expectedClubId = paramClubId;
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: 'Usuario no asociado con ningún club' });
        return;
      }
      expectedClubId = user.clubId;
    }

    // Verify event ownership
    const eventRepo = AppDataSource.getRepository(Event);
    const event = await eventRepo.findOne({ where: { id: eventId } });


    if (!event || event.clubId !== expectedClubId) {
      console.log('❌ Event not found or unauthorized');
      res.status(404).json({ error: 'Evento no encontrado o no autorizado' });
      return;
    }

    // Store reference to old banner for deletion after successful upload
    const oldBannerUrl = event.bannerUrl;

    // Process image
    const processed = await ImageService.processImage(file.buffer);

    const key = S3Service.generateKey(event.clubId, 'event-banner', eventId);

    

    const uploadResult = await S3Service.uploadFile(
      processed.buffer,
      'image/jpeg',
      key
    );


    // Update event
    event.bannerUrl = uploadResult.url;
    event.BannerURLBlurHash = processed.blurhash;
    await eventRepo.save(event);

    // Delete old banner from S3 if upload and DB update were successful
    // Only delete if the URLs are different (same key = same URL = no deletion needed)
    if (oldBannerUrl && oldBannerUrl !== uploadResult.url) {
      try {
        // Parse the S3 URL to extract the key
        const url = new URL(oldBannerUrl);
        const oldKey = url.pathname.substring(1); // Remove leading slash
        
        await S3Service.deleteFile(oldKey);
      } catch (deleteError) {
        console.error('⚠️ Warning: Failed to delete old event banner from S3:', deleteError);
        // Don't fail the request - new banner is already uploaded successfully
      }
    } else if (oldBannerUrl === uploadResult.url) {
      console.log('⏭️ Skipping deletion - old and new URLs are identical (file was overwritten)');
    }

    res.json({
      message: 'Banner del evento subido exitosamente',
      imageUrl: uploadResult.url,
      blurhash: processed.blurhash,
      eventId: event.id
    });

  } catch (error) {
    console.error('❌ Error uploading event banner:', error);
    res.status(500).json({ error: 'Error al subir banner del evento' });
  }
};

// Upload ad image (admin or club ad)
export const uploadAdImage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { adId } = req.params;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No se subió archivo de imagen." });
      return ;
    }

    // Find the ad
    const adRepo = AppDataSource.getRepository(Ad);
    const ad = await adRepo.findOne({ where: { id: adId } });
    if (!ad) {
      res.status(404).json({ error: "Anuncio no encontrado." });
      return;
    }

    // Permission check
    if (!ad.clubId && user.role !== "admin") {
      res.status(403).json({ error: "Solo los administradores pueden subir imágenes para anuncios de administrador." });
      return ;
    }
    if (ad.clubId) {
      if (user.role === "admin") {
        // For admins, check if the ad belongs to the club specified in the URL
        const paramClubId = req.params.clubId;
        if (!paramClubId || ad.clubId !== paramClubId) {
          res.status(403).json({ error: "El anuncio no pertenece al club especificado." });
          return;
        }
      } else if (user.role !== "clubowner" || user.clubId !== ad.clubId) {
        res.status(403).json({ error: "Solo el dueño del club puede subir imágenes para este anuncio." });
        return;
      }
    }

    // Store old image URL for safe deletion
    const oldImageUrl = ad.imageUrl;

    // Process image and generate blurhash
    const processed = await ImageService.processImage(file.buffer);
    const key = S3Service.generateAdKey(ad);
    const uploadResult = await S3Service.uploadFile(
      processed.buffer,
      'image/jpeg',
      key
    );

    // Update ad with new image
    ad.imageUrl = uploadResult.url;
    ad.imageBlurhash = processed.blurhash;
    await adRepo.save(ad);

    // Safe deletion of old image
    await S3Service.deleteFileByUrl(oldImageUrl, ad.imageUrl);

    res.json({
      message: 'Imagen del anuncio subida exitosamente',
      imageUrl: ad.imageUrl,
      blurhash: ad.imageBlurhash,
      adId: ad.id
    });
  } catch (error) {
    console.error('Error uploading ad image:', error);
    res.status(500).json({ error: 'Error al subir imagen del anuncio' });
  }
};



 