import { Router } from "express";
import { unifiedCheckoutController } from "../controllers/unifiedCheckout.controller";

const router = Router();

// Get Wompi acceptance tokens
router.get("/acceptance-tokens", unifiedCheckoutController.getAcceptanceTokens.bind(unifiedCheckoutController));

// Initiate unified checkout
router.post("/initiate", unifiedCheckoutController.initiateCheckout.bind(unifiedCheckoutController));

// Confirm unified checkout
router.post("/confirm", unifiedCheckoutController.confirmCheckout.bind(unifiedCheckoutController));

// Get transaction status
router.get("/status/:transactionId", unifiedCheckoutController.getTransactionStatus.bind(unifiedCheckoutController));

// DEBUG: Unlock cart (temporary endpoint for debugging)
router.post("/debug/unlock-cart", unifiedCheckoutController.debugUnlockCart.bind(unifiedCheckoutController));

export default router;
