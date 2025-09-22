import {
  DYNAMIC_PRICING,
  getEventTicketPricingMultiplier,
  getEventMenuPricingMultiplier,
  getEventTicketPricingReason,
  getMenuEventPricingReason, // explicit reasons for event menu
  getCoversPricingReason,
  getMenuNormalPricingReason,
  getFreeTicketReason,
  getTicketDisabledReason,
  getMenuParentHasVariantsReason,
  getMenuVariantDisabledReason
} from "../config/fees";

/**
 * ──────────────────────────────────────────────────────────────────────────────
 *  TIMEZONE UTILITIES  —  keep math in UTC, interpret schedules in Bogotá TZ
 * ──────────────────────────────────────────────────────────────────────────────
 */
const BOGOTA_TZ = "America/Bogota";

/** Format a UTC instant as Bogotá wall-clock for logs (no double shift). */
function formatBogota(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(d);
}

/** Convert a Bogotá wall-clock (y,m,d, hh:mm) to the true UTC instant. */
function bogotaClockToUTC(
  year: number,
  month1to12: number,
  day: number,
  hour0to23: number,
  minute0to59: number
): Date {
  // Bogotá is UTC-5 → UTC = Bogotá + 5h
  return new Date(Date.UTC(year, month1to12 - 1, day, hour0to23 + 5, minute0to59, 0, 0));
}

/** Read the calendar date (Y/M/D) of a UTC instant as seen in Bogotá. */
function getBogotaYMD(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);

  const y = Number(parts.find(p => p.type === "year")!.value);
  const m = Number(parts.find(p => p.type === "month")!.value);
  const day = Number(parts.find(p => p.type === "day")!.value);
  return { y, m, day };
}

/** Build the Bogotá open/close window (as UTC instants) for a given reference date. */
function buildBogotaOpenCloseUTC(
  referenceDate: Date,
  hours: { open: string; close: string }
): { openUTC: Date; closeUTC: Date } {
  const { y, m, day } = getBogotaYMD(referenceDate);
  const [oh, om] = hours.open.trim().split(":").map(Number);
  const [ch, cm] = hours.close.trim().split(":").map(Number);

  const openUTC = bogotaClockToUTC(y, m, day, oh, om);
  let closeUTC = bogotaClockToUTC(y, m, day, ch, cm);

  // Cross-midnight → close is next Bogotá day
  if (closeUTC.getTime() <= openUTC.getTime()) {
    closeUTC = new Date(closeUTC.getTime() + 24 * 60 * 60 * 1000);
  }
  return { openUTC, closeUTC };
}

/**
 * If a "date-only" value arrives as 00:00:00Z (e.g., '2025-09-18T00:00:00.000Z'),
 * that is *not* the intended instant locally. Normalize it to the intended Bogotá
 * calendar day by anchoring at Bogotá noon (stable reference).
 */
function normalizeToBogotaDay(ref: Date): Date {
  const [ys, ms, ds] = ref.toISOString().slice(0, 10).split("-");
  const y = Number(ys), m = Number(ms), d = Number(ds);
  return bogotaClockToUTC(y, m, d, 12, 0); // 12:00 Bogotá
}

/** Derive an event start UTC instant from eventDate + Bogotá open time (handles date-only). */
function buildEventStartUTC(eventDate: Date, eventOpenHours?: { open: string; close: string }): Date {
  if (!eventOpenHours?.open) return new Date(eventDate); // assume it's already the true instant
  const [oh, om] = eventOpenHours.open.split(":").map(Number);

  // If eventDate is a date-only midnight Z, interpret its Y-M-D as the intended Bogotá date
  const isMidnightZ =
    eventDate.getUTCHours() === 0 &&
    eventDate.getUTCMinutes() === 0 &&
    eventDate.getUTCSeconds() === 0 &&
    eventDate.getUTCMilliseconds() === 0;

  if (isMidnightZ) {
    const [ys, ms, ds] = eventDate.toISOString().slice(0, 10).split("-");
    return bogotaClockToUTC(Number(ys), Number(ms), Number(ds), oh, om);
  }

  // Otherwise, keep the Bogotá calendar day derived from the actual instant
  const { y, m, day } = getBogotaYMD(eventDate);
  return bogotaClockToUTC(y, m, day, oh, om);
}

/** Consistent "now" bundle for logs (do not use strings for math). */
function nowForLogs() {
  const nowUTC = new Date();
  return {
    now_utc: nowUTC.toISOString(),
    now_bogota: formatBogota(nowUTC),
    tz: BOGOTA_TZ
  };
}

/** Public helper kept for compatibility (true UTC now). */
export function getCurrentColombiaTime(): Date {
  return new Date();
}

/** 
 * PRICE GUARD — prevents negatives and prevents discounts from exceeding base.
 * NOTE: For surcharges (event tickets <24h / grace), this still caps to base
 * only where business rules require it. We only call this where discounts apply.
 */
function clampPrice(price: number, basePrice: number): number {
  if (price < 0) return 0;
  if (price > basePrice) return basePrice;
  return price;
}

/**
 * Is the club open *now* for the intended Bogotá calendar day of `referenceDate`?
 * Returns window UTC instants so we can compute minutes-until-open correctly.
 */
function isDateOpen(
  referenceDate: Date,
  openHoursArr: { day: string; open: string; close: string }[],
  clubOpenDays: string[]
): { isOpen: boolean; openTime?: Date; closeTime?: Date } {
  const logs = nowForLogs();
  const nowUTC = new Date();

  // Normalize to intended Bogotá day (fixes date-only inputs)
  const refBogotaDay = normalizeToBogotaDay(referenceDate);

  // Weekday as seen in Bogotá for the intended day
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: BOGOTA_TZ, weekday: "long" }).format(refBogotaDay);

  if (!clubOpenDays.includes(dayName)) {
    console.log(`[IS-DATE-OPEN] Closed weekday for selected date`, {
      ...logs,
      selected_bogota_day: dayName,
      clubOpenDays
    });
    return { isOpen: false };
  }

  const hours = openHoursArr.find(h => h.day === dayName);
  if (!hours) {
    console.log(`[IS-DATE-OPEN] No hours configured for weekday`, {
      ...logs,
      selected_bogota_day: dayName
    });
    return { isOpen: false };
  }

  const { openUTC, closeUTC } = buildBogotaOpenCloseUTC(refBogotaDay, hours);

  const isOpen = nowUTC.getTime() >= openUTC.getTime() && nowUTC.getTime() < closeUTC.getTime();

  console.log(`[IS-DATE-OPEN] Window & now`, {
    ...logs,
    selected_bogota_day: dayName,
    open_utc: openUTC.toISOString(),
    open_bogota: formatBogota(openUTC),
    close_utc: closeUTC.toISOString(),
    close_bogota: formatBogota(closeUTC),
    isOpen
  });

  return { isOpen, openTime: openUTC, closeTime: closeUTC };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface DynamicPriceInput {
  basePrice: number;
  clubOpenDays: string[];
  openHours: string | { day: string; open: string; close: string }[];
  availableDate?: Date;
  useDateBasedLogic?: boolean;
}

/**
 * Generic dynamic pricing:
 * - Covers/Menu (non-event): time-to-open discounts
 * - Event style (useDateBasedLogic=true): time-to-event windows (reuses covers tiers)
 * 
 * @deprecated For events, use dedicated event functions instead:
 * - computeDynamicEventPrice() for event tickets
 * - computeDynamicMenuEventPrice() for event menu items
 * - getEventTicketDynamicPricingReason() for event ticket reasons
 * - getMenuEventDynamicPricingReason() for event menu reasons
 */
export function computeDynamicPrice(input: DynamicPriceInput): number {
  const { basePrice, clubOpenDays, openHours, availableDate, useDateBasedLogic = false } = input;

  if (!basePrice || basePrice <= 0 || isNaN(basePrice)) return 0;

  const nowUTC = new Date();

  // Event-style window when requested
  if (useDateBasedLogic && availableDate) {
    console.warn('[DEPRECATED] computeDynamicPrice with useDateBasedLogic=true is deprecated for events. Use dedicated event functions instead: computeDynamicEventPrice(), computeDynamicMenuEventPrice(), etc.');
    const eventStartUTC = buildEventStartUTC(availableDate instanceof Date ? availableDate : new Date(availableDate));
    const hoursUntilEvent = Math.floor((eventStartUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60));

    if (hoursUntilEvent > 3) {
      return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_3_PLUS * 100) / 100, basePrice);
    } else if (hoursUntilEvent > 2) {
      return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_2_3 * 100) / 100, basePrice);
    } else {
      return basePrice;
    }
  }

  // Covers/Menu general (non-event)
  if (!Array.isArray(openHours) && typeof openHours === "string") {
    // Treat as always open → base
    return basePrice;
  }

  const referenceDate = availableDate
    ? (availableDate instanceof Date ? availableDate : new Date(availableDate))
    : new Date();

  const dateStatus = isDateOpen(referenceDate, openHours as any, clubOpenDays);

  if (dateStatus.isOpen) return basePrice;

  if (dateStatus.openTime) {
    const minutesUntilOpen = Math.round((dateStatus.openTime.getTime() - nowUTC.getTime()) / 60000);

    if (minutesUntilOpen > 180) {
      return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_3_PLUS * 100) / 100, basePrice);
    } else if (minutesUntilOpen > 120) {
      return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_2_3 * 100) / 100, basePrice);
    } else {
      return basePrice;
    }
  }

  // Closed day → next open is different day → 30% off
  return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_3_PLUS * 100) / 100, basePrice);
}

/**
 * Menu items on normal (non-event) days (variants policy enforced)
 * Rules:
 * - Closed day → 30% off
 * - 3+ hours before open → 30% off
 * - <3 hours before open → 10% off
 * - During open hours → base
 * - Policy:
 *    - Parent (has variants) → no DP
 *    - Variant with dynamicEnabled=false → no DP
 */
export function computeDynamicMenuNormalPrice(input: {
  basePrice: number;
  clubOpenDays: string[];
  openHours: { day: string; open: string; close: string }[];
  selectedDate?: Date;
  isVariant?: boolean;           // optional
  parentHasVariants?: boolean;   // optional
  dynamicEnabled?: boolean;      // optional
}): number {
  const { basePrice, clubOpenDays, openHours, selectedDate, isVariant, parentHasVariants, dynamicEnabled } = input;

  if (!basePrice || basePrice <= 0) return 0;

  // Policy gates
  if (parentHasVariants && !isVariant) {
    // Parent item with variants cannot have DP
    return basePrice;
  }
  if (isVariant && dynamicEnabled === false) {
    // Variant can disable DP independently
    return basePrice;
  }

  const rawRef =
    selectedDate instanceof Date
      ? selectedDate
      : selectedDate
      ? new Date(String(selectedDate).includes("T") ? String(selectedDate) : String(selectedDate) + "T12:00:00Z")
      : new Date();

  const referenceDate = normalizeToBogotaDay(rawRef);

  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: BOGOTA_TZ, weekday: "long" }).format(referenceDate);

  if (!clubOpenDays.includes(dayName)) {
    // Closed weekday → 30% off
    return Math.round(basePrice * DYNAMIC_PRICING.MENU.CLOSED_DAY * 100) / 100;
  }

  const hours = openHours.find(h => h.day === dayName);
  if (!hours) {
    // No hours configured → treat as closed
    return Math.round(basePrice * DYNAMIC_PRICING.MENU.CLOSED_DAY * 100) / 100;
  }

  const { openUTC, closeUTC } = buildBogotaOpenCloseUTC(referenceDate, hours);
  const nowUTC = new Date();

  const isCurrentlyOpen = nowUTC.getTime() >= openUTC.getTime() && nowUTC.getTime() < closeUTC.getTime();
  const minutesUntilOpen = Math.round((openUTC.getTime() - nowUTC.getTime()) / 60000);

  if (isCurrentlyOpen) {
    return basePrice;
  } else if (minutesUntilOpen > 180) {
    return Math.round(basePrice * DYNAMIC_PRICING.MENU.HOURS_3_PLUS * 100) / 100;
  } else if (minutesUntilOpen > 0) {
    return Math.round(basePrice * DYNAMIC_PRICING.MENU.HOURS_LESS_3 * 100) / 100;
  } else {
    // After hours → closed rule for menu
    return Math.round(basePrice * DYNAMIC_PRICING.MENU.CLOSED_DAY * 100) / 100;
  }
}

/**
 * Covers (non-event)
 * Rules:
 * - 3+ hours before open → 30% off
 * - 2–3 hours before open → 10% off
 * - <2 hours before open → base
 * - During open hours → base
 */
export function computeDynamicCoverPrice(input: Omit<DynamicPriceInput, "useDateBasedLogic">): number {
  const { basePrice, clubOpenDays, openHours, availableDate } = input;

  if (!basePrice || basePrice <= 0 || isNaN(basePrice)) return 0;

  const rawRef = availableDate ? (availableDate instanceof Date ? availableDate : new Date(availableDate)) : new Date();
  const referenceDate = normalizeToBogotaDay(rawRef);

  if (!Array.isArray(openHours) && typeof openHours === "string") {
    // Treat as always open
    return basePrice;
  }

  const dateStatus = isDateOpen(referenceDate, openHours as any, clubOpenDays);
  const nowUTC = new Date();

  if (dateStatus.isOpen) return basePrice;

  if (dateStatus.openTime) {
    const minutesUntilOpen = Math.round((dateStatus.openTime.getTime() - nowUTC.getTime()) / 60000);

    if (minutesUntilOpen > 180) {
      return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_3_PLUS * 100) / 100, basePrice);
    } else if (minutesUntilOpen > 120) {
      return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_2_3 * 100) / 100, basePrice);
    } else {
      return basePrice;
    }
  }

  // Closed & next open is on another day → 30% off
  return clampPrice(Math.round(basePrice * DYNAMIC_PRICING.COVERS.HOURS_3_PLUS * 100) / 100, basePrice);
}

/** Reason for covers/menu (non-event) based on Bogotá-aware windows. */
export function getNormalTicketDynamicPricingReason(input: DynamicPriceInput): string | undefined {
  const { clubOpenDays, openHours, availableDate } = input;

  if (!Array.isArray(openHours) && typeof openHours === "string") {
    return undefined; // Treated as always open → no DP reason
  }

  const rawRef = availableDate ? (availableDate instanceof Date ? availableDate : new Date(availableDate)) : new Date();
  const referenceDate = normalizeToBogotaDay(rawRef);

  const dateStatus = isDateOpen(referenceDate, openHours as any, clubOpenDays);

  if (dateStatus.isOpen) {
    return getCoversPricingReason(0, true, false);
  }

  if (dateStatus.openTime) {
    const nowUTC = new Date();
    const minutesUntilOpen = Math.round((dateStatus.openTime.getTime() - nowUTC.getTime()) / 60000);
    return getCoversPricingReason(minutesUntilOpen, false, false);
  }

  // Closed on a different day
  return getCoversPricingReason(0, false, true);
}

/**
 * Get dynamic pricing reason for menu (normal days), with variant policy
 */
export function getMenuDynamicPricingReason(input: {
  basePrice: number;
  clubOpenDays: string[];
  openHours: { day: string; open: string; close: string }[];
  selectedDate?: Date;
  isVariant?: boolean;           // optional
  parentHasVariants?: boolean;   // optional
  dynamicEnabled?: boolean;      // optional
}): string | undefined {
  const { basePrice, clubOpenDays, openHours, selectedDate, isVariant, parentHasVariants, dynamicEnabled } = input;
  if (!basePrice || basePrice <= 0) return undefined;

  // Policy reasons first
  if (parentHasVariants && !isVariant) {
    return getMenuParentHasVariantsReason();
  }
  if (isVariant && dynamicEnabled === false) {
    return getMenuVariantDisabledReason();
  }

  const referenceDate =
    selectedDate instanceof Date
      ? selectedDate
      : selectedDate
      ? new Date(String(selectedDate).includes("T") ? String(selectedDate) : String(selectedDate) + "T12:00:00Z")
      : new Date();

  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: BOGOTA_TZ, weekday: "long" }).format(referenceDate);

  if (!clubOpenDays.includes(dayName)) {
    return getMenuNormalPricingReason(0, false, true, false);
  }

  const hours = openHours.find(h => h.day === dayName);
  if (!hours) return getMenuNormalPricingReason(0, false, true, false);

  const { openUTC, closeUTC } = buildBogotaOpenCloseUTC(referenceDate, hours);
  const nowUTC = new Date();

  if (nowUTC.getTime() >= openUTC.getTime() && nowUTC.getTime() < closeUTC.getTime()) {
    return getMenuNormalPricingReason(0, true, false, false);
  }

  if (nowUTC.getTime() < openUTC.getTime()) {
    const minutesUntilOpen = Math.round((openUTC.getTime() - nowUTC.getTime()) / 60000);
    return getMenuNormalPricingReason(minutesUntilOpen, false, false, false);
  }

  // After-hours today
  return getMenuNormalPricingReason(0, false, false, true);
}

/**
 * Menu items on event days
 * Rules:
 * - 48+ hours → 30% off
 * - 24–48 hours → base
 * - <24 hours → base (no surcharge for menu)
 * - During event open hours → base (explicit reason)
 * Policy:
 *   - Parent (has variants) → no DP
 *   - Variant with dynamicEnabled=false → no DP
 */
export function computeDynamicMenuEventPrice(
  basePrice: number,
  eventDate: Date,
  eventOpenHours?: { open: string; close: string },
  options?: { isVariant?: boolean; parentHasVariants?: boolean; dynamicEnabled?: boolean } // optional
): number {
  const { isVariant, parentHasVariants, dynamicEnabled } = options || {};

  if (!basePrice || basePrice <= 0 || isNaN(basePrice) || !(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
    return 0;
  }

  // Policy gates
  if (parentHasVariants && !isVariant) return basePrice;
  if (isVariant && dynamicEnabled === false) return basePrice;

  const nowUTC = new Date();
  const eventStartUTC = buildEventStartUTC(eventDate, eventOpenHours);

  // If we know the open/close window for the event, treat in-window as base (explicit)
  let isOpenDuringEvent = false;
  let hasEventEnded = false;
  if (eventOpenHours?.open && eventOpenHours?.close) {
    const { openUTC, closeUTC } = buildBogotaOpenCloseUTC(eventStartUTC, eventOpenHours);
    isOpenDuringEvent = nowUTC >= openUTC && nowUTC < closeUTC;
    hasEventEnded = nowUTC >= closeUTC;
    if (isOpenDuringEvent) return basePrice; // explicit base during event
  }

  const hoursUntilEvent = Math.floor((eventStartUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60));

  let multiplier: number;
  if (hoursUntilEvent >= 48) {
    multiplier = DYNAMIC_PRICING.EVENT_MENU.HOURS_48_PLUS;
  } else if (hoursUntilEvent >= 24) {
    multiplier = DYNAMIC_PRICING.EVENT_MENU.HOURS_24_48;
  } else {
    multiplier = DYNAMIC_PRICING.EVENT_MENU.HOURS_LESS_24; // base
  }

  const calculated = Math.round(basePrice * multiplier * 100) / 100;
  const finalPrice = Math.min(calculated, basePrice); // never exceed base for menu
  return finalPrice;
}

/** Reason for menu items on event days (explicit Option A reasons). */
export function getMenuEventDynamicPricingReason(
  eventDate: Date,
  eventOpenHours?: { open: string; close: string },
  options?: { isVariant?: boolean; parentHasVariants?: boolean; dynamicEnabled?: boolean } // optional
): string | undefined {
  if (!(eventDate instanceof Date) || isNaN(eventDate.getTime())) return undefined;

  const { isVariant, parentHasVariants, dynamicEnabled } = options || {};
  // Policy reasons first
  if (parentHasVariants && !isVariant) return getMenuParentHasVariantsReason();
  if (isVariant && dynamicEnabled === false) return getMenuVariantDisabledReason();

  const nowUTC = new Date();
  const eventStartUTC = buildEventStartUTC(eventDate, eventOpenHours);

  let isOpenDuringEvent = false;
  let hasEventEnded = false;
  if (eventOpenHours?.open && eventOpenHours?.close) {
    const { openUTC, closeUTC } = buildBogotaOpenCloseUTC(eventStartUTC, eventOpenHours);
    isOpenDuringEvent = nowUTC >= openUTC && nowUTC < closeUTC;
    hasEventEnded = nowUTC >= closeUTC;
  }

  const hoursUntilEvent = Math.floor((eventStartUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60));
  return getMenuEventPricingReason(hoursUntilEvent, isOpenDuringEvent, hasEventEnded);
}

/**
 * Event tickets
 * Rules:
 * - 48+ hours → 30% off
 * - 24–48 hours → base
 * - <24 hours → +20%
 * - Grace (<=1h after start) → +30% (always active, even if DP disabled)
 * - After grace → blocked (-1)
 * Policy:
 * - Free tickets cannot have DP (price 0 if sale allowed; still blocked after grace)
 * - DP disabled: base before event, +30% grace, blocked after grace
 */
export function computeDynamicEventPrice(
  basePrice: number,
  eventDate: Date,
  eventOpenHours?: { open: string; close: string },
  options?: { dynamicEnabled?: boolean; isFree?: boolean } // optional
): number {
  const { dynamicEnabled, isFree } = options || {};

  if (isNaN(basePrice) || !(eventDate instanceof Date) || isNaN(eventDate.getTime())) {
    return 0;
  }

  const nowUTC = new Date();
  const eventStartUTC = buildEventStartUTC(eventDate, eventOpenHours);
  const hoursUntilEvent = Math.floor((eventStartUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60));

  // Free tickets: no DP (but expiry still enforced)
  if (isFree) {
    if (hoursUntilEvent < -1) return -1; // expired after grace
    return 0; // price = 0, regardless of window
  }

  // DP disabled: base before event, +30% grace, then blocked
  if (dynamicEnabled === false) {
    if (hoursUntilEvent >= 0) return basePrice; // base pre-event
    if (hoursUntilEvent >= -1) {
      const m = DYNAMIC_PRICING.EVENT_TICKETS.GRACE_PERIOD; // +30%
      return Math.round(basePrice * m * 100) / 100;
    }
    return -1; // expired after grace
  }

  // Normal DP
  if (hoursUntilEvent >= 48) {
    const m = getEventTicketPricingMultiplier(hoursUntilEvent);
    return Math.round(basePrice * m * 100) / 100;
  }
  if (hoursUntilEvent >= 24) {
    const m = getEventTicketPricingMultiplier(hoursUntilEvent);
    return Math.round(basePrice * m * 100) / 100;
  }
  if (hoursUntilEvent >= 0) {
    const m = getEventTicketPricingMultiplier(hoursUntilEvent);
    return Math.round(basePrice * m * 100) / 100;
  }

  // Event started → grace or block
  const hoursSinceStart = Math.abs(hoursUntilEvent);
  if (hoursSinceStart <= 1) {
    const m = getEventTicketPricingMultiplier(hoursUntilEvent);
    return Math.round(basePrice * m * 100) / 100;
  }

  return -1; // After grace → blocked
}

/** Event ticket reason (with free + DP-disabled handling). */
export function getEventTicketDynamicPricingReason(
  eventDate: Date,
  eventOpenHours?: { open: string; close: string },
  options?: { dynamicEnabled?: boolean; isFree?: boolean } // optional
): string | undefined {
  if (!(eventDate instanceof Date) || isNaN(eventDate.getTime())) return undefined;

  const { dynamicEnabled, isFree } = options || {};
  const nowUTC = new Date();
  const eventStartUTC = buildEventStartUTC(eventDate, eventOpenHours);
  const hoursUntilEvent = Math.floor((eventStartUTC.getTime() - nowUTC.getTime()) / (1000 * 60 * 60));

  if (isFree) {
    if (hoursUntilEvent < -1) return "event_expired";
    return getFreeTicketReason();
  }

  if (dynamicEnabled === false) {
    if (hoursUntilEvent >= 0) return getTicketDisabledReason(); // base while DP disabled
    if (hoursUntilEvent >= -1) return "event_grace_period";     // grace still applies
    return "event_expired";
  }

  return getEventTicketPricingReason(hoursUntilEvent);
}
