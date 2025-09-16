import { Request, Response, NextFunction } from "express";
import { TicketCategory } from "../entities/Ticket";
import { AppDataSource } from "../config/data-source";
import { Event } from "../entities/Event";

export const validateTicketInput = (req: Request, res: Response, next: NextFunction): void => {
  const {
    category,
    price,
    quantity,
    availableDate,
    eventId,
  } = req.body;

  try {
    const parsedPrice = parseFloat(price);
    const parsedQuantity = quantity !== undefined ? parseInt(quantity, 10) : undefined;

    if (!Object.values(TicketCategory).includes(category)) {
      res.status(400).json({ error: `Invalid category: ${category}` });
      return;
    }

    // ✅ Normal Covers (general, VIP, palco, combo)
    if (
      category === TicketCategory.GENERAL
    ) {
      if (availableDate) {
        res.status(400).json({ error: "Normal covers no pueden tener una fecha disponible" });
        return;
      }

      if (quantity !== undefined) {
        res.status(400).json({ error: "Normal covers no pueden tener una cantidad" });
        return;
      }

      if (parsedPrice <= 0) {
        res.status(400).json({ error: "Normal covers deben tener un precio mayor que 0" });
        return;
      }

      // Validate minimum cost for paid tickets (exclude free tickets)
      if (parsedPrice !== 0 && parsedPrice < 1500) {
        res.status(400).json({ error: "El precio debe ser al menos 1500 COP para tickets pagos. Usa precio 0 para tickets gratuitos." });
        return;
      }

      if (eventId) {
        res.status(400).json({ error: "Normal covers no pueden estar vinculados a eventos" });
        return;
      }

      return next();
    }

    // ✅ Free tickets
    if (category === TicketCategory.FREE) {
      if (parsedPrice !== 0) {
        res.status(400).json({ error: "Free tickets deben tener precio 0" });
        return;
      }

      if (!availableDate) {
        res.status(400).json({ error: "Free tickets deben tener una fecha disponible" });
        return;
      }

      if (parsedQuantity == null || parsedQuantity <= 0) {
        res.status(400).json({ error: "Free tickets deben tener una cantidad válida" });
        return;
      }

      if (eventId) {
        res.status(400).json({ error: "Free tickets no pueden estar vinculados a eventos" });
        return;
     }

      return next();
    }

    // ✅ Event tickets
    if (category === TicketCategory.EVENT) {
      if (!eventId) {
        res.status(400).json({ error: "Event tickets deben estar vinculados a un evento" });
        return;
      }

      if (availableDate) {
        res.status(400).json({ error: "Event tickets no pueden establecer manualmente una fecha disponible" });
        return;
      }

      if (parsedQuantity == null || parsedQuantity <= 0) {
        res.status(400).json({ error: "Event tickets deben tener una cantidad válida" });
        return;
      }

      // Async DB call workaround in sync middleware
      AppDataSource.getRepository(Event)
        .findOne({ where: { id: eventId } })
        .then((event) => {
          if (!event) {
            res.status(400).json({ error: "Evento no encontrado para eventId" });
            return;
          }
          next();
        })
        .catch((err) => {
          console.error("❌ Ticket validation DB error:", err);
          res.status(500).json({ error: "Error interno del servidor durante la validación" });
        });

      return;
    }

    // Fallback
    res.status(400).json({ error: "Categoría de ticket desconocida" });
  } catch (error) {
    console.error("❌ Ticket validation failed:", error);
    res.status(500).json({ error: "Error interno del servidor durante la validación" });
  }
};
