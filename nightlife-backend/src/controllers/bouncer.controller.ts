import { Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { Club } from "../entities/Club";
import { AuthenticatedRequest } from "../types/express";
import bcrypt from "bcrypt";
import { authSchemaRegister } from "../schemas/auth.schema";
import { isDisposableEmail } from "../utils/disposableEmailValidator";
import { sanitizeInput } from "../utils/sanitizeInput";

export const createBouncer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Normalize and sanitize email
    const sanitizedEmail = sanitizeInput(req.body.email?.toLowerCase().trim());
    const password = req.body.password;
    
    if (!sanitizedEmail) {
      res.status(400).json({ error: "Formato de email inválido" });
      return;
    }
    
    const email = sanitizedEmail;
    const userRepo = AppDataSource.getRepository(User);
    const clubRepo = AppDataSource.getRepository(Club);
    const requester = req.user;

    // Schema validation (mirror register)
    const result = authSchemaRegister.safeParse({ email, password });
    if (!result.success) {
      res.status(400).json({
        error: "Entrada inválida",
        details: result.error.flatten(),
      });
      return;
    }

    // Block disposable emails (mirror register)
    if (isDisposableEmail(email)) {
      res.status(403).json({ error: "Dominio de email no permitido" });
      return;
    }

    if (!requester || requester.role !== "clubowner") {
      res.status(403).json({ error: "Only club owners can create bouncers" });
      return;
    }

    const existing = await userRepo.findOneBy({ email });
    if (existing) {
      res.status(409).json({ error: "El email ya está en uso" });
      return;
    }

    // Use the active club from the authenticated user
    if (!requester.clubId) {
      res.status(403).json({ error: "No tienes un club activo seleccionado" });
      return;
    }
    
    // Verify the user owns this active club
    if (!requester.clubIds?.includes(requester.clubId)) {
      res.status(403).json({ error: "No eres propietario del club activo" });
      return;
    }
    
    const clubId = requester.clubId;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newBouncer = userRepo.create({
      email,
      password: hashedPassword,
      role: "bouncer",
      clubId,
    });

    await userRepo.save(newBouncer);
    res.status(201).json({ message: "Bouncer created", bouncer: newBouncer });
  } catch (error) {
    console.error("❌ Error creating bouncer:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const getBouncers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userRepo = AppDataSource.getRepository(User);
  const requester = req.user;

  if (!requester || requester.role !== "clubowner") {
    res.status(403).json({ error: "Solo los propietarios de club pueden ver porteros" });
    return;
  }

  // Use the active club from the authenticated user
  if (!requester.clubId) {
    res.status(403).json({ error: "No tienes un club activo seleccionado" });
    return;
  }
  
  // Verify the user owns this active club
  if (!requester.clubIds?.includes(requester.clubId)) {
    res.status(403).json({ error: "No eres propietario del club activo" });
    return;
  }

  const bouncers = await userRepo.find({
    where: { role: "bouncer", clubId: requester.clubId },
    select: ["id", "email", "createdAt"],
  });

  res.json(bouncers);
};

export const deleteBouncer = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userRepo = AppDataSource.getRepository(User);
  const requester = req.user;

  if (!requester || requester.role !== "clubowner") {
    res.status(403).json({ error: "Solo los propietarios de club pueden eliminar porteros" });
    return;
  }

  const bouncer = await userRepo.findOneBy({ id, role: "bouncer" });
  if (!bouncer) {
    res.status(404).json({ error: "Portero no encontrado" });
    return;
  }

  // Use the active club from the authenticated user
  if (!requester.clubId) {
    res.status(403).json({ error: "No tienes un club activo seleccionado" });
    return;
  }
  
  // Verify the user owns this active club
  if (!requester.clubIds?.includes(requester.clubId)) {
    res.status(403).json({ error: "No eres propietario del club activo" });
    return;
  }
  
  if (bouncer.clubId !== requester.clubId) {
    res.status(403).json({ error: "No estás autorizado para eliminar este portero" });
    return;
  }

  await userRepo.remove(bouncer);
  res.status(200).json({ message: "Portero eliminado exitosamente" });
};
