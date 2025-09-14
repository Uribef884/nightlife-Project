import { getDay, differenceInMinutes, isValid } from "date-fns";
import { DYNAMIC_PRICING, getEventPricingMultiplier, getEventPricingReason } from "../config/fees";

const dayMap: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2,
  Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

const PRICING_RULES = {
  CLOSED_DAY: DYNAMIC_PRICING.CLOSED_DAY,
  EARLY: DYNAMIC_PRICING.EARLY,
  INVALID: 1,              // No discount if data is invalid
  EVENT_48_PLUS: DYNAMIC_PRICING.EVENT.HOURS_48_PLUS,
  EVENT_24_48: DYNAMIC_PRICING.EVENT.HOURS_24_48,
  EVENT_LESS_24: DYNAMIC_PRICING.EVENT.HOURS_LESS_24,
};

function clampPrice(price: number, basePrice: number): number {
  // Ensure price is not negative and not more than basePrice
  if (price < 0) return 0;
  if (price > basePrice) return basePrice;
  return price;
}

function parseOpenHour(openHour: string): { open: Date, close: Date } | null {
  try {
    const [openStr, closeStr] = openHour.split('-');
    const [openHourNum, openMinuteNum] = openStr.trim().split(':').map(Number);
    const [closeHourNum, closeMinuteNum] = closeStr.trim().split(':').map(Number);
    const now = new Date();
    const open = new Date(now.getFullYear(), now.getMonth(), now.getDate(), openHourNum, openMinuteNum);
    let close = new Date(now.getFullYear(), now.getMonth(), now.getDate(), closeHourNum, closeMinuteNum);
    if (close <= open) {
      // Crosses midnight, so close is next day
      close.setDate(close.getDate() + 1);
    }
    return { open, close };
  } catch {
    return null;
  }
}

function getNextOpenClose(now: Date, openHoursArr: { day: string, open: string, close: string }[], clubOpenDays: string[]): { open: Date, close: Date } | null {
  // Returns the next open and close Date objects after 'now', or null if not found
  const dayIndexes = clubOpenDays.map(day => dayMap[day]);
  
  for (let offset = 0; offset < 8; offset++) { // look up to a week ahead
    const checkDate = new Date(now);
    checkDate.setDate(now.getDate() + offset);
    const checkDay = checkDate.getDay();
    
    if (!dayIndexes.includes(checkDay)) {
      continue;
    }
    
    const dayName = Object.keys(dayMap).find(key => dayMap[key] === checkDay);
    const hours = openHoursArr.find(h => h.day === dayName);
    if (!hours) {
      continue;
    }
    
    const [openHourNum, openMinuteNum] = hours.open.trim().split(":").map(Number);
    const [closeHourNum, closeMinuteNum] = hours.close.trim().split(":").map(Number);
    
    const open = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), openHourNum, openMinuteNum);
    let close = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate(), closeHourNum, closeMinuteNum);
    
    if (close <= open) {
      close.setDate(close.getDate() + 1); // cross-midnight
    }
    
    if (open > now) {
      return { open, close };
    }
    if (now >= open && now < close) {
      return { open, close };
    }
  }
  
  return null;
}

function isDateOpen(referenceDate: Date, openHoursArr: { day: string, open: string, close: string }[], clubOpenDays: string[]): { isOpen: boolean; openTime?: Date; closeTime?: Date } {
  const dayIndex = referenceDate.getDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[dayIndex];
  
  // Check if this day is an open day
  if (!clubOpenDays.includes(dayName)) {
    return { isOpen: false };
  }
  
  // Find the open hours for this day
  const hours = openHoursArr.find(h => h.day === dayName);
  if (!hours) {
    return { isOpen: false };
  }
  
  const [openHour, openMinute] = hours.open.trim().split(":").map(Number);
  const [closeHour, closeMinute] = hours.close.trim().split(":").map(Number);
  
  const openTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), openHour, openMinute);
  let closeTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), closeHour, closeMinute);
  
  // Handle cross-midnight
  if (closeTime <= openTime) {
    closeTime.setDate(closeTime.getDate() + 1);
  }
  
  const isOpen = referenceDate >= openTime && referenceDate < closeTime;
  
  return { isOpen, openTime, closeTime };
}

export interface DynamicPriceInput {
  basePrice: number;
  clubOpenDays: string[];
  openHours: string | { day: string, open: string, close: string }[];
  availableDate?: Date;
  useDateBasedLogic?: boolean;
}

/**
 * Generic dynamic pricing function:
 * - Applies time-to-open discount for general covers and menu
 * - Applies date-based logic for event tickets if useDateBasedLogic = true
 */
export function computeDynamicPrice(input: DynamicPriceInput): number {
  const {
    basePrice,
    clubOpenDays,
    openHours,
    availableDate,
    useDateBasedLogic = false
  } = input;



  if (!basePrice || basePrice <= 0 || isNaN(basePrice)) {
    return 0;
  }
  if (basePrice === 0) {
    return 0;
  }

  const now = new Date();

  // 🎟️ EVENT TICKET LOGIC - Use same time-based rules as regular tickets
  if (useDateBasedLogic && availableDate) {
    // Ensure availableDate is a Date object
    const eventDate = availableDate instanceof Date ? availableDate : new Date(availableDate);
    if (isNaN(eventDate.getTime())) {
      console.error('[DP] Invalid availableDate:', availableDate);
      return basePrice;
    }
    
    // For event tickets, treat the event date as the "next open time"
    const minutesUntilEvent = Math.round((eventDate.getTime() - now.getTime()) / 60000);
    
    if (minutesUntilEvent > 180) {
      // More than 3 hours before event: 30% off
      const discountedPrice = clampPrice(Math.round(basePrice * PRICING_RULES.CLOSED_DAY * 100) / 100, basePrice);
      return discountedPrice;
    } else if (minutesUntilEvent > 120) {
      // 2-3 hours before event: 10% off
      const discountedPrice = clampPrice(Math.round(basePrice * PRICING_RULES.EARLY * 100) / 100, basePrice);
      return discountedPrice;
    } else {
      // 2 hours or less before event or during event: full price
      return basePrice;
    }
  }

  // 📆 General Day/Time-Based Logic (covers, menu)
  // For general tickets, use the selected date if provided, otherwise use current time
  const referenceDate = availableDate ? (availableDate instanceof Date ? availableDate : new Date(availableDate)) : new Date();
  
  let openHoursArr = Array.isArray(openHours) ? openHours : [];
  if (!Array.isArray(openHours) && typeof openHours === "string") {
    // fallback: treat as always open
    return basePrice;
  }
  

  
  // Check if the selected date is open
  const dateStatus = isDateOpen(referenceDate, openHoursArr, clubOpenDays);
  

  
  if (dateStatus.isOpen) {
    // Club is open on the selected date - no discount
    return basePrice;
  }
  
  // Club is closed on the selected date - check if it's the same day or different day
  if (dateStatus.openTime) {
    // Use CURRENT TIME to calculate minutes until the club opens on the selected date
    const now = new Date();
    const minutesUntilOpen = Math.round((dateStatus.openTime.getTime() - now.getTime()) / 60000);
    
    if (minutesUntilOpen > 180) {
      // More than 3 hours before open on the same day: 30% off
      const multiplier = PRICING_RULES.CLOSED_DAY;
      const discountedPrice = clampPrice(Math.round(basePrice * multiplier * 100) / 100, basePrice);
      return discountedPrice;
    } else if (minutesUntilOpen > 120) {
      // 2-3 hours before open on the same day: 10% off
      const multiplier = PRICING_RULES.EARLY;
      const discountedPrice = clampPrice(Math.round(basePrice * multiplier * 100) / 100, basePrice);
      return discountedPrice;
    } else {
      // 2 hours or less before open or during open hours: full price
      return basePrice;
    }
  }
  
  // Different day and closed: 30% off
  const multiplier = PRICING_RULES.CLOSED_DAY;
  const discountedPrice = clampPrice(Math.round(basePrice * multiplier * 100) / 100, basePrice);
  return discountedPrice;
}

/**
 * Dynamic pricing for menu items on normal (non-event) days
 * - Club Closed Days: 30% discount
 * - Club Open Days, 3+ hours before opening: 30% discount  
 * - Club Open Days, < 3 hours before opening: 10% discount
 * - During Club Open Hours: Base price (no discount)
 */
export function computeDynamicMenuNormalPrice(input: {
  basePrice: number;
  clubOpenDays: string[];
  openHours: { day: string, open: string, close: string }[];
  selectedDate?: Date;
}): number {
  const { basePrice, clubOpenDays, openHours, selectedDate } = input;

  if (!basePrice || basePrice <= 0) {
    return 0;
  }

  // Use the selected date if provided, otherwise use current time
  let referenceDate: Date;
  if (selectedDate) {
    if (selectedDate instanceof Date) {
      referenceDate = selectedDate;
    } else {
      // Parse date string and force to noon to avoid timezone issues
      const dateStr = String(selectedDate);
      if (dateStr.includes('T')) {
        referenceDate = new Date(dateStr);
      } else {
        // If it's just a date string like "2025-09-14", append noon time
        referenceDate = new Date(dateStr + 'T12:00:00');
      }
    }
  } else {
    referenceDate = new Date();
  }
  
  // Check if the selected date is an open day
  const dayIndex = referenceDate.getDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[dayIndex];
  
  const isOpenDay = clubOpenDays.includes(dayName);
  
  console.log(`[MENU-DP-NORMAL] Normal day pricing calculation:`, {
    selectedDate: referenceDate.toISOString(),
    dayName,
    isOpenDay,
    clubOpenDays,
    basePrice
  });
  
  if (!isOpenDay) {
    // Club Closed Days: 30% discount
    const finalPrice = Math.round(basePrice * 0.7 * 100) / 100;
    console.log(`[MENU-DP-NORMAL] Club closed day: ${basePrice} * 0.7 = ${finalPrice}`);
    return finalPrice;
  }
  
  // Club is open on this day - check hours
  const hours = openHours.find(h => h.day === dayName);
  if (!hours) {
    // No hours defined for this day, treat as closed
    const finalPrice = Math.round(basePrice * 0.7 * 100) / 100;
    console.log(`[MENU-DP-NORMAL] No hours defined for ${dayName}: ${basePrice} * 0.7 = ${finalPrice}`);
    return finalPrice;
  }
  
  // Parse opening hours
  const [openHour, openMinute] = hours.open.split(':').map(Number);
  const [closeHour, closeMinute] = hours.close.split(':').map(Number);
  
  // Create opening time for the selected date
  const openTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), openHour, openMinute);
  let closeTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), closeHour, closeMinute);
  
  // Handle cross-midnight
  if (closeTime <= openTime) {
    closeTime.setDate(closeTime.getDate() + 1);
  }
  
  const now = new Date();
  const minutesUntilOpen = Math.round((openTime.getTime() - now.getTime()) / 60000);
  const isCurrentlyOpen = now >= openTime && now < closeTime;
  
  console.log(`[MENU-DP-NORMAL] Time calculation:`, {
    currentTime: now.toISOString(),
    openTime: openTime.toISOString(),
    closeTime: closeTime.toISOString(),
    minutesUntilOpen,
    isCurrentlyOpen,
    hours: `${hours.open} - ${hours.close}`
  });
  
  if (isCurrentlyOpen) {
    // During Club Open Hours: Base price (no discount)
    console.log(`[MENU-DP-NORMAL] Currently open: ${basePrice} (no discount)`);
    return basePrice;
  } else if (minutesUntilOpen > 180) {
    // Club Open Days, 3+ hours before opening: 30% discount
    const finalPrice = Math.round(basePrice * 0.7 * 100) / 100;
    console.log(`[MENU-DP-NORMAL] 3+ hours before opening: ${basePrice} * 0.7 = ${finalPrice} (${minutesUntilOpen}min away)`);
    return finalPrice;
  } else if (minutesUntilOpen > 0) {
    // Club Open Days, < 3 hours before opening: 10% discount
    const finalPrice = Math.round(basePrice * 0.9 * 100) / 100;
    console.log(`[MENU-DP-NORMAL] <3 hours before opening: ${basePrice} * 0.9 = ${finalPrice} (${minutesUntilOpen}min away)`);
    return finalPrice;
  } else {
    // Club is closed for the day (after hours)
    const finalPrice = Math.round(basePrice * 0.7 * 100) / 100;
    console.log(`[MENU-DP-NORMAL] After hours: ${basePrice} * 0.7 = ${finalPrice} (${minutesUntilOpen}min past close)`);
    return finalPrice;
  }
}

/**
 * Dynamic pricing for general covers (non-event tickets)
 */
export function computeDynamicCoverPrice(input: Omit<DynamicPriceInput, 'useDateBasedLogic'>): number {
  return computeDynamicPrice({ ...input, useDateBasedLogic: false });
}

/**
 * Get dynamic pricing reason for normal tickets (covers, menu)
 */
export function getNormalTicketDynamicPricingReason(input: DynamicPriceInput): string | undefined {
  const {
    clubOpenDays,
    openHours,
    availableDate,
  } = input;



  // Use the selected date if provided, otherwise use current time
  const referenceDate = availableDate ? (availableDate instanceof Date ? availableDate : new Date(availableDate)) : new Date();
  let openHoursArr = Array.isArray(openHours) ? openHours : [];
  
  if (!Array.isArray(openHours) && typeof openHours === "string") {
    return undefined; // No dynamic pricing
  }
  
  // Check if the selected date is open
  const dateStatus = isDateOpen(referenceDate, openHoursArr, clubOpenDays);
  

  
  if (dateStatus.isOpen) {
    // Club is open on the selected date - no discount
    return undefined;
  }
  
  // Club is closed on the selected date - check if it's the same day or different day
  if (dateStatus.openTime) {
    // Use CURRENT TIME to calculate minutes until the club opens on the selected date
    const now = new Date();
    const minutesUntilOpen = Math.round((dateStatus.openTime.getTime() - now.getTime()) / 60000);
    
    if (minutesUntilOpen > 180) {
      // More than 3 hours before open on the same day: 30% off
      return "closed_day";
    } else if (minutesUntilOpen > 120) {
      // 2-3 hours before open on the same day: 10% off
      return "early";
    } else {
      // 2 hours or less before open or during open hours: full price
      return "open";
    }
  }
  
  // Different day and closed: 30% off
  return "closed_day";
}

/**
 * Get dynamic pricing reason for event tickets
 */
export function getEventTicketDynamicPricingReason(eventDate: Date, eventOpenHours?: { open: string, close: string }): string | undefined {
  if (!(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
    return undefined;
  }
  
  // Combine event date with event open time to get the actual event start time
  let eventStartTime = new Date(eventDate);
  
  if (eventOpenHours && eventOpenHours.open) {
    const [openHour, openMinute] = eventOpenHours.open.split(':').map(Number);
    
    // Handle the case where eventDate is a date string from database (like "2025-07-29")
    if (eventDate.toISOString().includes('T00:00:00')) {
      // This is a date-only string from database, create proper event time
      const dateStr = eventDate.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Create event start time in local timezone (Colombian time)
      eventStartTime = new Date(year, month - 1, day, openHour, openMinute, 0, 0);
    } else {
      // This is already a proper datetime, just set the hours
      eventStartTime = new Date(eventDate);
      eventStartTime.setHours(openHour, openMinute, 0, 0);
    }
  }
  
  const now = new Date();
  const hoursUntilEvent = Math.floor(
    (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  );
  
  if (isNaN(hoursUntilEvent)) {
    return undefined;
  }
  
  if (hoursUntilEvent >= 48) {
    // 48+ hours away: 30% discount
    return "event_advance";
  }
  if (hoursUntilEvent >= 24) {
    // 24-48 hours away: base price
    return undefined; // No discount
  }
  if (hoursUntilEvent >= 0) {
    // Less than 24 hours: 20% surplus
    return "event_last_minute";
  }
  
  // Event has started - check grace period
  const hoursSinceEventStarted = Math.abs(hoursUntilEvent);
  if (hoursSinceEventStarted <= 1) {
    // Within 1 hour grace period: 30% surplus
    return "event_grace_period";
  }
  
  // Event has passed grace period: blocked
  return "event_expired";
}

/**
 * Dynamic pricing for menu items on event dates
 * - Menu items can get discounts but NEVER surcharges (floor at base price)
 * - Uses event time windows but caps at base price
 */
export function computeDynamicMenuEventPrice(basePrice: number, eventDate: Date, eventOpenHours?: { open: string, close: string }): number {
  if (!basePrice || basePrice <= 0 || isNaN(basePrice) || !(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
    return 0;
  }
  if (basePrice === 0) {
    return 0;
  }
  
  // Combine event date with event open time to get the actual event start time
  let eventStartTime = new Date(eventDate);
  
  if (eventOpenHours && eventOpenHours.open) {
    const [openHour, openMinute] = eventOpenHours.open.split(':').map(Number);
    
    // Handle the case where eventDate is a date string from database (like "2025-07-29")
    if (eventDate.toISOString().includes('T00:00:00')) {
      // This is a date-only string from database, create proper event time
      const dateStr = eventDate.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Create event start time in local timezone (Colombian time)
      eventStartTime = new Date(year, month - 1, day, openHour, openMinute, 0, 0);
    } else {
      // This is already a proper datetime, just set the hours
      eventStartTime = new Date(eventDate);
      eventStartTime.setHours(openHour, openMinute, 0, 0);
    }
  }
  
  const now = new Date();
  const hoursUntilEvent = Math.floor(
    (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  );
  
  console.log(`[MENU-DP-EVENT] Event pricing calculation:`, {
    eventStartTime: eventStartTime.toISOString(),
    currentTime: now.toISOString(),
    hoursUntilEvent,
    basePrice,
    eventOpenHours
  });
  
  if (isNaN(hoursUntilEvent)) {
    console.log(`[MENU-DP-EVENT] Invalid hours calculation, returning base price`);
    return basePrice;
  }
  
  let multiplier: number;
  
  if (hoursUntilEvent >= 48) {
    // 48+ hours away: 30% discount
    multiplier = DYNAMIC_PRICING.EVENT.HOURS_48_PLUS; // 0.7
    console.log(`[MENU-DP-EVENT] Using 48+ hours rule: ${multiplier} (${hoursUntilEvent}h away)`);
  } else if (hoursUntilEvent >= 24) {
    // 24-48 hours away: base price
    multiplier = DYNAMIC_PRICING.EVENT.HOURS_24_48; // 1.0
    console.log(`[MENU-DP-EVENT] Using 24-48 hours rule: ${multiplier} (${hoursUntilEvent}h away)`);
  } else {
    // <24 hours: base price (NEVER apply surcharges to menu items)
    multiplier = DYNAMIC_PRICING.EVENT.HOURS_24_48; // 1.0 (base price, not surcharge)
    console.log(`[MENU-DP-EVENT] Using <24 hours rule: ${multiplier} (${hoursUntilEvent}h away)`);
  }
  
  // Calculate price and clamp to never exceed base price
  const calculatedPrice = Math.round(basePrice * multiplier * 100) / 100;
  const finalPrice = Math.min(calculatedPrice, basePrice); // Floor at base price
  console.log(`[MENU-DP-EVENT] Final calculation: ${basePrice} * ${multiplier} = ${calculatedPrice} → ${finalPrice}`);
  return finalPrice;
}

/**
 * Dynamic pricing for event tickets (based on hours until event)
 */
export function computeDynamicEventPrice(basePrice: number, eventDate: Date, eventOpenHours?: { open: string, close: string }): number {
  if (!basePrice || basePrice <= 0 || isNaN(basePrice) || !(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
    return 0;
  }
  if (basePrice === 0) {
    return 0;
  }
  
  // Combine event date with event open time to get the actual event start time
  let eventStartTime = new Date(eventDate);
  
  if (eventOpenHours && eventOpenHours.open) {
    const [openHour, openMinute] = eventOpenHours.open.split(':').map(Number);
    
    // Handle the case where eventDate is a date string from database (like "2025-07-29")
    // We need to create the event start time properly
    if (eventDate.toISOString().includes('T00:00:00')) {
      // This is a date-only string from database, create proper event time
      const dateStr = eventDate.toISOString().split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Create event start time in local timezone (Colombian time)
      eventStartTime = new Date(year, month - 1, day, openHour, openMinute, 0, 0);
    } else {
      // This is already a proper datetime, just set the hours
      eventStartTime = new Date(eventDate);
      eventStartTime.setHours(openHour, openMinute, 0, 0);
    }
  }
  
  const now = new Date();
  
  const hoursUntilEvent = Math.floor(
    (eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  );
  
  if (isNaN(hoursUntilEvent)) {
    return basePrice;
  }
  
  if (hoursUntilEvent >= 48) {
    // 48+ hours away: 30% discount
    const multiplier = getEventPricingMultiplier(hoursUntilEvent);
    const discountedPrice = Math.round(basePrice * multiplier * 100) / 100;
    return discountedPrice;
  }
  if (hoursUntilEvent >= 24) {
    // 24-48 hours away: base price
    const multiplier = getEventPricingMultiplier(hoursUntilEvent);
    const basePriceResult = Math.round(basePrice * multiplier * 100) / 100;
    return basePriceResult;
  }
  if (hoursUntilEvent >= 0) {
    // Less than 24 hours: 20% surplus
    const multiplier = getEventPricingMultiplier(hoursUntilEvent);
    const surplusPrice = Math.round(basePrice * multiplier * 100) / 100;
    return surplusPrice;
  }
  
  // Event has started - check grace period
  const hoursSinceEventStarted = Math.abs(hoursUntilEvent);
  if (hoursSinceEventStarted <= 1) {
    // Within 1 hour grace period: 30% surplus
    const gracePeriodPrice = Math.round(basePrice * 1.3 * 100) / 100;
    return gracePeriodPrice;
  }
  
  // Event has passed grace period: block purchase
  return -1; // Special value to indicate blocked purchase
}