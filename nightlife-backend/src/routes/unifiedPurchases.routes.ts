import { Router } from "express";
import {
  getUserUnifiedPurchases,
  getUserUnifiedPurchaseById,
  getClubUnifiedPurchases,
  getClubUnifiedPurchaseById,
} from "../controllers/unifiedPurchases.controller";
import { authMiddleware, requireClubOwnerAuth } from "../middlewares/authMiddleware";

const router = Router();

// 🏢 Club owners (view purchases of their club)
router.get("/club", authMiddleware, requireClubOwnerAuth, getClubUnifiedPurchases);
router.get("/club/:id", authMiddleware, requireClubOwnerAuth, getClubUnifiedPurchaseById);

// 👤 Normal users (must be logged in)
router.get("/", authMiddleware, getUserUnifiedPurchases);
router.get("/:id", authMiddleware, getUserUnifiedPurchaseById);

export default router;
