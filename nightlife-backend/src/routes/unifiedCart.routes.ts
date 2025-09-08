import { Router } from "express";
import { unifiedCartController } from "../controllers/unifiedCart.controller";

const router = Router();

// Unified Cart Routes
router.post("/add", unifiedCartController.addToCart.bind(unifiedCartController));
router.get("/", unifiedCartController.getCartItems.bind(unifiedCartController));
router.get("/summary", unifiedCartController.getCartSummary.bind(unifiedCartController));
router.patch("/line/:id", unifiedCartController.updateCartItem.bind(unifiedCartController));
router.delete("/line/:id", unifiedCartController.removeCartItem.bind(unifiedCartController));
router.delete("/clear", unifiedCartController.clearCart.bind(unifiedCartController));

export default router;
