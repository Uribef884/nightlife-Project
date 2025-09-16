import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types/express";

export function requireWaiterOrClubOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.user;

  if (!user) {
    res.status(401).json({ error: "Autenticación requerida" });
    return;
  }

  if (user.role !== "waiter" && user.role !== "clubowner") {
    res.status(403).json({ error: "Privilegios de Mesero o Propietario de Club requeridos" });
    return;
  }

  next();
} 