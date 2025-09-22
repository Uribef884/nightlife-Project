import { useCallback } from 'react';
import { useCartContext } from '@/contexts/CartContext';
import { useClubProtection } from './useClubProtection';

interface UseCartItemProps {
  itemType: 'ticket' | 'menu';
  itemId: string;
  variantId?: string;
  date?: string;
  maxPerPerson?: number;
  clubId?: string;
  clubName?: string;
}

interface CartItemInfo {
  quantity: number;
  cartItemId: string | null;
  isInCart: boolean;
  canIncrease: boolean;
  canDecrease: boolean;
}

export function useCartItem({
  itemType,
  itemId,
  variantId,
  date,
  maxPerPerson = Infinity,
  clubId,
  clubName,
}: UseCartItemProps) {
  const { items, addTicket, addMenuItem, updateItemQuantity, removeItem } = useCartContext();
  
  // Club protection (only if clubId is provided)
  const clubProtection = useClubProtection({ 
    clubId: clubId || '', 
    clubName 
  });

  // Find the cart item for this specific item
  const cartItem = items.find(item => {
    if (item.itemType !== itemType) return false;
    
    if (itemType === 'ticket') {
      return item.ticketId === itemId && (!date || item.date === date);
    } else {
      return item.menuItemId === itemId && 
             (!variantId || item.variantId === variantId) &&
             (!date || item.date === date);
    }
  });

  const cartItemInfo: CartItemInfo = {
    quantity: cartItem?.quantity || 0,
    cartItemId: cartItem?.id || null,
    isInCart: !!cartItem,
    canIncrease: (cartItem?.quantity || 0) < maxPerPerson,
    canDecrease: (cartItem?.quantity || 0) > 0,
  };

  const addToCart = useCallback(async (quantity: number = 1) => {
    if (!date) {
      throw new Error('Date is required to add item to cart');
    }

    const addFunction = async () => {
      if (itemType === 'ticket') {
        await addTicket(itemId, date, quantity);
      } else {
        await addMenuItem(itemId, variantId, date, quantity);
      }
    };

    // Use club protection if clubId is provided
    if (clubId) {
      await clubProtection.handleAddWithProtection(addFunction);
    } else {
      await addFunction();
    }
  }, [itemType, itemId, variantId, date, addTicket, addMenuItem, clubId, clubProtection]);

  const updateQuantity = useCallback(async (newQuantity: number) => {
    if (!cartItemInfo.cartItemId) {
      throw new Error('Item not in cart');
    }

    if (newQuantity <= 0) {
      await removeItem(cartItemInfo.cartItemId);
    } else {
      await updateItemQuantity(cartItemInfo.cartItemId, newQuantity);
    }
  }, [cartItemInfo.cartItemId, removeItem, updateItemQuantity]);

  const increaseQuantity = useCallback(async () => {
    if (!cartItemInfo.isInCart) {
      await addToCart(1);
    } else if (cartItemInfo.canIncrease) {
      await updateQuantity(cartItemInfo.quantity + 1);
    }
  }, [cartItemInfo.isInCart, cartItemInfo.canIncrease, cartItemInfo.quantity, addToCart, updateQuantity]);

  const decreaseQuantity = useCallback(async () => {
    if (cartItemInfo.canDecrease) {
      await updateQuantity(cartItemInfo.quantity - 1);
    }
  }, [cartItemInfo.canDecrease, cartItemInfo.quantity, updateQuantity]);

  const removeFromCart = useCallback(async () => {
    if (cartItemInfo.cartItemId) {
      await removeItem(cartItemInfo.cartItemId);
    }
  }, [cartItemInfo.cartItemId, removeItem]);

  return {
    ...cartItemInfo,
    addToCart,
    updateQuantity,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    // Club protection modal state (only available if clubId is provided)
    showClubModal: clubId ? clubProtection.showClubModal : false,
    currentClubName: clubId ? clubProtection.currentClubName : undefined,
    handleClearCartAndClose: clubId ? clubProtection.handleClearCartAndClose : undefined,
    handleCancelClubChange: clubId ? clubProtection.handleCancelClubChange : undefined,
  };
}
