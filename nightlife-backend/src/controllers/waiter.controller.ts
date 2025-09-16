import { Response } from "express";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import { Club } from "../entities/Club";
import { AuthenticatedRequest } from "../types/express";
import bcrypt from "bcrypt";
import { authSchemaRegister } from "../schemas/auth.schema";
import { isDisposableEmail } from "../utils/disposableEmailValidator";
import { sanitizeInput } from "../utils/sanitizeInput";

export const createWaiter = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
      res.status(403).json({ error: "Solo los propietarios de club pueden crear meseros" });
      return;
    }

    const existing = await userRepo.findOneBy({ email });
    if (existing) {
      res.status(409).json({ error: "Email ya existe" });
      return;
    }

    const club = await clubRepo.findOneBy({ ownerId: requester.id });
    if (!club) {
      res.status(403).json({ error: "No eres propietario de un club" });
      return;
    }
    const clubId = club.id;

    const hashedPassword = await bcrypt.hash(password, 10);
    const newWaiter = userRepo.create({
      email,
      password: hashedPassword,
      role: "waiter",
      clubId,
    });

    await userRepo.save(newWaiter);
    res.status(201).json({ message: "Mesero creado", waiter: newWaiter });
  } catch (error) {
    console.error("❌ Error creating waiter:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const getWaiters = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userRepo = AppDataSource.getRepository(User);
  const requester = req.user;

  if (!requester || requester.role !== "clubowner") {
    res.status(403).json({ error: "Solo los propietarios de club pueden ver meseros" });
    return;
  }

  const club = await AppDataSource.getRepository(Club).findOneBy({ ownerId: requester.id });
  if (!club) {
    res.status(403).json({ error: "No eres propietario de un club" });
    return;
  }

  const waiters = await userRepo.find({
    where: { role: "waiter", clubId: club.id },
    select: ["id", "email", "createdAt"],
  });

  res.json(waiters);
};

export const deleteWaiter = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userRepo = AppDataSource.getRepository(User);
  const requester = req.user;

  if (!requester || requester.role !== "clubowner") {
    res.status(403).json({ error: "Solo los propietarios de club pueden eliminar meseros" });
    return;
  }

  const waiter = await userRepo.findOneBy({ id, role: "waiter" });
  if (!waiter) {
    res.status(404).json({ error: "Mesero no encontrado" });
    return;
  }

  const ownerClub = await AppDataSource.getRepository(Club).findOneBy({ ownerId: requester.id });
  if (!ownerClub || waiter.clubId !== ownerClub.id) {
    res.status(403).json({ error: "No estás autorizado para eliminar este mesero" });
    return;
  }

  await userRepo.remove(waiter);
  res.status(200).json({ message: "Mesero eliminado exitosamente" });
}; 