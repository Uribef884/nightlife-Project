'use client';

import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { useCart } from '@/hooks/useCart';

interface CartContextType {
  // State
  items: ReturnType<typeof useCart>['items'];
  isLoading: ReturnType<typeof useCart>['isLoading'];
  error: ReturnType<typeof useCart>['error'];
  lastUpdated: ReturnType<typeof useCart>['lastUpdated'];
  
  // Computed values
  itemCount: ReturnType<typeof useCart>['itemCount'];
  cartSummary: ReturnType<typeof useCart>['cartSummary'];
  ticketItems: ReturnType<typeof useCart>['ticketItems'];
  menuItems: ReturnType<typeof useCart>['menuItems'];
  
  // Actions
  addTicket: ReturnType<typeof useCart>['addTicket'];
  addMenuItem: ReturnType<typeof useCart>['addMenuItem'];
  updateItemQuantity: ReturnType<typeof useCart>['updateItemQuantity'];
  removeItem: ReturnType<typeof useCart>['removeItem'];
  clearCart: ReturnType<typeof useCart>['clearCart'];
  refreshCart: ReturnType<typeof useCart>['refreshCart'];
  
  // Utilities
  getItemsByDate: ReturnType<typeof useCart>['getItemsByDate'];
  setLoading: ReturnType<typeof useCart>['setLoading'];
  setError: ReturnType<typeof useCart>['setError'];
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const cart = useCart();
  const { refreshCart } = cart;

  // Refresh cart on mount to get any existing items and handle expiration
  useEffect(() => {
    refreshCart().catch(error => {
      console.warn('Failed to refresh cart on mount:', error);
      // Don't show error to user, just log it
    });
  }, [refreshCart]); // Include refreshCart in dependencies

  return (
    <CartContext.Provider value={cart}>
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCartContext must be used within a CartProvider');
  }
  return context;
}
