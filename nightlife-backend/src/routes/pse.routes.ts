import { Router } from "express";
import { getPSEBanks } from "../controllers/pseController";

const router = Router();

/**
 * @route GET /api/pse/banks
 * @desc Get list of PSE financial institutions
 * @access Public
 */
router.get("/banks", getPSEBanks);

export default router;
