import { Response } from "express";
import { AuthenticatedRequest } from "../types/express";
import { UnifiedCartService } from "../services/unifiedCart.service";
import { isCartLockedSmart } from "../utils/cartLock";

export class UnifiedCartController {
  private cartService = new UnifiedCartService();

  /**
   * Add item to unified cart (ticket or menu)
   * POST /unified-cart/add
   */
  addToCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { itemType, ticketId, date, menuItemId, variantId, quantity } = req.body;
      const userId = req.user?.id;
      const sessionId = !userId && req.sessionId ? req.sessionId : undefined;

      // Check if cart is locked
      const isLocked = await isCartLockedSmart(userId || null, sessionId || null, 'unified');
      if (isLocked) {
        res.status(423).json({ 
          error: "Cart is currently being processed. Please wait for your payment to complete before adding more items." 
        });
        return;
      }

      let cartItem;

      if (itemType === 'ticket') {
        // Validate ticket input
        if (!ticketId || !date || quantity == null || quantity <= 0) {
          res.status(400).json({ error: "Missing or invalid fields for ticket: ticketId, date, and quantity are required" });
          return;
        }

        cartItem = await this.cartService.addTicketToCart(
          { ticketId, date, quantity },
          userId,
          sessionId
        );
      } else if (itemType === 'menu') {
        // Validate menu input
        if (!menuItemId || quantity == null || quantity <= 0 || !date) {
          res.status(400).json({ error: "Missing or invalid fields for menu: menuItemId, quantity, and date are required" });
          return;
        }

        cartItem = await this.cartService.addMenuToCart(
          { menuItemId, variantId, quantity, date },
          userId,
          sessionId
        );
      } else {
        res.status(400).json({ error: "Invalid itemType. Must be 'ticket' or 'menu'" });
        return;
      }

      res.status(201).json(cartItem);
    } catch (err) {
      console.error("❌ Error adding item to unified cart:", err);
      res.status(400).json({ error: err instanceof Error ? err.message : "Server error adding item" });
    }
  };

  /**
   * Update cart item quantity
   * PATCH /unified-cart/line/:id
   */
  updateCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const userId = req.user?.id;
      const sessionId = !userId && req.sessionId ? req.sessionId : undefined;

      // Validate input
      if (!id || typeof quantity !== "number" || quantity <= 0) {
        res.status(400).json({ error: "Valid ID and quantity are required" });
        return;
      }

      // Check if cart is locked
      const isLocked = await isCartLockedSmart(userId || null, sessionId || null, 'unified');
      if (isLocked) {
        res.status(423).json({ 
          error: "Cart is currently being processed. Please wait for your payment to complete before modifying items." 
        });
        return;
      }

      const cartItem = await this.cartService.updateCartItemQuantity(
        id,
        quantity,
        userId,
        sessionId
      );

      res.status(200).json(cartItem);
    } catch (err) {
      console.error("❌ Error updating unified cart item:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Server error updating item" });
    }
  };

  /**
   * Remove cart item
   * DELETE /unified-cart/line/:id
   */
  removeCartItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;
      const sessionId = !userId && req.sessionId ? req.sessionId : undefined;

      // Validate input
      if (!id) {
        res.status(400).json({ error: "Valid ID is required" });
        return;
      }

      // Check if cart is locked
      const isLocked = await isCartLockedSmart(userId || null, sessionId || null, 'unified');
      if (isLocked) {
        res.status(423).json({ 
          error: "Cart is currently being processed. Please wait for your payment to complete before removing items." 
        });
        return;
      }

      await this.cartService.removeCartItem(id, userId, sessionId);
      res.status(204).send();
    } catch (err) {
      console.error("❌ Error removing unified cart item:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Server error removing item" });
    }
  };

  /**
   * Get unified cart items
   * GET /unified-cart
   */
  getCartItems = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const sessionId = !userId && req.sessionId ? req.sessionId : undefined;

      const cartItems = await this.cartService.getCartItemsWithDynamicPricing(userId, sessionId);
      res.status(200).json(cartItems);
    } catch (err) {
      console.error("❌ Error fetching unified cart items:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  /**
   * Get cart summary with totals
   * GET /unified-cart/summary
   */
  getCartSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const sessionId = !userId && req.sessionId ? req.sessionId : undefined;

      const summary = await this.cartService.calculateCartSummary(userId, sessionId);
      res.status(200).json(summary);
    } catch (err) {
      console.error("❌ Error fetching unified cart summary:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };

  /**
   * Clear unified cart
   * DELETE /unified-cart/clear
   */
  clearCart = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const sessionId = !userId && req.sessionId ? req.sessionId : undefined;

      await this.cartService.clearCart(userId, sessionId);
      res.status(204).send();
    } catch (err) {
      console.error("❌ Error clearing unified cart:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

// Export controller instance
export const unifiedCartController = new UnifiedCartController();
