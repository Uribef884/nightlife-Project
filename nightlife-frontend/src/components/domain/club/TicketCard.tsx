// nightlife-frontend/src/components/domain/club/TicketCard.tsx
"use client";

import { useMemo, useState } from "react";
import type { TicketDTO } from "@/services/clubs.service";
import { nowInBogota, parseBogotaDate } from '@/utils/timezone';
import { EVENT_GRACE_PERIOD_HOURS } from '@/lib/constants';
import { ShareButton } from "@/components/common/ShareButton";
import type { ShareableTicket } from "@/utils/share";

// Local types for type safety
type TicketWithAny = {
  id?: string | number;
  name?: string;
  title?: string;
  description?: string;
  details?: string;
  about?: string;
  currency?: string;
  dynamicPrice?: string | number;
  price?: string | number;
  dynamicPricingEnabled?: boolean;
  available?: number;
  remaining?: number;
  availableQty?: number;
  availableQuantity?: number;
  quantity?: number;
  maxPerPerson?: number;
  maxPerUser?: number;
  max?: number;
  includesMenuItem?: boolean;
  includedMenuItems?: unknown[];
  includedItems?: unknown[];
  includes?: unknown[];
  menuItems?: unknown[];
  category?: string;
  event?: {
    availableDate?: string;
    openHours?: {
      open?: string;
    };
  };
  availableDate?: string;
};

type IncludedItem = {
  menuItemName?: string;
  name?: string;
  title?: string;
  itemName?: string;
  menuItem?: {
    name?: string;
  };
  quantity?: string | number;
  qty?: string | number;
  variantName?: string;
  variant?: {
    name?: string;
  };
};

export type TicketCardProps = {
  ticket: TicketDTO;
  qtyInCart?: number;
  itemId?: string;
  onAdd: () => void;
  onChangeQty: (itemId: string, nextQty: number) => void;
  compact?: boolean;
  showDescription?: boolean;
  isFree?: boolean;
  clubId?: string;
  clubName?: string;
  showShareButton?: boolean;
  selectedDate?: string;
};

/* ---------------- helpers ---------------- */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function getTitle(t: unknown): string {
  if (!t || typeof t !== 'object') return "Ticket";
  const ticketWithAny = t as TicketWithAny;
  return ticketWithAny.name ?? ticketWithAny.title ?? "Ticket";
}
function getDescription(t: unknown): string {
  if (!t || typeof t !== 'object') return "";
  const ticketWithAny = t as TicketWithAny;
  return ticketWithAny.description ?? ticketWithAny.details ?? ticketWithAny.about ?? "";
}
function getPrice(t: unknown): { price: number | null; compareAt: number | null; currency: string } {
  if (!t || typeof t !== 'object') return { price: null, compareAt: null, currency: "COP" };
  const ticketWithAny = t as TicketWithAny;
  const currency: string = ticketWithAny.currency || "COP";
  const dynamic = toNum(ticketWithAny.dynamicPrice);
  const base = toNum(ticketWithAny.price);
  
  // For event tickets, always use dynamic price if available (includes grace period pricing)
  // For other tickets, only use dynamic pricing if it's enabled
  const shouldUseDynamic = ticketWithAny.category === "event" 
    ? (dynamic != null && !isNaN(dynamic) && base != null)
    : (ticketWithAny.dynamicPricingEnabled && dynamic != null && !isNaN(dynamic) && base != null);
  
  if (shouldUseDynamic && dynamic != null && base != null) {
    // Only show strike-through if there's a significant discount (more than 1% difference)
    // This prevents showing strike-through when prices are equal or very close
    const discountThreshold = 0.01; // 1% threshold
    if (dynamic < base * (1 - discountThreshold)) {
      return { price: dynamic, compareAt: base, currency };
    }
    // If dynamic price is higher, equal, or very close to base price, just show the dynamic price
    return { price: dynamic, compareAt: null, currency };
  }
  
  return { price: base, compareAt: null, currency };
}
function getAvailable(t: unknown): number | null {
  if (!t || typeof t !== 'object') return null;
  const ticketWithAny = t as TicketWithAny;
  if (isNum(ticketWithAny.available)) return ticketWithAny.available;
  if (isNum(ticketWithAny.remaining)) return ticketWithAny.remaining;
  if (isNum(ticketWithAny.availableQty)) return ticketWithAny.availableQty;
  if (isNum(ticketWithAny.availableQuantity)) return ticketWithAny.availableQuantity;
  if (isNum(ticketWithAny.quantity)) return ticketWithAny.quantity;
  return null;
}
function getMaxPerUser(t: unknown): number | null {
  if (!t || typeof t !== 'object') return null;
  const ticketWithAny = t as TicketWithAny;
  if (isNum(ticketWithAny.maxPerPerson)) return ticketWithAny.maxPerPerson;
  if (isNum(ticketWithAny.maxPerUser)) return ticketWithAny.maxPerUser;
  if (isNum(ticketWithAny.max)) return ticketWithAny.max;
  return null;
}
function fmtMoney(n: number | null, currency = "COP"): string {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(n);
  } catch {
    return `$ ${n.toLocaleString("es-CO")}`;
  }
}
/** Decide if ticket is a COMBO in the UI (always show includes). */
function isCombo(t: unknown): boolean {
  if (!t || typeof t !== 'object') return false;
  const ticketWithAny = t as TicketWithAny;
  if (ticketWithAny.includesMenuItem === true) return true;
  const arr = ticketWithAny.includedMenuItems;
  return Array.isArray(arr) && arr.length > 0;
}
/** Convert `includedMenuItems` (or fallbacks) into "Q× Name (Variant)" lines. */
function getIncludedLines(t: unknown): string[] {
  if (!t || typeof t !== 'object') return [];
  const ticketWithAny = t as TicketWithAny;
  
  const raw =
    (Array.isArray(ticketWithAny.includedMenuItems) && ticketWithAny.includedMenuItems) ||
    (Array.isArray(ticketWithAny.includedItems) && ticketWithAny.includedItems) ||
    (Array.isArray(ticketWithAny.includes) && ticketWithAny.includes) ||
    (Array.isArray(ticketWithAny.menuItems) && ticketWithAny.menuItems) ||
    [];

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const includedItem = it as IncludedItem;
    
    const baseName =
      includedItem.menuItemName ?? includedItem.name ?? includedItem.title ?? includedItem.itemName ?? includedItem.menuItem?.name ?? "";
    
    if (!baseName) {
      continue;
    }

    const qty = toNum(includedItem.quantity) ?? toNum(includedItem.qty) ?? 1;
    const variant = includedItem.variantName ?? includedItem.variant?.name ?? null;
    const label = variant ? `${String(baseName)} (${String(variant)})` : String(baseName);
    const line = `${qty ?? 1}× ${label}`;
    lines.push(line);
  }
  
  return lines;
}

/* ---------------- component ---------------- */
export default function TicketCard({
  ticket,
  qtyInCart = 0,
  itemId = "",
  onAdd,
  onChangeQty,
  compact = true,
  showDescription = true,
  isFree = false,
  clubId,
  clubName,
  showShareButton = false,
  selectedDate,
}: TicketCardProps) {
  const title = getTitle(ticket);
  const desc = getDescription(ticket);
  const includes = getIncludedLines(ticket);
  const combo = isCombo(ticket);

  const { price, compareAt } = getPrice(ticket);
  


  const available = getAvailable(ticket);
  const maxPerUser = getMaxPerUser(ticket);
  const soldOut = available !== null && available <= 0;
  
  // Simple grace period logic: if currentTime > eventStart + 1 hour, then unavailable
  let isUnavailableDueToGracePeriod = false;
  
  const ticketWithAny = ticket as TicketWithAny;
  if (ticketWithAny.category === "event") {
    
    // Get event date and open hours
    const eventDate = ticketWithAny.event?.availableDate ? new Date(ticketWithAny.event.availableDate) : 
                     ticketWithAny.availableDate ? new Date(ticketWithAny.availableDate) : null;
    const openHours = ticketWithAny.event?.openHours;
    
    if (eventDate && openHours?.open) {
      // Parse event date correctly as a local Bogota date
      let eventDateStr: string;
      
      if (ticketWithAny.event?.availableDate) {
        // Use the event date string directly - it should be in YYYY-MM-DD format
        eventDateStr = ticketWithAny.event.availableDate;
      } else if (ticketWithAny.availableDate) {
        // Fallback to ticket's available date
        eventDateStr = ticketWithAny.availableDate;
      } else {
        // Convert Date object to YYYY-MM-DD string in Bogota timezone for parsing
        eventDateStr = parseBogotaDate(eventDate.toISOString().split('T')[0]).toISODate()!;
      }
      
      // Parse the event date in Bogota timezone
      const eventDateBogota = parseBogotaDate(eventDateStr);
      
      // Parse open time (e.g., "18:00" -> 18 hours, 0 minutes)  
      const [openHour, openMinute] = openHours.open.split(':').map(Number);
      const eventStart = eventDateBogota.set({ hour: openHour, minute: openMinute, second: 0, millisecond: 0 });
      
      // Grace period ends after configured hours after event starts
      const gracePeriodEnd = eventStart.plus({ hours: EVENT_GRACE_PERIOD_HOURS });
      const now = nowInBogota();
      
      // SIMPLE LOGIC: If current time > grace period end, then unavailable
      isUnavailableDueToGracePeriod = now > gracePeriodEnd;
      
    }
  }
  
  const isUnavailable = soldOut || isUnavailableDueToGracePeriod;

  const maxAllowed = useMemo(() => {
    const fromAvail = available == null ? Infinity : Math.max(0, available);
    const fromMax = maxPerUser == null ? Infinity : Math.max(0, maxPerUser);
    return Math.min(fromAvail, fromMax);
  }, [available, maxPerUser]);

  const [expandedDesc, setExpandedDesc] = useState(false);
  const [showAllIncludes, setShowAllIncludes] = useState(false);
  const isLongDesc = useMemo(() => (desc?.length ?? 0) > 110, [desc]);

  const canInc = qtyInCart < maxAllowed;
  const canDec = qtyInCart > 0;

  return (
    <div
      className={[
        "rounded-xl border",
        isFree ? "border-yellow-400/40 bg-yellow-500/10" : "border-white/10 bg-white/5",
        compact ? "p-3" : "p-4",
      ].join(" ")}
      data-ticket-id={String(ticketWithAny.id)}
    >
      {/* Header */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className={compact ? "text-[15px] font-semibold text-white" : "text-base font-semibold text-white"}>
            {title}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* COMBO badge */}
            {combo && (
              <span className="inline-flex items-center rounded-full bg-fuchsia-700/30 text-fuchsia-200 text-[10px] font-semibold px-2 py-0.5 ring-1 ring-fuchsia-400/30">
                COMBO
              </span>
            )}

            {/* Share button */}
            {showShareButton && clubId && (
              <ShareButton
                options={{
                  ticket: {
                    id: String(ticketWithAny.id),
                    name: title,
                    description: desc,
                    price: price || 0,
                    dynamicPrice: ticketWithAny.dynamicPrice ? Number(ticketWithAny.dynamicPrice) : undefined,
                    dynamicPricingEnabled: ticketWithAny.dynamicPricingEnabled,
                    category: ticketWithAny.category || 'general',
                    clubId: clubId,
                    clubName: clubName,
                    eventId: ticketWithAny.event?.id ? String(ticketWithAny.event.id) : undefined,
                    eventName: ticketWithAny.event?.name,
                    eventDate: ticketWithAny.event?.availableDate || ticketWithAny.availableDate
                  },
                  clubId: clubId,
                  clubName: clubName,
                  selectedDate: selectedDate
                }}
                variant="button-gray"
                size="sm"
              />
            )}
          </div>
        </div>

                 <div className="mt-0.5 flex items-baseline gap-2">
           {compareAt && price && compareAt > price ? (
             <>
               <span className={compact ? "text-white text-[15px] font-bold" : "text-white text-lg font-bold"}>
                 {fmtMoney(price, "COP")}
               </span>
               <span className={compact ? "text-purple-400 text-[13px] line-through font-medium" : "text-purple-400 text-base line-through font-medium"}>
                 {fmtMoney(compareAt, "COP")}
               </span>
             </>
           ) : (
             <span className={compact ? "text-white text-[15px] font-bold" : "text-white text-lg font-bold"}>
               {price ? fmtMoney(price, "COP") : "Gratis"}
             </span>
           )}
         </div>

        {showDescription && desc && (
          <div className="mt-1 text-[12px] text-white/70">
            <div className={expandedDesc ? "" : "line-clamp-2"}>{desc}</div>
            {isLongDesc && (
              <button
                type="button"
                onClick={() => setExpandedDesc((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white/80"
              >
                {expandedDesc ? "Ver menos" : "Ver más"}
                <svg
                  className={`h-4 w-4 transition-transform ${expandedDesc ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 12.5l-5-5h10l-5 5z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Included menu items */}
      {includes.length > 0 && (
        <div
          className={[
            "mt-2 rounded-lg border border-white/10 bg-white/5",
            combo ? "p-2.5" : "p-2.5",
          ].join(" ")}
        >
          <div className="text-[11px] font-medium text-white/90 mb-1.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Incluye:
          </div>

          {/* For COMBO: always fully visible (but capped height with thin scroll) */}
          <ul
            className={[
              "space-y-1",
              combo ? "max-h-28 overflow-auto pr-1 custom-scrollbar-thin" : "",
            ].join(" ")}
          >
            {(combo ? includes : showAllIncludes ? includes : includes.slice(0, 3)).map((line, idx) => (
              <li key={idx} className="flex items-start gap-2 text-[13px] leading-[1.25rem]">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0 mt-2"></div>
                <span className="text-white/90 font-medium break-words">{line}</span>
              </li>
            ))}
          </ul>

          {/* For NON-combo: keep “Ver todo” if many items */}
          {!combo && includes.length > 3 && (
            <button
              type="button"
              className="mt-1.5 text-[11px] text-green-400 hover:text-green-300 font-medium transition-colors"
              onClick={() => setShowAllIncludes((v) => !v)}
            >
              {showAllIncludes ? "Ver menos" : `Ver todo (${includes.length})`}
            </button>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="mt-2 text-[11px] text-white/60 flex items-center gap-3">
        {available != null && (
          <span>
            Disponible(s): <span className="text-white/80 font-medium">{available}</span>
          </span>
        )}
        {maxPerUser != null && (
          <span>
            Máx: <span className="text-white/80">{maxPerUser}</span>
          </span>
        )}
      </div>

      {/* CTA / Stepper */}
      <div className="mt-2.5">
        {qtyInCart > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canDec && onChangeQty(itemId, qtyInCart - 1)}
              disabled={!canDec}
              className={[
                "h-8 w-8 rounded-full text-sm font-bold",
                canDec ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/5 text-white/40 cursor-not-allowed",
              ].join(" ")}
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <div className="min-w-[2rem] text-center text-sm text-white/90">{qtyInCart}</div>
            <button
              type="button"
              onClick={() => canInc && onChangeQty(itemId, qtyInCart + 1)}
              disabled={!canInc}
              className={[
                "h-8 w-8 rounded-full text-sm font-bold",
                canInc ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/5 text-white/40 cursor-not-allowed",
              ].join(" ")}
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={isUnavailable}
            className={[
              "w-full rounded-full py-2 text-sm font-semibold",
              isUnavailable
                ? "bg-white/10 text-white/60 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white",
            ].join(" ")}
          >
            {isUnavailable ? (soldOut ? "AGOTADO" : "No disponible") : "Agregar al carrito"}
          </button>
        )}
      </div>
    </div>
  );
}

/* Tailwind helper: very thin scrollbar for includes */
declare global {
  interface HTMLElementTagNameMap {
    "div-custom": HTMLDivElement;
  }
}

