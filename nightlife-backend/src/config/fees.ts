/**
 * Centralized fee configuration
 *
 * This file contains all fee-related settings for the platform.
 * Update these values to change commission rates, gateway fees, etc.
 */

export const PLATFORM_FEES = {
  // Ticket commission rates
  TICKET: {
    REGULAR: 0.05, // 5% for regular tickets
    EVENT: 0.10,   // 10% for event tickets
  },

  // Menu commission rates
  MENU: {
    ALL_ITEMS: 0.025, // 2.5% for all menu items
  },
} as const;

// Gateway/Payment Provider Fees (Wompi)
export const GATEWAY_FEES = {
  FIXED: 700,       // Fixed fee in COP
  VARIABLE: 0.0265, // Variable fee 2.65% of the base price
  IVA: 0.19,        // IVA 19% on the subtotal
} as const;

// Event Grace Period Configuration
export const EVENT_GRACE_PERIOD = {
  HOURS: 3,         // Grace period duration in hours after event starts
  MULTIPLIER: 1.3,  // Price multiplier during grace period (30% surcharge)
} as const;

// Dynamic Pricing Rules (multipliers only; reasons are resolved via helpers below)
export const DYNAMIC_PRICING = {
  // General covers rules (3+ hours: 30%, 2-3 hours: 10%, <2 hours: base, during open: base)
  COVERS: {
    HOURS_3_PLUS: 0.7,  // 30% discount for 3+ hours before open
    HOURS_2_3: 0.9,     // 10% discount for 2-3 hours before open
    HOURS_LESS_2: 1.0,  // Base price for <2 hours before open
    DURING_OPEN: 1.0,   // Base price during open hours
  },

  // Menu items rules (closed: 30%, 3+ hours: 30%, <3 hours: 10%, open: base)
  MENU: {
    CLOSED_DAY: 0.7,     // 30% discount on closed days (also after-hours)
    HOURS_3_PLUS: 0.7,   // 30% discount for 3+ hours before open
    HOURS_LESS_3: 0.9,   // 10% discount for <3 hours before open
    DURING_OPEN: 1.0,    // Base price during open hours
  },

  // Event menu items rules (48+ hours: 30%, 24-48: 10% off, <24: base)
  EVENT_MENU: {
    HOURS_48_PLUS: 0.7,  // 30% discount for 48+ hours away
    HOURS_24_48: 0.9,    // 10% discount for 24-48 hours away
    HOURS_LESS_24: 1.0,  // Base price for <24 hours (no surcharge)
  },

  // Event tickets rules (48+ hours: 30%, 24-48: base, <24: 20% surplus, grace: 30% surplus)
  EVENT_TICKETS: {
    HOURS_48_PLUS: 0.7,  // 30% discount for 48+ hours away
    HOURS_24_48: 1.0,    // Base price for 24-48 hours away
    HOURS_LESS_24: 1.2,  // 20% surplus for less than 24 hours
    GRACE_PERIOD: EVENT_GRACE_PERIOD.MULTIPLIER,   // Grace period surplus (configurable)
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Commission helpers
// ─────────────────────────────────────────────────────────────────────────────

export const getTicketCommissionRate = (isEvent: boolean): number =>
  isEvent ? PLATFORM_FEES.TICKET.EVENT : PLATFORM_FEES.TICKET.REGULAR;

export const getMenuCommissionRate = (): number => PLATFORM_FEES.MENU.ALL_ITEMS;

// ─────────────────────────────────────────────────────────────────────────────
// Multipliers by time-to-event (kept for compatibility)
// ─────────────────────────────────────────────────────────────────────────────

export const getEventTicketPricingMultiplier = (hoursUntilEvent: number): number => {
  if (hoursUntilEvent >= 48) return DYNAMIC_PRICING.EVENT_TICKETS.HOURS_48_PLUS;
  if (hoursUntilEvent >= 24) return DYNAMIC_PRICING.EVENT_TICKETS.HOURS_24_48;
  if (hoursUntilEvent >= 0) return DYNAMIC_PRICING.EVENT_TICKETS.HOURS_LESS_24;
  if (hoursUntilEvent >= -EVENT_GRACE_PERIOD.HOURS) return DYNAMIC_PRICING.EVENT_TICKETS.GRACE_PERIOD; // Configurable grace period
  return -1; // Event has passed grace period - blocked
};

export const getEventMenuPricingMultiplier = (hoursUntilEvent: number): number => {
  if (hoursUntilEvent >= 48) return DYNAMIC_PRICING.EVENT_MENU.HOURS_48_PLUS;
  if (hoursUntilEvent >= 24) return DYNAMIC_PRICING.EVENT_MENU.HOURS_24_48;
  if (hoursUntilEvent >= 0) return DYNAMIC_PRICING.EVENT_MENU.HOURS_LESS_24;
  return 1.0; // Event has passed, use base price (menu items never get surcharges)
};

// ─────────────────────────────────────────────────────────────────────────────
// Canonical REASONS to persist in DB
// ─────────────────────────────────────────────────────────────────────────────

// Event ticket reasons (unchanged)
export const getEventTicketPricingReason = (hoursUntilEvent: number): string => {
  if (hoursUntilEvent >= 48) return "event_48_plus";
  if (hoursUntilEvent >= 24) return "event_24_48";
  if (hoursUntilEvent >= 0) return "event_less_24";
  if (hoursUntilEvent >= -EVENT_GRACE_PERIOD.HOURS) return "event_grace_period";
  return "event_expired";
};

// Event menu reasons (Option A — explicit)
export const getMenuEventPricingReason = (
  hoursUntilEvent: number,
  isOpenDuringEvent?: boolean,
  hasEventEnded?: boolean
): string => {
  if (isOpenDuringEvent) return "event_menu_open_hours_base";
  if (hasEventEnded) return "event_menu_passed_base";
  if (hoursUntilEvent >= 48) return "event_menu_48_plus_30_off";
  if (hoursUntilEvent >= 24) return "event_menu_24_48_10_off";
  if (hoursUntilEvent >= 0) return "event_menu_lt24_base";
  // If open/close unknown and negative hours, treat as passed base
  return "event_menu_passed_base";
};

// Covers (non-event)
export const getCoversPricingReason = (
  minutesUntilOpen: number,
  isOpen: boolean,
  isClosedDifferentDay: boolean
): string => {
  if (isOpen) return "covers_open_hours_base";
  if (isClosedDifferentDay) return "covers_closed_next_open_30_off";
  if (minutesUntilOpen > 180) return "covers_preopen_3h_plus_30_off";
  if (minutesUntilOpen > 120) return "covers_preopen_2_3h_10_off";
  if (minutesUntilOpen >= 0) return "covers_preopen_lt2h_base";
  return "covers_open_hours_base";
};

// Menu (normal/non-event)
export const getMenuNormalPricingReason = (
  minutesUntilOpen: number,
  isOpen: boolean,
  isClosedDay: boolean,
  isAfterHours: boolean
): string => {
  if (isClosedDay) return "menu_closed_day_30_off";
  if (isOpen) return "menu_open_hours_base";
  if (isAfterHours) return "menu_closed_day_30_off"; // After-hours treated as closed-day 30% for consistency
  if (minutesUntilOpen > 180) return "menu_preopen_3h_plus_30_off";
  if (minutesUntilOpen > 0) return "menu_preopen_lt3h_10_off";
  return "menu_open_hours_base";
};

// Policy-specific reasons
export const getFreeTicketReason = (): string => "free_ticket_no_dp";
export const getTicketDisabledReason = (): string => "ticket_dp_disabled_base";
export const getMenuParentHasVariantsReason = (): string => "menu_parent_has_variants_no_dp";
export const getMenuVariantDisabledReason = (): string => "menu_variant_dp_disabled";
