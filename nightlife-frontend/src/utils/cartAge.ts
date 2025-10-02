/**
 * Cart age checking utilities
 * Checks if cart items are older than a specified time limit
 */

export interface CartAgeInfo {
  isOld: boolean;
  ageInMinutes: number;
  oldestItemDate: Date | null;
  newestItemDate: Date | null;
}

/**
 * Check if cart is older than the specified time limit
 * @param cartItems Array of cart items
 * @param maxAgeMinutes Maximum age in minutes (default: 30)
 * @returns CartAgeInfo object with age details
 */
export function checkCartAge(cartItems: { updatedAt?: string }[], maxAgeMinutes: number = 30): CartAgeInfo {
  if (!cartItems || cartItems.length === 0) {
    return {
      isOld: false,
      ageInMinutes: 0,
      oldestItemDate: null,
      newestItemDate: null
    };
  }

  // Get current time
  const now = new Date();
  
  // Find the oldest and newest items based on updatedAt
  let oldestDate: Date | null = null;
  let newestDate: Date | null = null;

  cartItems.forEach(item => {
    // Check if item has updatedAt timestamp (from backend)
    if (item.updatedAt) {
      const itemDate = new Date(item.updatedAt);
      
      if (!oldestDate || itemDate < oldestDate) {
        oldestDate = itemDate;
      }
      
      if (!newestDate || itemDate > newestDate) {
        newestDate = itemDate;
      }
    }
  });

  // If no timestamps found, assume cart is not old
  if (!oldestDate) {
    return {
      isOld: false,
      ageInMinutes: 0,
      oldestItemDate: null,
      newestItemDate: null
    };
  }

  // Calculate age in minutes
  const ageInMinutes = Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60));
  
  return {
    isOld: ageInMinutes > maxAgeMinutes,
    ageInMinutes,
    oldestItemDate: oldestDate,
    newestItemDate: newestDate
  };
}

/**
 * Format age in a human-readable way
 * @param ageInMinutes Age in minutes
 * @returns Formatted age string
 */
export function formatCartAge(ageInMinutes: number): string {
  if (ageInMinutes < 1) {
    return 'menos de 1 minuto';
  } else if (ageInMinutes < 60) {
    return `${ageInMinutes} minuto${ageInMinutes === 1 ? '' : 's'}`;
  } else {
    const hours = Math.floor(ageInMinutes / 60);
    const minutes = ageInMinutes % 60;
    
    if (minutes === 0) {
      return `${hours} hora${hours === 1 ? '' : 's'}`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  }
}

/**
 * Get a user-friendly warning message for old carts
 * @param ageInfo Cart age information
 * @returns Warning message string
 */
export function getCartAgeWarningMessage(ageInfo: CartAgeInfo): string {
  if (!ageInfo.isOld) {
    return '';
  }

  const ageText = formatCartAge(ageInfo.ageInMinutes);
  
  return `Tu carrito tiene ${ageText} de antigüedad. Los precios pueden haber cambiado. ¿Deseas continuar con la compra o vaciar el carrito para ver los precios actualizados?`;
}
