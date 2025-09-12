import { Router } from "express";
import { 
  confirmWompiMenuCheckout, 
  checkWompiMenuTransactionStatus 
} from "../controllers/menuCheckoutWompi.controller";
import { optionalAuthMiddleware } from "../middlewares/optionalAuthMiddleware";

const router = Router();

// ✅ Step 2 – Confirm Wompi transaction & trigger menu flow - DEPRECATED
router.post("/confirm", optionalAuthMiddleware, async (req, res) => {
  try {
    res.status(410).json({ 
      error: "This endpoint has been deprecated. Use the unified checkout system instead.",
      message: "Please use POST /api/unified-checkout/confirm instead"
    });
  } catch (err) {
    console.error("Wompi menu confirm error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 📊 Check Wompi menu transaction status - DEPRECATED
router.get("/status/:transactionId", optionalAuthMiddleware, async (req, res) => {
  try {
    res.status(410).json({ 
      error: "This endpoint has been deprecated. Use the unified checkout system instead.",
      message: "Please use POST /api/unified-checkout/confirm instead"
    });
  } catch (err) {
    console.error("Wompi menu status error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router; 