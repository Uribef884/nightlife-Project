import { AppDataSource } from "../config/data-source";
import { UnifiedCartItem } from "../entities/UnifiedCartItem";

// In-memory store for cart locks (in production, use Redis)
const cartLocks = new Map<string, {
  lockedAt: number;
  transactionId: string;
  expiresAt: number;
  cartType: 'unified';
}>();

const LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes

/**
 * Locks a cart to prevent modifications during payment processing
 */
export const lockCart = (userId: string | null, sessionId: string | null | undefined, transactionId: string, cartType: 'unified'): boolean => {
  const lockKey = getLockKey(userId, sessionId);
  
  // Check if cart is already locked
  if (cartLocks.has(lockKey)) {
    const existingLock = cartLocks.get(lockKey)!;
    
    // If lock is expired, remove it and allow new lock
    if (Date.now() > existingLock.expiresAt) {
      cartLocks.delete(lockKey);
    } else {
      // Cart is still locked by another transaction
      return false;
    }
  }
  
  // Create new lock
  cartLocks.set(lockKey, {
    lockedAt: Date.now(),
    transactionId,
    expiresAt: Date.now() + LOCK_TIMEOUT,
    cartType
  });
  
  console.log(`[CART-LOCK] 🔒 Cart locked for ${cartType} checkout: ${lockKey} | Transaction: ${transactionId}`);
  return true;
};

/**
 * Updates the transaction ID for an existing cart lock
 */
export const updateCartLockTransactionId = (userId: string | null, sessionId: string | null | undefined, newTransactionId: string): boolean => {
  const lockKey = getLockKey(userId, sessionId);
  
  if (!cartLocks.has(lockKey)) {
    return false;
  }
  
  const lock = cartLocks.get(lockKey)!;
  lock.transactionId = newTransactionId;
  
  console.log(`[CART-LOCK] 🔄 Updated cart lock transaction ID: ${lockKey} | Old: ${lock.transactionId} | New: ${newTransactionId}`);
  return true;
};

/**
 * Unlocks a cart after payment processing is complete
 */
export const unlockCart = (userId: string | null, sessionId: string | null | undefined): boolean => {
  // If both are null/undefined, we can't unlock anything
  if (!userId && !sessionId) {
    console.warn(`[CART-LOCK] ⚠️ Cannot unlock cart: both userId and sessionId are null/undefined`);
    return false;
  }
  
  try {
    const lockKey = getLockKey(userId, sessionId);
    
    if (cartLocks.has(lockKey)) {
      const lock = cartLocks.get(lockKey)!;
      cartLocks.delete(lockKey);
      console.log(`[CART-LOCK] 🔓 Cart unlocked: ${lockKey} | Was locked for: ${lock.cartType} | Transaction: ${lock.transactionId}`);
      return true;
    }
    
    console.log(`[CART-LOCK] No lock found for key: ${lockKey}`);
    return false;
  } catch (error) {
    console.error(`[CART-LOCK] ❌ Error unlocking cart:`, error);
    return false;
  }
};

/**
 * Checks if a cart is currently locked
 */
export const isCartLocked = (userId: string | null, sessionId: string | null | undefined): boolean => {
  const lockKey = getLockKey(userId, sessionId);
  
  if (!cartLocks.has(lockKey)) {
    return false;
  }
  
  const lock = cartLocks.get(lockKey)!;
  
  // Check if lock is expired
  if (Date.now() > lock.expiresAt) {
    cartLocks.delete(lockKey);
    return false;
  }
  
  return true;
};

/**
 * Smart cart lock check that auto-unlocks empty carts
 */
export const isCartLockedSmart = async (
  userId: string | null, 
  sessionId: string | null | undefined, 
  cartType: 'unified'
): Promise<boolean> => {
  // First check if cart is locked normally
  if (!isCartLocked(userId, sessionId)) {
    return false;
  }
  
  // If locked, check if cart is empty and auto-unlock if needed
  await autoUnlockEmptyCart(userId, sessionId, cartType);
  
  // Check again after potential auto-unlock
  return isCartLocked(userId, sessionId);
};

/**
 * Gets the lock information for a cart
 */
export const getCartLockInfo = (userId: string | null, sessionId: string | null | undefined) => {
  const lockKey = getLockKey(userId, sessionId);
  return cartLocks.get(lockKey);
};

/**
 * Cleans up expired locks
 */
export const cleanupExpiredLocks = (): void => {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  for (const [key, lock] of cartLocks.entries()) {
    if (now > lock.expiresAt) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => {
    const lock = cartLocks.get(key)!;
    console.log(`[CART-LOCK] 🧹 Cleaning up expired lock: ${key} | Transaction: ${lock.transactionId}`);
    cartLocks.delete(key);
  });
  
  if (expiredKeys.length > 0) {
    console.log(`[CART-LOCK] 🧹 Cleaned up ${expiredKeys.length} expired locks`);
  }
};

/**
 * Gets a unique lock key for a user/session combination
 */
const getLockKey = (userId: string | null, sessionId: string | null | undefined): string => {
  if (userId) {
    return `user:${userId}`;
  }
  if (sessionId) {
    return `session:${sessionId}`;
  }
  // If both are null/undefined, we can't generate a key - this shouldn't happen in normal flow
  console.warn(`[CART-LOCK] Warning: Both userId and sessionId are null/undefined. Cannot generate lock key.`);
  return `unknown:${Date.now()}`; // Fallback key that won't match any existing locks
};

/**
 * Automatically unlocks a cart if it's empty (previous transaction completed)
 */
export const autoUnlockEmptyCart = async (
  userId: string | null, 
  sessionId: string | null | undefined, 
  cartType: 'unified'
): Promise<boolean> => {
  try {
    const cartRepo = AppDataSource.getRepository(UnifiedCartItem);
    
    const whereClause = userId ? { userId } : sessionId ? { sessionId } : null;
    if (!whereClause) return false;
    
    const cartItems = await cartRepo.find({ where: whereClause });
    
    // If cart is empty, unlock it automatically
    if (cartItems.length === 0) {
      const unlockSuccess = unlockCart(userId, sessionId);
      if (unlockSuccess) {
        console.log(`[CART-LOCK] 🔓 Auto-unlocked empty cart for ${userId ? 'user' : 'session'}: ${userId || sessionId}`);
      }
      return unlockSuccess;
    }
    
    return false; // Cart not empty, don't unlock
  } catch (error) {
    console.error(`[CART-LOCK] ❌ Error checking cart emptiness:`, error);
    return false;
  }
};

/**
 * Locks a cart and validates it's still valid before proceeding
 */
export const lockAndValidateCart = async (
  userId: string | null, 
  sessionId: string | null | undefined, 
  transactionId: string, 
  cartType: 'unified'
): Promise<{ success: boolean; error?: string; cartItems?: any[] }> => {
  // First, check if cart is empty and auto-unlock if needed
  const wasUnlocked = await autoUnlockEmptyCart(userId, sessionId, cartType);
  if (wasUnlocked) {
    console.log(`[CART-LOCK] 🔓 Cart was auto-unlocked due to emptiness, proceeding with new transaction`);
  }
  
  // Now try to lock the cart
  if (!lockCart(userId, sessionId, transactionId, cartType)) {
    return { 
      success: false, 
      error: "Cart is currently being processed by another transaction. Please wait or try again." 
    };
  }
  
  try {
    // Validate cart contents haven't changed since lock
    const cartRepo = AppDataSource.getRepository(UnifiedCartItem);
    
    const where = userId !== null ? { userId } : sessionId !== null && sessionId !== undefined ? { sessionId } : undefined;
    if (!where) {
      unlockCart(userId, sessionId);
      return { success: false, error: "Missing session or user" };
    }
    
    const cartItems = await cartRepo.find({
      where,
      relations: ["ticket", "ticket.club", "ticket.event", "menuItem", "variant", "menuItem.club"]
    });
    
    if (!cartItems.length) {
      unlockCart(userId, sessionId);
      return { success: false, error: "Cart is empty" };
    }
    
    // Check cart expiration
    const oldest = cartItems.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
    const age = Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / (1000 * 60));
    
    if (age > 30) {
      unlockCart(userId, sessionId);
      return { success: false, error: "Cart expired. Please start over." };
    }
    
    return { success: true, cartItems };
    
  } catch (error) {
    // If validation fails, unlock the cart
    unlockCart(userId, sessionId);
    console.error(`[CART-LOCK] Error validating cart:`, error);
    return { success: false, error: "Failed to validate cart contents" };
  }
};

// Set up periodic cleanup of expired locks
setInterval(cleanupExpiredLocks, 5 * 60 * 1000); // Every 5 minutes

/**
 * Debug function to check cart lock status (for troubleshooting)
 */
export const debugCartLocks = () => {
  const now = Date.now();
  const locks = Array.from(cartLocks.entries()).map(([key, lock]) => ({
    key,
    lockedAt: new Date(lock.lockedAt).toISOString(),
    expiresAt: new Date(lock.expiresAt).toISOString(),
    transactionId: lock.transactionId,
    cartType: lock.cartType,
    isExpired: now > lock.expiresAt,
    ageMinutes: Math.floor((now - lock.lockedAt) / (1000 * 60))
  }));
  
  console.log(`[CART-LOCK-DEBUG] Current locks:`, locks);
  return locks;
};

/**
 * Debug function to check if a specific cart is locked
 */
export const debugCartLockStatus = (userId: string | null, sessionId: string | null | undefined) => {
  const lockKey = getLockKey(userId, sessionId);
  const lock = cartLocks.get(lockKey);
  const now = Date.now();
  
  console.log(`[CART-LOCK-DEBUG] 🔍 Checking lock status for key: ${lockKey}`, {
    userId,
    sessionId,
    isLocked: !!lock,
    lockDetails: lock ? {
      lockedAt: new Date(lock.lockedAt).toISOString(),
      expiresAt: new Date(lock.expiresAt).toISOString(),
      transactionId: lock.transactionId,
      cartType: lock.cartType,
      ageMinutes: Math.floor((now - lock.lockedAt) / (1000 * 60))
    } : null
  });
  
  return lock;
};
