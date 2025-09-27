import { Router } from "express";
import { unifiedCheckoutController } from "../controllers/unifiedCheckout.controller";
import { apiRateLimiter } from "../middlewares/queryRateLimiter";

const router = Router();

// Get Wompi acceptance tokens
router.get("/acceptance-tokens", unifiedCheckoutController.getAcceptanceTokens.bind(unifiedCheckoutController));

// Initiate unified checkout
router.post("/initiate", unifiedCheckoutController.initiateCheckout.bind(unifiedCheckoutController));

// Confirm unified checkout
router.post("/confirm", unifiedCheckoutController.confirmCheckout.bind(unifiedCheckoutController));

// Get transaction status with rate limiting (max 100 requests per 15 minutes per IP)
// This is more lenient since we removed excessive polling and rely on SSE
router.get("/status/:transactionId", 
  apiRateLimiter,
  unifiedCheckoutController.getTransactionStatus.bind(unifiedCheckoutController)
);

// DEBUG: Unlock cart (temporary endpoint for debugging)
router.post("/debug/unlock-cart", unifiedCheckoutController.debugUnlockCart.bind(unifiedCheckoutController));

export default router;
