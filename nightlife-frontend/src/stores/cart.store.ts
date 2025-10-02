import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { API_BASE_CSR, joinUrl } from '@/lib/env';
import { checkCartAge, CartAgeInfo } from '@/utils/cartAge';

export interface CartItem {
  id: string;
  itemType: 'ticket' | 'menu';
  quantity: number;
  date: string;
  clubId: string;
  updatedAt?: string;
  
  // Ticket-specific
  ticketId?: string;
  ticket?: {
    id: string;
    name: string;
    price: number;
    category: 'general' | 'event' | 'free';
    description?: string;
    dynamicPricingEnabled: boolean;
    maxPerPerson: number;
    includesMenuItem: boolean;
  };
  
  // Menu-specific
  menuItemId?: string;
  variantId?: string;
  menuItem?: {
    id: string;
    name: string;
    price?: number;
    description?: string;
    imageUrl?: string;
    hasVariants: boolean;
    maxPerPerson?: number;
  };
  variant?: {
    id: string;
    name: string;
    price: number;
    maxPerPerson?: number;
  };
  
  // Pricing
  unitPrice: number;
  subtotal: number;
  dynamicPrice?: number;
  priceBreakdown?: {
    basePrice?: number;
    dynamicAdjustment?: number;
    discounts?: number;
    fees?: number;
    [key: string]: unknown;
  };
}

export interface CartSummary {
  items: CartItem[];
  ticketSubtotal: number;
  menuSubtotal: number;
  totalSubtotal: number;
  itemCount: number;
  clubId: string;
  // Server summary properties (from unified cart summary)
  total?: number;
  operationalCosts?: number;
  actualTotal?: number;
}

export interface CartState {
  // State
  items: CartItem[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  
  // Actions
  addTicket: (ticketId: string, date: string, quantity: number) => Promise<void>;
  addMenuItem: (menuItemId: string, variantId: string | undefined, date: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  
  // Optimistic updates (immediate UI updates)
  updateQuantityOptimistic: (itemId: string, quantity: number) => void;
  removeItemOptimistic: (itemId: string) => void;
  
  // Getters
  getCartSummary: () => CartSummary | null;
  getItemCount: () => number;
  getTicketItems: () => CartItem[];
  getMenuItems: () => CartItem[];
  getItemsByDate: (date: string) => CartItem[];
  
  // Utilities
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Cart age checking
  checkCartAge: (maxAgeMinutes?: number) => CartAgeInfo;
  isCartOld: (maxAgeMinutes?: number) => boolean;
  
  // Club validation
  checkClubConflict: (clubId: string) => { hasConflict: boolean; currentClubId?: string };
  getClubName: (clubId: string) => Promise<string>;
}

export const useCartStore = create<CartState>()(
  devtools(
    (set, get) => ({
      // Initial state
      items: [],
      isLoading: false,
      error: null,
      lastUpdated: null,

      // Add ticket to cart
      addTicket: async (ticketId: string, date: string, quantity: number) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(joinUrl(API_BASE_CSR, '/unified-cart/add'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              itemType: 'ticket',
              ticketId,
              date,
              quantity,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add ticket to cart');
          }

          // Refresh cart after adding
          await get().refreshCart();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add ticket to cart',
            isLoading: false 
          });
        }
      },

      // Add menu item to cart
      addMenuItem: async (menuItemId: string, variantId: string | undefined, date: string, quantity: number) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(joinUrl(API_BASE_CSR, '/unified-cart/add'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              itemType: 'menu',
              menuItemId,
              variantId,
              date,
              quantity,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add menu item to cart');
          }

          // Refresh cart after adding
          await get().refreshCart();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add menu item to cart',
            isLoading: false 
          });
        }
      },

      // Update item quantity
      updateQuantity: async (itemId: string, quantity: number) => {
        if (quantity <= 0) {
          await get().removeItem(itemId);
          return;
        }

        // Don't set isLoading for background sync to prevent UI flashing
        // set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(joinUrl(API_BASE_CSR, `/unified-cart/line/${itemId}`), {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({ quantity }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update quantity');
          }

          // Refresh cart from server to get updated breakdown with dynamic pricing
          await get().refreshCart();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update quantity'
          });
        }
      },

      // Remove item from cart
      removeItem: async (itemId: string) => {
        // Don't set isLoading for background sync to prevent UI flashing
        // set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(joinUrl(API_BASE_CSR, `/unified-cart/line/${itemId}`), {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to remove item');
          }

          // Refresh cart from server to get updated breakdown
          await get().refreshCart();
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to remove item'
          });
        }
      },

      // Clear entire cart
      clearCart: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch(joinUrl(API_BASE_CSR, '/unified-cart/clear'), {
            method: 'DELETE',
            credentials: 'include',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to clear cart');
          }

          set({ 
            items: [],
            isLoading: false,
            lastUpdated: new Date(),
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to clear cart',
            isLoading: false 
          });
        }
      },

      // Refresh cart from server
      refreshCart: async () => {
        set({ isLoading: true, error: null });
        
        try {
          // Fetch both cart items and summary in parallel (like test-cart.html)
          const [cartResponse, summaryResponse] = await Promise.all([
            fetch(joinUrl(API_BASE_CSR, '/unified-cart'), {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
              credentials: 'include',
            }),
            fetch(joinUrl(API_BASE_CSR, '/unified-cart/summary'), {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
              },
              credentials: 'include',
            })
          ]);

          if (!cartResponse.ok) {
            const errorData = await cartResponse.json();
            throw new Error(errorData.error || 'Failed to fetch cart');
          }

          const cartData = await cartResponse.json();
          
          // Store unified summary in window like test-cart.html does
          let summary = null;
          if (summaryResponse.ok) {
            summary = await summaryResponse.json();
          }
          
          // Store in window for CartSummary to use (exactly like test-cart.html)
          if (typeof window !== 'undefined') {
            (window as { cartSummaries?: { unified?: unknown } }).cartSummaries = {
              unified: summary
            };
          }
          
          // Local types for backend cart item data
          type BackendCartItem = {
            id: unknown;
            itemType: unknown;
            quantity: unknown;
            date: unknown;
            clubId: unknown;
            updatedAt?: unknown;
            ticketId?: unknown;
            ticket?: {
              id: unknown;
              name: unknown;
              price: unknown;
              category: unknown;
              description?: unknown;
              dynamicPricingEnabled?: unknown;
              maxPerPerson?: unknown;
              includesMenuItem?: unknown;
            };
            menuItemId?: unknown;
            variantId?: unknown;
            menuItem?: {
              id: unknown;
              name: unknown;
              price?: unknown;
              description?: unknown;
              imageUrl?: unknown;
              hasVariants?: unknown;
              maxPerPerson?: unknown;
            };
            variant?: {
              id: unknown;
              name: unknown;
              price: unknown;
              maxPerPerson?: unknown;
            };
            dynamicPrice?: unknown;
            priceBreakdown?: {
              basePrice?: unknown;
              dynamicAdjustment?: unknown;
              discounts?: unknown;
              fees?: unknown;
              [key: string]: unknown;
            };
          };

          // Transform server data to our format
          const items: CartItem[] = cartData.map((item: unknown) => {
            const backendItem = item as BackendCartItem;
            return {
            id: String(backendItem.id),
            itemType: String(backendItem.itemType) as 'ticket' | 'menu',
            quantity: Number(backendItem.quantity),
            date: String(backendItem.date),
            clubId: String(backendItem.clubId),
            updatedAt: backendItem.updatedAt ? String(backendItem.updatedAt) : undefined,
            
            // Ticket data
            ticketId: backendItem.ticketId ? String(backendItem.ticketId) : undefined,
            ticket: backendItem.ticket ? {
              id: String(backendItem.ticket.id),
              name: String(backendItem.ticket.name),
              price: Number(backendItem.ticket.price),
              category: String(backendItem.ticket.category) as 'general' | 'event' | 'free',
              description: backendItem.ticket.description ? String(backendItem.ticket.description) : undefined,
              dynamicPricingEnabled: Boolean(backendItem.ticket.dynamicPricingEnabled),
              maxPerPerson: Number(backendItem.ticket.maxPerPerson || 0),
              includesMenuItem: Boolean(backendItem.ticket.includesMenuItem),
            } : undefined,
            
            // Menu data
            menuItemId: backendItem.menuItemId ? String(backendItem.menuItemId) : undefined,
            variantId: backendItem.variantId ? String(backendItem.variantId) : undefined,
            menuItem: backendItem.menuItem ? {
              id: String(backendItem.menuItem.id),
              name: String(backendItem.menuItem.name),
              price: backendItem.menuItem.price ? Number(backendItem.menuItem.price) : undefined,
              description: backendItem.menuItem.description ? String(backendItem.menuItem.description) : undefined,
              imageUrl: backendItem.menuItem.imageUrl ? String(backendItem.menuItem.imageUrl) : undefined,
              hasVariants: Boolean(backendItem.menuItem.hasVariants),
              maxPerPerson: backendItem.menuItem.maxPerPerson ? Number(backendItem.menuItem.maxPerPerson) : undefined,
            } : undefined,
            variant: backendItem.variant ? {
              id: String(backendItem.variant.id),
              name: String(backendItem.variant.name),
              price: Number(backendItem.variant.price),
              maxPerPerson: backendItem.variant.maxPerPerson ? Number(backendItem.variant.maxPerPerson) : undefined,
            } : undefined,
            
            // Pricing
            unitPrice: String(backendItem.itemType) === 'ticket' 
              ? (backendItem.ticket ? Number(backendItem.ticket.price) : 0)
              : (backendItem.variant ? Number(backendItem.variant.price) : (backendItem.menuItem ? Number(backendItem.menuItem.price || 0) : 0)),
            subtotal: Number(backendItem.quantity) * (String(backendItem.itemType) === 'ticket' 
              ? (backendItem.ticket ? Number(backendItem.ticket.price) : 0)
              : (backendItem.variant ? Number(backendItem.variant.price) : (backendItem.menuItem ? Number(backendItem.menuItem.price || 0) : 0))),
            dynamicPrice: backendItem.dynamicPrice ? Number(backendItem.dynamicPrice) : undefined,
            priceBreakdown: backendItem.priceBreakdown ? {
              basePrice: backendItem.priceBreakdown.basePrice ? Number(backendItem.priceBreakdown.basePrice) : undefined,
              dynamicAdjustment: backendItem.priceBreakdown.dynamicAdjustment ? Number(backendItem.priceBreakdown.dynamicAdjustment) : undefined,
              discounts: backendItem.priceBreakdown.discounts ? Number(backendItem.priceBreakdown.discounts) : undefined,
              fees: backendItem.priceBreakdown.fees ? Number(backendItem.priceBreakdown.fees) : undefined,
              ...Object.fromEntries(
                Object.entries(backendItem.priceBreakdown).filter(([key]) => 
                  !['basePrice', 'dynamicAdjustment', 'discounts', 'fees'].includes(key)
                )
              )
            } : undefined,
          };
          });

          set({ 
            items,
            isLoading: false,
            lastUpdated: new Date(),
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to refresh cart',
            isLoading: false 
          });
        }
      },

      // Get cart summary
      getCartSummary: () => {
        const { items } = get();
        if (items.length === 0) return null;

        const ticketSubtotal = items
          .filter(item => item.itemType === 'ticket')
          .reduce((sum, item) => sum + item.subtotal, 0);
        
        const menuSubtotal = items
          .filter(item => item.itemType === 'menu')
          .reduce((sum, item) => sum + item.subtotal, 0);

        const totalSubtotal = ticketSubtotal + menuSubtotal;
        const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
        const clubId = items[0]?.ticket?.id || items[0]?.menuItem?.id || '';

        return {
          items,
          ticketSubtotal,
          menuSubtotal,
          totalSubtotal,
          itemCount,
          clubId,
        };
      },

      // Get item count
      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // Get ticket items only
      getTicketItems: () => {
        return get().items.filter(item => item.itemType === 'ticket');
      },

      // Get menu items only
      getMenuItems: () => {
        return get().items.filter(item => item.itemType === 'menu');
      },

      // Get items by date
      getItemsByDate: (date: string) => {
        return get().items.filter(item => item.date === date);
      },

      // Set loading state
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      // Set error state
      setError: (error: string | null) => {
        set({ error });
      },

      // Check for club conflicts
      checkClubConflict: (clubId: string) => {
        const items = get().items;
        if (items.length === 0) {
          return { hasConflict: false };
        }
        
        const currentClubId = items[0].clubId;
        const hasConflict = currentClubId !== clubId;
        
        return { 
          hasConflict, 
          currentClubId: hasConflict ? currentClubId : undefined 
        };
      },

      // Get club name by ID
      getClubName: async (clubId: string) => {
        try {
          const response = await fetch(`${API_BASE_CSR}/clubs/${clubId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch club');
          }
          const club = await response.json();
          return club.name || `Club ${clubId}`;
        } catch (error) {
          console.error('Error fetching club name:', error);
          return `Club ${clubId}`;
        }
      },

      // Optimistic updates (immediate UI updates without API calls)
      updateQuantityOptimistic: (itemId: string, quantity: number) => {
        set(state => {
          const updatedItems = state.items.map(item => 
            item.id === itemId 
              ? { ...item, quantity, subtotal: item.unitPrice * quantity }
              : item
          );
          
          return {
            items: updatedItems,
            lastUpdated: new Date(),
          };
        });
      },

      removeItemOptimistic: (itemId: string) => {
        set(state => {
          const updatedItems = state.items.filter(item => item.id !== itemId);
          
          return {
            items: updatedItems,
            lastUpdated: new Date(),
          };
        });
      },

      // Cart age checking
      checkCartAge: (maxAgeMinutes: number = 30) => {
        const state = get();
        return checkCartAge(state.items, maxAgeMinutes);
      },

      isCartOld: (maxAgeMinutes: number = 30) => {
        const state = get();
        return checkCartAge(state.items, maxAgeMinutes).isOld;
      },
    }),
    {
      name: 'cart-store',
    }
  )
);
