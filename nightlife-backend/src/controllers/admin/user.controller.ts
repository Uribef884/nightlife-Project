import { Request, Response } from "express";
import { AppDataSource } from "../../config/data-source";
import { User } from "../../entities/User";
import { AuthenticatedRequest } from "../../types/express";
import { sanitizeInput, sanitizeObject } from "../../utils/sanitizeInput";
import { anonymizeUser, canUserBeDeleted } from "../../utils/anonymizeUser";

/**
 * GET /admin/users - Get all users (admin only)
 */
export async function getAllUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find({
      select: [
        "id", "email", "originalEmail", "role", "firstName", "lastName", 
        "isDeleted", "deletedAt", "createdAt", "updatedAt", "clubId"
      ],
      order: { createdAt: "DESC" }
    });

    res.json({
      users: users.map(user => ({
        id: user.id,
        email: user.isDeleted ? user.originalEmail : user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        clubId: user.clubId
      }))
    });
  } catch (error) {
    console.error("❌ Error getting all users:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * GET /admin/users/:id - Get specific user details (admin only)
 */
export async function getUserById(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Sanitize the user ID
    const sanitizedId = sanitizeInput(id);
    if (!sanitizedId) {
      res.status(400).json({ error: "ID de usuario inválido" });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: sanitizedId });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    res.json({
      id: user.id,
      email: user.isDeleted ? user.originalEmail : user.email,
      originalEmail: user.originalEmail,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isDeleted: user.isDeleted,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      clubId: user.clubId,
      isOAuthUser: user.isOAuthUser
    });
  } catch (error) {
    console.error("❌ Error getting user by ID:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * DELETE /admin/users/:id - Delete user (admin only)
 */
export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Sanitize the user ID
    const sanitizedId = sanitizeInput(id);
    if (!sanitizedId) {
      res.status(400).json({ error: "ID de usuario inválido" });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: sanitizedId });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (user.isDeleted) {
      res.status(400).json({ error: "La cuenta de usuario ya ha sido eliminada" });
      return;
    }

    // Check if user can be deleted
    const canDelete = await canUserBeDeleted(sanitizedId);
    if (!canDelete.success) {
      if (canDelete.requiresTransfer) {
        res.status(400).json({ 
          error: canDelete.message,
          requiresTransfer: true,
          clubsToTransfer: canDelete.clubsToTransfer?.map(club => ({
            id: club.id,
            name: club.name
          }))
        });
      } else {
        res.status(400).json({ error: canDelete.message });
      }
      return;
    }

    // Anonymize the user instead of hard deleting
    const result = await anonymizeUser(sanitizedId);
    
    if (result.success) {
      res.status(200).json({ 
        message: "Cuenta de usuario anonimizada exitosamente",
        userId: sanitizedId
      });
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * GET /admin/users/:id/deletion-status - Check if user can be deleted (admin only)
 */
export async function checkUserDeletionStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Sanitize the user ID
    const sanitizedId = sanitizeInput(id);
    if (!sanitizedId) {
      res.status(400).json({ error: "ID de usuario inválido" });
      return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOneBy({ id: sanitizedId });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const result = await canUserBeDeleted(sanitizedId);
    
    if (result.success) {
      res.json({ 
        canDelete: true, 
        message: result.message 
      });
    } else {
      res.json({ 
        canDelete: false, 
        message: result.message,
        requiresTransfer: result.requiresTransfer,
        clubsToTransfer: result.clubsToTransfer?.map(club => ({
          id: club.id,
          name: club.name
        }))
      });
    }
  } catch (error) {
    console.error("❌ Error checking user deletion status:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * PATCH /admin/users/:id/role - Update user role (admin only)
 */
export async function updateUserRole(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    
    // Sanitize the user ID
    const sanitizedId = sanitizeInput(id);
    if (!sanitizedId) {
      res.status(400).json({ error: "ID de usuario inválido" });
      return;
    }

    // Sanitize the request body
    const sanitizedBody = sanitizeObject(req.body, ['role'], { maxLength: 20 });
    const { role } = sanitizedBody;

    if (!role || !["clubowner", "bouncer", "user"].includes(role)) {
      res.status(400).json({ error: "Rol inválido. Roles permitidos: user, clubowner, bouncer." });
      return;
    }

    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ id: sanitizedId });

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (user.role === "admin") {
      res.status(403).json({ error: "No se puede cambiar el rol de un administrador vía API" });
      return;
    }

    if (user.isDeleted) {
      res.status(400).json({ error: "No se puede modificar un usuario eliminado" });
      return;
    }

    user.role = role;
    await repo.save(user);

    res.json({ 
      message: `Rol de usuario actualizado a ${role}`,
      userId: sanitizedId,
      newRole: role
    });
  } catch (error) {
    console.error("❌ Error updating user role:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
} 