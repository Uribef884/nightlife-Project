'use client';

import React, { useEffect } from 'react';
import { useCartStore } from '@/stores/cart.store';

interface CartProviderProps {
  children: React.ReactNode;
}

export default function CartProvider({ children }: CartProviderProps) {
  const { refreshCart } = useCartStore();

  // Initialize cart on mount
  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  return <>{children}</>;
}
