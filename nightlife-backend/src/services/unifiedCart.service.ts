import { AppDataSource } from '../config/data-source';
import { UnifiedCartItem } from '../entities/UnifiedCartItem';
import { Ticket, TicketCategory } from '../entities/Ticket';
import { MenuItem } from '../entities/MenuItem';
import { MenuItemVariant } from '../entities/MenuItemVariant';
import { computeDynamicPrice, computeDynamicEventPrice } from '../utils/dynamicPricing';
import { calculateFeeAllocation } from '../utils/feeAllocation';

export interface AddTicketToCartInput {
  ticketId: string;
  date: string; // YYYY-MM-DD
  quantity: number;
}

export interface AddMenuToCartInput {
  menuItemId: string;
  variantId?: string;
  quantity: number;
}

export interface CartValidationResult {
  success: boolean;
  error?: string;
  cartItems?: UnifiedCartItem[];
}

export class UnifiedCartService {
  private cartRepo = AppDataSource.getRepository(UnifiedCartItem);
  private ticketRepo = AppDataSource.getRepository(Ticket);
  private menuItemRepo = AppDataSource.getRepository(MenuItem);
  private variantRepo = AppDataSource.getRepository(MenuItemVariant);

  /**
   * Add a ticket to the unified cart
   */
  async addTicketToCart(
    input: AddTicketToCartInput,
    userId?: string,
    sessionId?: string
  ): Promise<UnifiedCartItem> {
    const { ticketId, date, quantity } = input;

    // Validate ownership
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    // Get existing cart items for validation
    const existingItems = await this.getCartItems(userId, sessionId);

    // Get ticket with relations
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['club', 'event']
    });

    if (!ticket || !ticket.isActive) {
      throw new Error('Ticket not found or inactive');
    }

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Validate date - use UTC for consistent validation regardless of server location
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (date < todayStr) {
      throw new Error('Cannot select a past date');
    }

    // Validate ticket availability and sold out status
    if (ticket.quantity != null) {
      const allCartItems = await this.cartRepo.find({
        where: userId ? { userId } : { sessionId },
        relations: ['ticket'],
      });

      const otherCartQuantity = allCartItems
        .filter(c => c.ticket?.id === ticket.id && c.date && 
          (c.date instanceof Date ? c.date.toISOString().split('T')[0] : String(c.date).split('T')[0]) === date && 
          c.itemType === 'ticket')
        .reduce((sum, c) => sum + c.quantity, 0);

      if (otherCartQuantity + quantity > ticket.quantity) {
        const remaining = ticket.quantity - otherCartQuantity;
        throw new Error(`Only ${remaining} tickets are available for this event`);
      }
    }

    // Validate maxPerPerson
    if (quantity > ticket.maxPerPerson) {
      throw new Error(`Cannot exceed maximum of ${ticket.maxPerPerson} tickets per person`);
    }

    // Check for existing ticket in cart and validate total quantity
    console.log(`[UNIFIED-CART] Looking for existing ticket item:`, {
      ticketId,
      date,
      existingItemsCount: existingItems.length,
      existingItems: existingItems.map(item => ({
        id: item.id,
        itemType: item.itemType,
        ticketId: item.ticketId,
        date: item.date,
        quantity: item.quantity
      }))
    });

    const existingTicketItem = existingItems.find(
      item => {
        if (item.itemType !== 'ticket' || item.ticketId !== ticketId) return false;
        if (!item.date) return false;
        
        // Handle both string and Date types for existing items
        const itemDate = item.date instanceof Date ? 
          item.date.toISOString().split('T')[0] : 
          String(item.date).split('T')[0];
        
        // Normalize both dates to YYYY-MM-DD format
        const normalizedItemDate = itemDate;
        const normalizedNewDate = date;
        
        // Debug logging
        console.log(`[UNIFIED-CART] Checking existing item:`, {
          itemId: item.id,
          itemTicketId: item.ticketId,
          newTicketId: ticketId,
          itemDate,
          newDate: date,
          normalizedItemDate,
          normalizedNewDate,
          itemDateType: typeof item.date,
          newDateType: typeof date,
          matches: normalizedItemDate === normalizedNewDate
        });
        
        return normalizedItemDate === normalizedNewDate;
      }
    );

    // Validate specific ticket type rules
    await this.validateTicketTypeRules(ticket, date, existingItems);

    // Validate cart consistency
    await this.validateCartConsistency(existingItems, ticket.clubId, date, 'ticket', ticket.category);

    if (existingTicketItem) {
      console.log(`[UNIFIED-CART] Found existing ticket item, updating quantity:`, {
        currentQuantity: existingTicketItem.quantity,
        addingQuantity: quantity,
        newTotal: existingTicketItem.quantity + quantity
      });
      
      const newTotal = existingTicketItem.quantity + quantity;
      if (newTotal > ticket.maxPerPerson) {
        throw new Error(`Cannot exceed maximum of ${ticket.maxPerPerson} tickets per person`);
      }
      
      existingTicketItem.quantity += quantity;
      return await this.cartRepo.save(existingTicketItem);
    } else {
      console.log(`[UNIFIED-CART] No existing ticket item found, creating new one`);
      
      // Create new cart item - store date as string to match legacy cart behavior
      console.log(`[UNIFIED-CART] Creating new item with date:`, {
        inputDate: date,
        storingAsString: true
      });
      
      const newItem = this.cartRepo.create({
        itemType: 'ticket' as const,
        ticketId,
        date: date, // Store as string, not Date object
        quantity,
        clubId: ticket.clubId,
        userId: userId || undefined,
        sessionId: sessionId || undefined
      });

      const savedItem = await this.cartRepo.save(newItem);
      return Array.isArray(savedItem) ? savedItem[0] : savedItem;
    }
  }

  /**
   * Add a menu item to the unified cart
   */
  async addMenuToCart(
    input: AddMenuToCartInput,
    userId?: string,
    sessionId?: string
  ): Promise<UnifiedCartItem> {
    const { menuItemId, variantId, quantity } = input;

    // Validate ownership
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Get existing cart items for validation
    const existingItems = await this.getCartItems(userId, sessionId);

    // Get menu item with relations
    const menuItem = await this.menuItemRepo.findOne({
      where: { id: menuItemId },
      relations: ['variants', 'club']
    });

    if (!menuItem) {
      throw new Error('Menu item not found');
    }

    // Validate menu item is active
    if (!menuItem.isActive) {
      throw new Error('Menu item is not active');
    }

    // Validate club is in structured menu mode
    if (menuItem.club.menuType !== 'structured') {
      throw new Error('Club must be in structured menu mode to add menu items');
    }

    // Validate variant requirements
    if (menuItem.hasVariants && !variantId) {
      throw new Error('Variant is required for this menu item');
    }
    
    if (!menuItem.hasVariants && variantId) {
      throw new Error('This menu item does not have variants');
    }

    // Validate variant if provided
    let selectedVariant = null;
    if (variantId) {
      selectedVariant = menuItem.variants.find(v => v.id === variantId);
      if (!selectedVariant) {
        throw new Error('Menu variant not found');
      }
    }

    // Validate cart consistency
    await this.validateCartConsistency(existingItems, menuItem.clubId, undefined, 'menu');

    // Check for existing menu item in cart
    const existingMenuItem = existingItems.find(
      item => item.itemType === 'menu' && 
               item.menuItemId === menuItemId && 
               item.variantId === (variantId || null)
    );

    if (existingMenuItem) {
      const newTotal = existingMenuItem.quantity + quantity;
      
      // Check maxPerPerson
      const maxPerPerson = selectedVariant?.maxPerPerson || menuItem.maxPerPerson;
      if (maxPerPerson && newTotal > maxPerPerson) {
        throw new Error(`Max per person for this item is ${maxPerPerson}`);
      }

      existingMenuItem.quantity = newTotal;
      return await this.cartRepo.save(existingMenuItem);
    } else {
      // Validate maxPerPerson for new item
      const maxPerPerson = selectedVariant?.maxPerPerson || menuItem.maxPerPerson;
      if (maxPerPerson && quantity > maxPerPerson) {
        throw new Error(`Max per person for this item is ${maxPerPerson}`);
      }

      // Create new cart item
      const newItem = this.cartRepo.create({
        itemType: 'menu' as const,
        menuItemId,
        variantId: variantId || undefined,
        quantity,
        clubId: menuItem.clubId,
        userId: userId || undefined,
        sessionId: sessionId || undefined
      });

      const savedItem = await this.cartRepo.save(newItem);
      return Array.isArray(savedItem) ? savedItem[0] : savedItem;
    }
  }

  /**
   * Get all cart items for a user/session
   */
  async getCartItems(userId?: string, sessionId?: string): Promise<UnifiedCartItem[]> {
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    const whereClause = userId ? { userId } : { sessionId };

    return await this.cartRepo.find({
      where: whereClause,
      relations: ['ticket', 'ticket.club', 'ticket.event', 'menuItem', 'variant', 'menuItem.club'],
      order: { createdAt: 'DESC' }
    });
  }

  /**
   * Get cart items with dynamic pricing calculated
   */
  async getCartItemsWithDynamicPricing(userId?: string, sessionId?: string): Promise<any[]> {
    const items = await this.getCartItems(userId, sessionId);

    // Calculate dynamic prices for each item
    const itemsWithDynamicPrices = await Promise.all(items.map(async (item) => {
      if (item.itemType === 'ticket' && item.ticket) {
        const basePrice = Number(item.ticket.price);
        let dynamicPrice = basePrice;

        if (item.ticket.dynamicPricingEnabled && item.ticket.club) {
          if (item.ticket.category === "event" && item.ticket.availableDate) {
            let eventDate: Date;
            if (typeof item.ticket.availableDate === "string") {
              const [year, month, day] = (item.ticket.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.availableDate);
            }

            dynamicPrice = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event?.openHours);
            if (dynamicPrice === -1) dynamicPrice = 0;
          } else {
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.ticket.club.openDays,
              openHours: item.ticket.club.openHours,
              availableDate: item.date ? new Date(item.date) : undefined,
              useDateBasedLogic: false,
            });
          }
        } else if (item.ticket.category === "event") {
          // Grace period check for event tickets when dynamic pricing is disabled
          if (item.ticket.availableDate) {
            let eventDate: Date;
            if (typeof item.ticket.availableDate === "string") {
              const [year, month, day] = (item.ticket.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.availableDate);
            }

            const gracePeriodCheck = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event?.openHours);
            if (gracePeriodCheck === -1) {
              dynamicPrice = 0; // Set to 0 to indicate unavailable
            } else if (gracePeriodCheck > basePrice) {
              // If grace period price is higher than base price, use grace period price
              dynamicPrice = gracePeriodCheck;
            }
          }
        }

        // Add dynamic price to both the ticket object and top level
        return {
          ...item,
          dynamicPrice: dynamicPrice,
          ticket: {
            ...item.ticket,
            dynamicPrice: dynamicPrice
          }
        };
      } else if (item.itemType === 'menu' && item.menuItem) {
        const basePrice = item.variant 
          ? Number(item.variant.price)
          : Number(item.menuItem.price || 0);
        
        let dynamicPrice = basePrice;

        // Calculate dynamic pricing for menu items
        if (item.menuItem.hasVariants && item.variant) {
          // For items with variants, check variant's dynamic pricing
          if (item.variant.dynamicPricingEnabled && item.menuItem.club) {
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              useDateBasedLogic: false,
            });
          }
        } else {
          // For items without variants, check menu item's dynamic pricing
          if (item.menuItem.dynamicPricingEnabled && item.menuItem.club) {
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              useDateBasedLogic: false,
            });
          }
        }

        // Add dynamic price to both the menuItem object and top level
        return {
          ...item,
          dynamicPrice: dynamicPrice,
          menuItem: {
            ...item.menuItem,
            dynamicPrice: dynamicPrice
          }
        };
      }

      return item;
    }));

    return itemsWithDynamicPrices;
  }

  /**
   * Update cart item quantity
   */
  async updateCartItemQuantity(
    itemId: string,
    quantity: number,
    userId?: string,
    sessionId?: string
  ): Promise<UnifiedCartItem> {
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    const item = await this.cartRepo.findOne({
      where: { id: itemId },
      relations: ['ticket', 'menuItem', 'variant']
    });

    if (!item) {
      throw new Error('Cart item not found');
    }

    // Check ownership
    const ownsItem = (userId && item.userId === userId) || (sessionId && item.sessionId === sessionId);
    if (!ownsItem) {
      throw new Error('You cannot update another user\'s cart item');
    }

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Check maxPerPerson for tickets
    if (item.itemType === 'ticket' && item.ticket) {
      if (quantity > item.ticket.maxPerPerson) {
        throw new Error(`You can only buy up to ${item.ticket.maxPerPerson} tickets`);
      }

      // Check ticket availability for the new quantity
      if (item.ticket.quantity != null) {
        const allCartItems = await this.cartRepo.find({
          where: userId ? { userId } : { sessionId },
          relations: ['ticket'],
        });

        const otherCartQuantity = allCartItems
          .filter(c => c.ticket?.id === item.ticket?.id && c.date && 
            (c.date instanceof Date ? c.date.toISOString().split('T')[0] : String(c.date).split('T')[0]) === 
            (item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0]) && 
            c.itemType === 'ticket' && c.id !== item.id)
          .reduce((sum, c) => sum + c.quantity, 0);

        if (otherCartQuantity + quantity > item.ticket.quantity) {
          const remaining = item.ticket.quantity - otherCartQuantity;
          throw new Error(`Only ${remaining} tickets are available for this event`);
        }
      }
    }

    // Check maxPerPerson for menu items
    if (item.itemType === 'menu') {
      const maxPerPerson = item.variant?.maxPerPerson || item.menuItem?.maxPerPerson;
      if (maxPerPerson && quantity > maxPerPerson) {
        throw new Error(`Max per person for this item is ${maxPerPerson}`);
      }
    }

    item.quantity = quantity;
    return await this.cartRepo.save(item);
  }

  /**
   * Remove cart item
   */
  async removeCartItem(itemId: string, userId?: string, sessionId?: string): Promise<void> {
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    const item = await this.cartRepo.findOneBy({ id: itemId });

    if (!item) {
      throw new Error('Cart item not found');
    }

    // Check ownership
    const ownsItem = (userId && item.userId === userId) || (sessionId && item.sessionId === sessionId);
    if (!ownsItem) {
      throw new Error('You cannot delete another user\'s cart item');
    }

    await this.cartRepo.remove(item);
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId?: string, sessionId?: string): Promise<void> {
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    const whereClause = userId ? { userId } : { sessionId };
    await this.cartRepo.delete(whereClause);
  }

  /**
   * Validate specific ticket type rules
   */
  private async validateTicketTypeRules(
    ticket: Ticket,
    date: string,
    existingItems: UnifiedCartItem[]
  ): Promise<void> {
    const isFree = ticket.category === "free";
    const isEvent = ticket.category === "event";
    const isGeneral = ticket.category === "general";

    // Free Ticket Rules
    if (isFree) {
      const ticketDate = ticket.availableDate instanceof Date
        ? ticket.availableDate.toISOString().split("T")[0]
        : ticket.availableDate
          ? new Date(ticket.availableDate).toISOString().split("T")[0]
          : undefined;

      if (!ticketDate || ticketDate !== date) {
        throw new Error("This free ticket is only valid on its available date");
      }
    }

    // General Ticket Rules
    if (isGeneral && !ticket.availableDate) {
      // Check if paid event exists for that date
      const conflictEvent = await this.ticketRepo.findOne({
        where: {
          club: { id: ticket.club.id },
          availableDate: new Date(`${date}T00:00:00`),
          isActive: true,
          category: TicketCategory.EVENT, // Only check for paid events, not free events
        },
      });

      if (conflictEvent) {
        throw new Error(`You cannot buy a general cover for ${date} because a paid event already exists.`);
      }

      // Must be within 3 weeks
      const maxDateStr = new Date(Date.now() + 21 * 86400000).toISOString().split("T")[0];
      if (date > maxDateStr) {
        throw new Error("You can only select dates within 3 weeks");
      }

      // Must be on club's open days
      const selectedDay = new Date(`${date}T12:00:00`).toLocaleString("en-US", { weekday: "long" });
      if (!(ticket.club.openDays || []).includes(selectedDay)) {
        throw new Error(`This club is not open on ${selectedDay}`);
      }
    } else if (!isFree && ticket.availableDate) {
      // Event tickets or tickets with specific available dates
      const ticketDate = ticket.availableDate instanceof Date
        ? ticket.availableDate.toISOString().split("T")[0]
        : new Date(ticket.availableDate).toISOString().split("T")[0];

      if (ticketDate !== date) {
        throw new Error("This ticket is not available on that date");
      }
    }

    // Event Grace Period Check
    if (isEvent) {
      let eventDate: Date;
      let eventOpenHours: { open: string, close: string } | undefined;

      if (ticket.event) {
        eventDate = new Date(ticket.event.availableDate);
        eventOpenHours = ticket.event.openHours;
      } else if (ticket.availableDate) {
        eventDate = new Date(ticket.availableDate);
      } else {
        throw new Error('Event ticket missing event date');
      }

      // Check if event has passed grace period (1 hour grace with 30% charge)
      const dynamicPrice = computeDynamicEventPrice(Number(ticket.price), eventDate, eventOpenHours);
      if (dynamicPrice === -1) {
        throw new Error(`Event "${ticket.name}" has already started and is no longer available for purchase.`);
      }
    }

    // Event Priority Rules
    if (isEvent) {
      // Check if cart has non-event tickets (event tickets can coexist with other event tickets)
      const nonEventTickets = existingItems.filter(item => 
        item.itemType === 'ticket' && 
        item.ticket?.category !== "event"
      );
      
      if (nonEventTickets.length > 0) {
        throw new Error("Cannot add event tickets when other ticket types are in cart. Please clear your cart first.");
      }
    } else {
      // Check if cart has event tickets (event tickets have priority)
      const hasEventTickets = existingItems.some(item => 
        item.itemType === 'ticket' && item.ticket?.category === "event"
      );
      
      if (hasEventTickets) {
        throw new Error("Cannot add non-event tickets when event tickets are in cart. Event tickets have priority.");
      }
    }
  }

  /**
   * Validate cart consistency rules
   */
  private async validateCartConsistency(
    existingItems: UnifiedCartItem[],
    newClubId: string,
    newDate?: string,
    newItemType?: 'ticket' | 'menu',
    newTicketCategory?: string
  ): Promise<void> {
    // Rule 1: All items must be from the same club
    for (const item of existingItems) {
      if (item.clubId !== newClubId) {
        throw new Error('All items in cart must be from the same club');
      }
    }

    // Rule 2: For tickets, all must be for the same date (unless they're event tickets from the same event)
    if (newItemType === 'ticket' && newDate) {
      const existingTicketItems = existingItems.filter(item => item.itemType === 'ticket');
      for (const item of existingTicketItems) {
        const itemDate = item.date ? 
          (item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0]) : 
          null;
        
        if (itemDate !== newDate) {
          // Allow different dates only if both are event tickets from the same event
          const isNewTicketEvent = newTicketCategory === 'event';
          const isExistingTicketEvent = item.ticket?.category === 'event';
          
          if (isNewTicketEvent && isExistingTicketEvent) {
            // Allow different dates for event tickets (they might be multi-day events)
            continue;
          } else {
            throw new Error('All tickets in cart must be for the same date');
          }
        }
      }
    }
  }

  /**
   * Calculate cart totals with dynamic pricing
   */
  async calculateCartTotals(userId?: string, sessionId?: string): Promise<{
    ticketSubtotal: number;
    menuSubtotal: number;
    totalSubtotal: number;
    items: Array<{
      id: string;
      type: 'ticket' | 'menu';
      name: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      dynamicPrice?: number;
    }>;
  }> {
    const items = await this.getCartItems(userId, sessionId);
    let ticketSubtotal = 0;
    let menuSubtotal = 0;

    const processedItems = await Promise.all(items.map(async (item) => {
      let unitPrice = 0;
      let name = '';
      let dynamicPrice: number | undefined;

      if (item.itemType === 'ticket' && item.ticket) {
        const basePrice = Number(item.ticket.price);
        unitPrice = basePrice;
        name = item.ticket.name;

        // Calculate dynamic pricing for tickets
        if (item.ticket.dynamicPricingEnabled && item.ticket.club) {
          if (item.ticket.category === "event" && item.ticket.availableDate) {
            let eventDate: Date;
            if (typeof item.ticket.availableDate === "string") {
              const [year, month, day] = (item.ticket.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.availableDate);
            }

            dynamicPrice = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event?.openHours);
            if (dynamicPrice === -1) dynamicPrice = 0;
          } else {
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.ticket.club.openDays,
              openHours: item.ticket.club.openHours,
              availableDate: item.date ? new Date(item.date) : undefined,
              useDateBasedLogic: false,
            });
          }
        } else if (item.ticket.category === "event") {
          // Grace period check for event tickets when dynamic pricing is disabled
          if (item.ticket.availableDate) {
            let eventDate: Date;
            if (typeof item.ticket.availableDate === "string") {
              const [year, month, day] = (item.ticket.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.availableDate);
            }

            const gracePeriodCheck = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event?.openHours);
            if (gracePeriodCheck === -1) {
              dynamicPrice = 0; // Set to 0 to indicate unavailable
            } else if (gracePeriodCheck > basePrice) {
              // If grace period price is higher than base price, use grace period price
              dynamicPrice = gracePeriodCheck;
            }
          }
        }

        if (dynamicPrice !== undefined) {
          unitPrice = dynamicPrice;
        }

        ticketSubtotal += unitPrice * item.quantity;
      } else if (item.itemType === 'menu' && item.menuItem) {
        const basePrice = item.variant 
          ? Number(item.variant.price)
          : Number(item.menuItem.price || 0);
        
        unitPrice = basePrice;
        name = item.menuItem.name;
        if (item.variant) {
          name += ` - ${item.variant.name}`;
        }

        // Calculate dynamic pricing for menu items
        if (item.menuItem.hasVariants && item.variant) {
          // For items with variants, check variant's dynamic pricing
          if (item.variant.dynamicPricingEnabled && item.menuItem.club) {
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              useDateBasedLogic: false,
            });
          }
        } else {
          // For items without variants, check menu item's dynamic pricing
          if (item.menuItem.dynamicPricingEnabled && item.menuItem.club) {
            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              useDateBasedLogic: false,
            });
          }
        }

        if (dynamicPrice !== undefined) {
          unitPrice = dynamicPrice;
        }

        menuSubtotal += unitPrice * item.quantity;
      }

      return {
        id: item.id,
        type: item.itemType,
        name,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity,
        dynamicPrice
      };
    }));

    return {
      ticketSubtotal,
      menuSubtotal,
      totalSubtotal: ticketSubtotal + menuSubtotal,
      items: processedItems
    };
  }

  /**
   * Calculate cart summary in legacy format
   */
  async calculateCartSummary(userId?: string, sessionId?: string): Promise<{
    total: number;
    operationalCosts: number;
    actualTotal: number;
  }> {
    const totals = await this.calculateCartTotals(userId, sessionId);
    
    // Return 0 for all values if total is 0 (empty cart or free tickets)
    if (totals.totalSubtotal === 0) {
      return {
        total: 0,
        operationalCosts: 0,
        actualTotal: 0,
      };
    }

    // Use the fee allocation logic for unified carts
    // Check if any ticket items are event tickets by looking at the actual cart items
    const cartItems = await this.getCartItems(userId, sessionId);
    const hasEventTickets = cartItems.some(item => 
      item.itemType === 'ticket' && 
      item.ticket && 
      item.ticket.category === 'event'
    );
    
    const feeAllocation = calculateFeeAllocation({
      ticketSubtotal: totals.ticketSubtotal,
      menuSubtotal: totals.menuSubtotal,
      isEventTicket: hasEventTickets
    });

    return {
      total: totals.totalSubtotal,
      operationalCosts: feeAllocation.platformReceives + feeAllocation.gatewayFee + feeAllocation.gatewayIVA,
      actualTotal: feeAllocation.totalPaid,
    };
  }
}
