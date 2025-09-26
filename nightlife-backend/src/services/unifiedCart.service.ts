import { AppDataSource } from '../config/data-source';
import { UnifiedCartItem } from '../entities/UnifiedCartItem';
import { Ticket, TicketCategory } from '../entities/Ticket';
import { MenuItem } from '../entities/MenuItem';
import { MenuItemVariant } from '../entities/MenuItemVariant';
import { computeDynamicPrice, computeDynamicEventPrice, computeDynamicMenuEventPrice, computeDynamicMenuNormalPrice, getNormalTicketDynamicPricingReason, getMenuDynamicPricingReason, getMenuEventDynamicPricingReason, getEventTicketDynamicPricingReason, getCurrentColombiaTime } from '../utils/dynamicPricing';
import { calculateFeeAllocation } from '../utils/feeAllocation';
import { nowInBogota, todayInBogota } from '../utils/timezone';

export interface AddTicketToCartInput {
  ticketId: string;
  date: string; // YYYY-MM-DD
  quantity: number;
}

export interface AddMenuToCartInput {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  date: string; // YYYY-MM-DD - required for menu items
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

    // Validate date - use Bogota timezone for consistent validation
    const { isPastDateInBogota, todayInBogota } = await import('../utils/timezone');
    
    console.log('Date validation (ticket) - Today (Bogota):', todayInBogota(), 'Requested date:', date);

    if (isPastDateInBogota(date)) {
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
        
        
        return normalizedItemDate === normalizedNewDate;
      }
    );

    // Validate specific ticket type rules
    await this.validateTicketTypeRules(ticket, date, existingItems);

    // Validate cart consistency
    await this.validateCartConsistency(existingItems, ticket.clubId, date, 'ticket', ticket.category);

    if (existingTicketItem) {
      const newTotal = existingTicketItem.quantity + quantity;
      if (newTotal > ticket.maxPerPerson) {
        throw new Error(`Cannot exceed maximum of ${ticket.maxPerPerson} tickets per person`);
      }
      
      existingTicketItem.quantity += quantity;
      return await this.cartRepo.save(existingTicketItem);
    } else {
      // Create new cart item - store date as string to match legacy cart behavior
      
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
    const { menuItemId, variantId, quantity, date } = input;

    // Validate ownership
    if (!userId && !sessionId) {
      throw new Error('Missing or invalid token');
    }

    // Validate quantity
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Validate date - use Bogota timezone for consistent validation
    const { isPastDateInBogota, isDateSelectableInBogota, todayInBogota } = await import('../utils/timezone');
    
    console.log('Date validation (menu) - Today (Bogota):', todayInBogota(), 'Requested date:', date);
    
    if (isPastDateInBogota(date)) {
      throw new Error('Cannot select a past date');
    }

    // Validate date is within selectable range (today to 21 days from today)
    if (!isDateSelectableInBogota(date)) {
      throw new Error('Cannot select a date more than 21 days in the future');
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

    // Check if there's an event on this date - if so, bypass openDays validation
    const eventRepo = AppDataSource.getRepository('Event');
    const event = await eventRepo.findOne({
      where: {
        clubId: menuItem.clubId,
        availableDate: new Date(`${date}T00:00:00`),
        isActive: true
      }
    });

    // Only check openDays if there's no event (events bypass openDays validation)
    if (!event) {
      const selectedDay = new Date(`${date}T12:00:00`).toLocaleString("en-US", { weekday: "long" });
      if (!(menuItem.club.openDays || []).includes(selectedDay)) {
        throw new Error(`This club is not open on ${selectedDay}`);
      }
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
    await this.validateCartConsistency(existingItems, menuItem.clubId, date, 'menu');

    // Check for existing menu item in cart
    const existingMenuItem = existingItems.find(
      item => item.itemType === 'menu' && 
               item.menuItemId === menuItemId && 
               item.variantId === (variantId || null) &&
               item.date?.toISOString().split('T')[0] === date
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
        date: date, // Store as string to match ticket behavior
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

    // If no items, return empty array immediately to avoid unnecessary dynamic pricing calculations
    if (items.length === 0) {
      return [];
    }

    // Calculate dynamic prices for each item
    const itemsWithDynamicPrices = await Promise.all(items.map(async (item) => {
      if (item.itemType === 'ticket' && item.ticket) {
        const basePrice = Number(item.ticket.price);
        let dynamicPrice = basePrice;

        if (item.ticket.dynamicPricingEnabled && item.ticket.club) {
          if (item.ticket.category === "event" && item.ticket.event) {
            // Use event entity's availableDate and openHours, not ticket's
            let eventDate: Date;
            if (typeof item.ticket.event.availableDate === "string") {
              const [year, month, day] = (item.ticket.event.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.event.availableDate);
            }

            dynamicPrice = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event.openHours, { isFree: basePrice === 0 });
            if (dynamicPrice === -1) dynamicPrice = basePrice; // Use base price, frontend will handle availability logic
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
          if (item.ticket.event) {
            // Use event entity's availableDate and openHours, not ticket's
            let eventDate: Date;
            if (typeof item.ticket.event.availableDate === "string") {
              const [year, month, day] = (item.ticket.event.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.event.availableDate);
            }

            const gracePeriodCheck = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event.openHours, { isFree: basePrice === 0 });
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
            const now = nowInBogota();
            console.log(`[CART-DP] Calculating dynamic pricing for menu variant:`, {
              menuItemId: item.menuItem.id,
              variantId: item.variant.id,
              menuItemName: item.menuItem.name,
              variantName: item.variant.name,
              basePrice,
              date: item.date,
              clubId: item.clubId,
              currentTime: now.toISO(),
              currentDate: todayInBogota(),
              currentTimeColombia: now.toFormat('M/d/yyyy, h:mm:ss a')
            });

            dynamicPrice = await this.calculateMenuDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              selectedDate: item.date ? new Date(item.date) : undefined,
              clubId: item.clubId,
            });

            // Get canonical reason code for menu items
            const reason = await this.getMenuDynamicPricingReason({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              selectedDate: item.date ? new Date(item.date) : undefined,
              clubId: item.clubId,
            });

            console.log(`[CART-DP] Menu variant pricing result:`, {
              basePrice,
              dynamicPrice,
              discount: basePrice - dynamicPrice,
              reason: reason || 'base price'
            });
          }
        } else {
          // For items without variants, check menu item's dynamic pricing
          if (item.menuItem.dynamicPricingEnabled && item.menuItem.club) {
            const now = nowInBogota();
            console.log(`[CART-DP] Calculating dynamic pricing for menu item:`, {
              menuItemId: item.menuItem.id,
              menuItemName: item.menuItem.name,
              basePrice,
              date: item.date,
              clubId: item.clubId,
              currentTime: now.toISO(),
              currentDate: todayInBogota(),
              currentTimeColombia: now.toFormat('M/d/yyyy, h:mm:ss a')
            });

            dynamicPrice = await this.calculateMenuDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              selectedDate: item.date ? new Date(item.date) : undefined,
              clubId: item.clubId,
            });

            // Get canonical reason code for menu items
            const reason = await this.getMenuDynamicPricingReason({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              selectedDate: item.date ? new Date(item.date) : undefined,
              clubId: item.clubId,
            });

            console.log(`[CART-DP] Menu item pricing result:`, {
              basePrice,
              dynamicPrice,
              discount: basePrice - dynamicPrice,
              reason: reason || 'base price'
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
    const ticketPrice = Number(ticket.price);
    const isFree = ticket.category === "free" || ticketPrice === 0;
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
      const dynamicPrice = computeDynamicEventPrice(Number(ticket.price), eventDate, eventOpenHours, { isFree });
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

    // Rule 2: All items (tickets and menu) must be for the same date
    if (newDate) {
      for (const item of existingItems) {
        const itemDate = item.date ? 
          (item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0]) : 
          null;
        
        if (itemDate !== newDate) {
          // Allow different dates only if both are event tickets from the same event
          const isNewTicketEvent = newItemType === 'ticket' && newTicketCategory === 'event';
          const isExistingTicketEvent = item.itemType === 'ticket' && item.ticket?.category === 'event';
          
          if (isNewTicketEvent && isExistingTicketEvent) {
            // Allow different dates for event tickets (they might be multi-day events)
            continue;
          } else {
            const itemDateDisplay = itemDate || 'unknown date';
            throw new Error(`All items in cart must be for the same date. Current cart has items for ${itemDateDisplay}, but you're trying to add an item for ${newDate}. Please clear your cart or select the same date.`);
          }
        }
      }
    }
  }

  /**
   * Calculate dynamic pricing for menu items with event date support
   */
  public async calculateMenuDynamicPrice(input: {
    basePrice: number;
    clubOpenDays: string[];
    openHours: string | { day: string, open: string, close: string }[];
    selectedDate?: Date;
    clubId: string;
  }): Promise<number> {
    const { basePrice, clubOpenDays, openHours, selectedDate, clubId } = input;

    if (!basePrice || basePrice <= 0) {
      return 0;
    }

    // Check if there's an event on the selected date and get event details
    const event = await this.getEventForDate(selectedDate, clubId);
    
    
    if (event && selectedDate) {
      // For event dates, use centralized event-based pricing for menu items
      // Use the event's availableDate (like tickets do) instead of selectedDate
      let eventDate: Date;
      if (typeof event.availableDate === "string") {
        const [year, month, day] = event.availableDate.split("-").map(Number);
        eventDate = new Date(year, month - 1, day);
      } else {
        eventDate = new Date(event.availableDate);
      }
      
      
      return computeDynamicMenuEventPrice(basePrice, eventDate, event.openHours);
    } else {
      // For non-event dates, use menu-specific normal day pricing logic
      
      return computeDynamicMenuNormalPrice({
        basePrice,
        clubOpenDays,
        openHours: Array.isArray(openHours) ? openHours : [],
        selectedDate: selectedDate ? new Date(selectedDate.toISOString().split('T')[0] + 'T12:00:00') : undefined,
      });
    }
  }

  /**
   * Get event details for a given date and club
   */
  private async getEventForDate(date: Date | undefined, clubId: string): Promise<any | null> {
    if (!date) return null;
    
    try {
      // Query the Event entity to get event details on this date for this club
      const eventRepo = AppDataSource.getRepository('Event');
      
      // Convert date to string format for database comparison
      const dateString = date.toISOString().split('T')[0]; // "2025-09-15"
      
      const event = await eventRepo.findOne({
        where: {
          clubId: clubId,
          availableDate: dateString,
          isActive: true,
          isDeleted: false
        }
      });
      
      return event;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get dynamic pricing reason for menu items
   */
  private async getMenuDynamicPricingReason(input: {
    basePrice: number;
    clubOpenDays: string[];
    openHours: { day: string, open: string, close: string }[];
    selectedDate?: Date;
    clubId: string;
  }): Promise<string | undefined> {
    const { basePrice, clubOpenDays, openHours, selectedDate, clubId } = input;

    if (!basePrice || basePrice <= 0) {
      return undefined;
    }

    // Check if there's an event on the selected date
    const event = await this.getEventForDate(selectedDate, clubId);
    
    if (event && selectedDate) {
      // For event dates, use event-based pricing reason
      let eventDate: Date;
      if (typeof event.availableDate === "string") {
        const [year, month, day] = event.availableDate.split("-").map(Number);
        eventDate = new Date(year, month - 1, day);
      } else {
        eventDate = new Date(event.availableDate);
      }
      
      return getMenuEventDynamicPricingReason(eventDate, event.openHours);
    } else {
      // For non-event dates, use normal menu pricing reason
      return getMenuDynamicPricingReason({
        basePrice,
        clubOpenDays,
        openHours,
        selectedDate: selectedDate ? new Date(selectedDate.toISOString().split('T')[0] + 'T12:00:00') : undefined,
      });
    }
  }

  /**
   * Check if a given date is an event date for a specific club
   */
  private async isEventDate(date: Date | undefined, clubId: string): Promise<boolean> {
    const event = await this.getEventForDate(date, clubId);
    return !!event;
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
    
    // If no items, return empty totals immediately to avoid unnecessary dynamic pricing calculations
    if (items.length === 0) {
      return {
        ticketSubtotal: 0,
        menuSubtotal: 0,
        totalSubtotal: 0,
        items: []
      };
    }
    
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
          const now = nowInBogota();
          console.log(`[CART-DP] Calculating dynamic pricing for ticket:`, {
            ticketId: item.ticket.id,
            ticketName: item.ticket.name,
            category: item.ticket.category,
            basePrice,
            availableDate: item.ticket.event?.availableDate || item.ticket.availableDate,
            date: item.date,
            currentTime: now.toISO(),
            currentDate: todayInBogota(),
            currentTimeColombia: now.toFormat('M/d/yyyy, h:mm:ss a')
          });

          let reason: string | undefined;

          if (item.ticket.category === "event" && item.ticket.event) {
            // Use event entity's availableDate and openHours, not ticket's
            let eventDate: Date;
            if (typeof item.ticket.event.availableDate === "string") {
              const [year, month, day] = (item.ticket.event.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.event.availableDate);
            }

            console.log(`[CART-DP] Event ticket pricing:`, {
              eventDate: eventDate.toISOString(),
              openHours: item.ticket.event.openHours
            });

            dynamicPrice = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event.openHours, { isFree: basePrice === 0 });
            if (dynamicPrice === -1) dynamicPrice = basePrice; // Use base price, frontend will handle availability logic
            
            // Get canonical reason code for event tickets
            reason = getEventTicketDynamicPricingReason(eventDate, item.ticket.event.openHours);
          } else {
            console.log(`[CART-DP] General ticket pricing:`, {
              clubOpenDays: item.ticket.club.openDays,
              openHours: item.ticket.club.openHours,
              availableDate: item.date ? new Date(item.date).toISOString() : undefined
            });

            dynamicPrice = computeDynamicPrice({
              basePrice,
              clubOpenDays: item.ticket.club.openDays,
              openHours: item.ticket.club.openHours,
              availableDate: item.date ? new Date(item.date) : undefined,
              useDateBasedLogic: false,
            });
            
            // Get canonical reason code for general tickets
            reason = getNormalTicketDynamicPricingReason({
              basePrice,
              clubOpenDays: item.ticket.club.openDays,
              openHours: item.ticket.club.openHours,
              availableDate: item.date ? new Date(item.date) : undefined,
              useDateBasedLogic: false,
            });
          }

          console.log(`[CART-DP] Ticket pricing result:`, {
            basePrice,
            dynamicPrice,
            discount: basePrice - dynamicPrice,
            reason: reason || 'base price'
          });
        } else if (item.ticket.category === "event") {
          // Grace period check for event tickets when dynamic pricing is disabled
          if (item.ticket.event) {
            // Use event entity's availableDate and openHours, not ticket's
            let eventDate: Date;
            if (typeof item.ticket.event.availableDate === "string") {
              const [year, month, day] = (item.ticket.event.availableDate as string).split("-").map(Number);
              eventDate = new Date(year, month - 1, day);
            } else {
              eventDate = new Date(item.ticket.event.availableDate);
            }

            const gracePeriodCheck = computeDynamicEventPrice(basePrice, eventDate, item.ticket.event.openHours, { isFree: basePrice === 0 });
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
            console.log(`[CART-TOTALS-DP] Calculating dynamic pricing for menu variant:`, {
              menuItemId: item.menuItem.id,
              variantId: item.variant.id,
              menuItemName: item.menuItem.name,
              variantName: item.variant.name,
              basePrice,
              date: item.date,
              clubId: item.clubId
            });

            dynamicPrice = await this.calculateMenuDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              selectedDate: item.date ? new Date(item.date) : undefined,
              clubId: item.clubId,
            });

            console.log(`[CART-TOTALS-DP] Menu variant pricing result:`, {
              basePrice,
              dynamicPrice,
              discount: basePrice - dynamicPrice,
              reason: dynamicPrice < basePrice ? 'discount applied' : dynamicPrice > basePrice ? 'surcharge applied' : 'base price'
            });
          }
        } else {
          // For items without variants, check menu item's dynamic pricing
          if (item.menuItem.dynamicPricingEnabled && item.menuItem.club) {
            console.log(`[CART-TOTALS-DP] Calculating dynamic pricing for menu item:`, {
              menuItemId: item.menuItem.id,
              menuItemName: item.menuItem.name,
              basePrice,
              date: item.date,
              clubId: item.clubId
            });

            dynamicPrice = await this.calculateMenuDynamicPrice({
              basePrice,
              clubOpenDays: item.menuItem.club.openDays,
              openHours: item.menuItem.club.openHours,
              selectedDate: item.date ? new Date(item.date) : undefined,
              clubId: item.clubId,
            });

            console.log(`[CART-TOTALS-DP] Menu item pricing result:`, {
              basePrice,
              dynamicPrice,
              discount: basePrice - dynamicPrice,
              reason: dynamicPrice < basePrice ? 'discount applied' : dynamicPrice > basePrice ? 'surcharge applied' : 'base price'
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
