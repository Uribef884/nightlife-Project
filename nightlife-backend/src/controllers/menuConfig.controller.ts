import { Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Club } from "../entities/Club";
import { UnifiedCartItem } from "../entities/UnifiedCartItem";
import { AuthenticatedRequest } from "../types/express";

// Get current menu configuration
export const getMenuConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;

    // Only club owners and admins can access menu configuration
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los dueños de clubes pueden acceder a la configuración del menú" });
      return;
    }

    // Get clubId from URL parameters for admin routes, or user's clubId for club owners
    let clubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      clubId = req.params.clubId;
      if (!clubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido" });
        return;
      }
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: "El usuario no está asociado con ningún club" });
        return;
      }
      clubId = user.clubId;
    }

    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ 
      where: { id: clubId },
      relations: ["menuCategories", "menuItems"]
    });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    const hasStructuredMenu = club.menuItems && club.menuItems.length > 0;
    const hasPdfMenu = !!club.pdfMenuUrl;

    res.json({
      clubId: club.id,
      clubName: club.name,
      menuType: club.menuType,
      hasStructuredMenu,
      hasPdfMenu,
      structuredItemCount: club.menuItems?.length || 0,
      pdfMenuName: club.pdfMenuName,
      pdfMenuUrl: club.pdfMenuUrl,
      description: club.menuType === "none" 
        ? "No hay menú disponible"
        : club.menuType === "pdf"
        ? "Menú PDF disponible"
        : "Menú estructurado con funcionalidad de carrito"
    });
  } catch (error) {
    console.error("Error getting menu config:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// Switch menu type
export const switchMenuType = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { menuType } = req.body;
    const user = req.user!;

    // Only club owners and admins can change menu configuration
    if (user.role !== "admin" && user.role !== "clubowner") {
      res.status(403).json({ error: "Solo los dueños de clubes pueden cambiar la configuración del menú" });
      return;
    }

    // Get clubId from URL parameters for admin routes, or user's clubId for club owners
    let clubId: string;
    
    if (user.role === "admin") {
      // For admins, use the clubId from the URL parameters
      clubId = req.params.clubId;
      if (!clubId) {
        res.status(400).json({ error: "El parámetro clubId es requerido" });
        return;
      }
    } else {
      // For club owners, use their associated clubId
      if (!user.clubId) {
        res.status(400).json({ error: "El usuario no está asociado con ningún club" });
        return;
      }
      clubId = user.clubId;
    }

    if (!menuType || !["structured", "pdf", "none"].includes(menuType)) {
      res.status(400).json({ error: "Tipo de menú inválido. Debe ser 'structured', 'pdf', o 'none'" });
      return;
    }
    const clubRepo = AppDataSource.getRepository(Club);
    const club = await clubRepo.findOne({ where: { id: clubId } });

    if (!club) {
      res.status(404).json({ error: "Club no encontrado" });
      return;
    }

    // If switching away from structured mode, clear all cart items for this club
    if (club.menuType === "structured" && (menuType === "pdf" || menuType === "none")) {
      const cartRepo = AppDataSource.getRepository(UnifiedCartItem);
      await cartRepo.delete({ clubId });
    }

    // Update menu type
    const previousMenuType = club.menuType;
    club.menuType = menuType;
    await clubRepo.save(club);

    // Create appropriate response message based on the switch
    let message = `Tipo de menú cambiado a ${menuType}`;
    let warning = null;

    if (previousMenuType === "structured" && menuType === "pdf") {
      message = "Menú cambiado a modo PDF";
      warning = "Tus artículos del menú estructurado ahora están ocultos para los clientes. Solo el menú PDF subido será visible. Puedes cambiar de vuelta al modo estructurado en cualquier momento para restaurar la visibilidad de los artículos del menú.";
    } else if (previousMenuType === "structured" && menuType === "none") {
      message = "Menú deshabilitado";
      warning = "Tus artículos del menú estructurado ahora están ocultos para los clientes. No habrá menú disponible hasta que cambies al modo estructurado o PDF.";
    } else if (previousMenuType === "pdf" && menuType === "structured") {
      message = "Menú cambiado a modo estructurado - tus artículos del menú ahora son visibles para los clientes";
    } else if (previousMenuType === "none" && menuType === "structured") {
      message = "Menú habilitado - tus artículos del menú estructurado ahora son visibles para los clientes";
    } else if (menuType === "pdf") {
      message = "Menú cambiado a modo PDF - sube un PDF para hacerlo visible a los clientes";
    }

    const response: any = {
      message,
      menuType: club.menuType,
      clubId: club.id
    };

    if (warning) {
      response.warning = warning;
    }

    res.json(response);
  } catch (error) {
    console.error("Error switching menu type:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

// PDF menu management is now handled by /upload/menu/pdf and /upload/menu/pdf DELETE 