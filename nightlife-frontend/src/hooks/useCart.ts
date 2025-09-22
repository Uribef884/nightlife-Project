import { useCartStore } from '@/stores/cart.store';
import { useCallback } from 'react';

export function useCart() {
  const store = useCartStore();

  const addTicket = useCallback(async (
    ticketId: string, 
    date: string, 
    quantity: number = 1
  ) => {
    try {
      await store.addTicket(ticketId, date, quantity);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add ticket' 
      };
    }
  }, [store]);

  const addMenuItem = useCallback(async (
    menuItemId: string, 
    variantId: string | undefined, 
    date: string, 
    quantity: number = 1
  ) => {
    try {
      await store.addMenuItem(menuItemId, variantId, date, quantity);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add menu item' 
      };
    }
  }, [store]);

  const updateItemQuantity = useCallback(async (
    itemId: string, 
    quantity: number
  ) => {
    try {
      await store.updateQuantity(itemId, quantity);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update quantity' 
      };
    }
  }, [store]);

  const removeItem = useCallback(async (itemId: string) => {
    try {
      await store.removeItem(itemId);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to remove item' 
      };
    }
  }, [store]);

  const clearCart = useCallback(async () => {
    try {
      await store.clearCart();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear cart' 
      };
    }
  }, [store]);

  return {
    // State
    items: store.items,
    isLoading: store.isLoading,
    error: store.error,
    lastUpdated: store.lastUpdated,
    
    // Computed values
    itemCount: store.getItemCount(),
    cartSummary: store.getCartSummary(),
    ticketItems: store.getTicketItems(),
    menuItems: store.getMenuItems(),
    
    // Actions
    addTicket,
    addMenuItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    refreshCart: store.refreshCart,
    
    // Utilities
    getItemsByDate: store.getItemsByDate,
    setLoading: store.setLoading,
    setError: store.setError,
  };
}
