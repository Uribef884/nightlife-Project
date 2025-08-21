import { Router } from "express";
import {
  createTicket,
  getTicketsByClub,
  getAllTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  toggleTicketVisibility,
  getTicketsForMyClub,
  toggleTicketDynamicPricing,
  getAvailableTicketsForDate,
  getAllTicketsForClubCalendar
} from "../controllers/ticket.controller";
import { authMiddleware, requireClubOwnerOrAdmin } from "../middlewares/authMiddleware";
import { validateTicketInput } from "../utils/ticketValidators";
import { createLimiter, readLimiter } from "../middlewares/rateLimiter";

const router = Router();

// ✅ Public access
router.get("/", getAllTickets);
router.get("/my-club", authMiddleware, requireClubOwnerOrAdmin, getTicketsForMyClub);
router.get("/:id", getTicketById);
router.get("/club/:id", getTicketsByClub);
router.get("/calendar/:clubId", readLimiter, getAllTicketsForClubCalendar);
router.get("/available/:clubId/:dateISO", readLimiter, getAvailableTicketsForDate);

// ✅ Authenticated + Role-protected
router.post("/", createLimiter, authMiddleware, requireClubOwnerOrAdmin, validateTicketInput ,createTicket);
router.put("/:id", authMiddleware, requireClubOwnerOrAdmin, updateTicket);
router.delete("/:id", authMiddleware, requireClubOwnerOrAdmin, deleteTicket);
router.patch("/:id/hide", authMiddleware, requireClubOwnerOrAdmin, toggleTicketVisibility);
router.patch('/:id/toggle-dynamic-pricing', authMiddleware, requireClubOwnerOrAdmin, toggleTicketDynamicPricing);

export default router;