import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { API_BASE_CSR, joinUrl } from '@/lib/env';

export interface CartItem {
  id: string;
  itemType: 'ticket' | 'menu';
  quantity: number;
  date: string;
  clubId: string;
  
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
  priceBreakdown?: any;
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

          // Update local state (no need to set isLoading since we didn't set it)
          set(state => ({
            items: state.items.map(item => 
              item.id === itemId 
                ? { ...item, quantity, subtotal: item.unitPrice * quantity }
                : item
            ),
            lastUpdated: new Date(),
          }));
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

          // Update local state (no need to set isLoading since we didn't set it)
          set(state => ({
            items: state.items.filter(item => item.id !== itemId),
            lastUpdated: new Date(),
          }));
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
            (window as any).cartSummaries = {
              unified: summary
            };
          }
          
          // Transform server data to our format
          const items: CartItem[] = cartData.map((item: any) => ({
            id: item.id,
            itemType: item.itemType,
            quantity: item.quantity,
            date: item.date,
            clubId: item.clubId,
            
            // Ticket data
            ticketId: item.ticketId,
            ticket: item.ticket ? {
              id: item.ticket.id,
              name: item.ticket.name,
              price: item.ticket.price,
              category: item.ticket.category,
              description: item.ticket.description,
              dynamicPricingEnabled: item.ticket.dynamicPricingEnabled,
              maxPerPerson: item.ticket.maxPerPerson,
              includesMenuItem: item.ticket.includesMenuItem,
            } : undefined,
            
            // Menu data
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            menuItem: item.menuItem ? {
              id: item.menuItem.id,
              name: item.menuItem.name,
              price: item.menuItem.price,
              description: item.menuItem.description,
              imageUrl: item.menuItem.imageUrl,
              hasVariants: item.menuItem.hasVariants,
              maxPerPerson: item.menuItem.maxPerPerson,
            } : undefined,
            variant: item.variant ? {
              id: item.variant.id,
              name: item.variant.name,
              price: item.variant.price,
              maxPerPerson: item.variant.maxPerPerson,
            } : undefined,
            
            // Pricing
            unitPrice: item.itemType === 'ticket' 
              ? (item.ticket?.price || 0)
              : (item.variant?.price || item.menuItem?.price || 0),
            subtotal: item.quantity * (item.itemType === 'ticket' 
              ? (item.ticket?.price || 0)
              : (item.variant?.price || item.menuItem?.price || 0)),
            dynamicPrice: item.dynamicPrice,
            priceBreakdown: item.priceBreakdown,
          }));

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
    }),
    {
      name: 'cart-store',
    }
  )
);
