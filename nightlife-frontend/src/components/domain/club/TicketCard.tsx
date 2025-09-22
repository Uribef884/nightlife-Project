// nightlife-frontend/src/components/domain/club/TicketCard.tsx
"use client";

/* eslint-disable no-console */

import { useMemo, useState } from "react";
import type { TicketDTO } from "@/services/clubs.service";

export type TicketCardProps = {
  ticket: TicketDTO;
  bannerUrl?: string | null;
  qtyInCart?: number;
  itemId?: string;
  onAdd: () => void;
  onChangeQty: (itemId: string, nextQty: number) => void;
  compact?: boolean;
  showDescription?: boolean;
  isFree?: boolean;
};

/* ---------------- helpers ---------------- */
function toNum(v: unknown): number | null {
  const n = Number(v as any);
  return Number.isFinite(n) ? n : null;
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function getTitle(t: any): string {
  return t?.name ?? t?.title ?? "Ticket";
}
function getDescription(t: any): string {
  return t?.description ?? t?.details ?? t?.about ?? "";
}
function getPrice(t: any): { price: number | null; compareAt: number | null; currency: string } {
  const currency: string = (t?.currency as string) || "COP";
  const dynamic = toNum(t?.dynamicPrice);
  const base = toNum(t?.price);
  
  // Only use dynamic pricing if it's enabled and available
  if (t?.dynamicPricingEnabled && dynamic != null && !isNaN(dynamic) && base != null) {
    // Only show strike-through if there's a significant discount (more than 1% difference)
    // This prevents showing strike-through when prices are equal or very close
    const discountThreshold = 0.01; // 1% threshold
    if (dynamic < base * (1 - discountThreshold)) {
      return { price: dynamic, compareAt: base, currency };
    }
    // If dynamic price is higher, equal, or very close to base price, just show the dynamic price
    return { price: dynamic, compareAt: null, currency };
  }
  
  // Fall back to base price
  return { price: base, compareAt: null, currency };
}
function getAvailable(t: any): number | null {
  if (isNum(t?.available)) return t.available;
  if (isNum(t?.remaining)) return t.remaining;
  if (isNum(t?.availableQty)) return t.availableQty;
  if (isNum(t?.availableQuantity)) return t.availableQuantity;
  if (isNum(t?.quantity)) return t.quantity;
  return null;
}
function getMaxPerUser(t: any): number | null {
  if (isNum(t?.maxPerPerson)) return t.maxPerPerson;
  if (isNum(t?.maxPerUser)) return t.maxPerUser;
  if (isNum(t?.max)) return t.max;
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
function isCombo(t: any): boolean {
  if (t?.includesMenuItem === true) return true;
  const arr = t?.includedMenuItems;
  return Array.isArray(arr) && arr.length > 0;
}
/** Convert `includedMenuItems` (or fallbacks) into "Q× Name (Variant)" lines. */
function getIncludedLines(t: any): string[] {
  const raw =
    (Array.isArray(t?.includedMenuItems) && t.includedMenuItems) ||
    (Array.isArray(t?.includedItems) && t.includedItems) ||
    (Array.isArray(t?.includes) && t.includes) ||
    (Array.isArray(t?.menuItems) && t.menuItems) ||
    [];

  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const it of raw) {
    const baseName =
      it?.menuItemName ?? it?.name ?? it?.title ?? it?.itemName ?? it?.menuItem?.name ?? "";
    
    if (!baseName) {
      continue;
    }

    const qty = toNum(it?.quantity) ?? toNum(it?.qty) ?? 1;
    const variant = it?.variantName ?? it?.variant?.name ?? null;
    const label = variant ? `${String(baseName)} (${String(variant)})` : String(baseName);
    const line = `${qty ?? 1}× ${label}`;
    lines.push(line);
  }
  
  return lines;
}

/* ---------------- component ---------------- */
export default function TicketCard({
  ticket,
  bannerUrl = null,
  qtyInCart = 0,
  itemId = "",
  onAdd,
  onChangeQty,
  compact = true,
  showDescription = true,
  isFree = false,
}: TicketCardProps) {
  const title = getTitle(ticket);
  const desc = getDescription(ticket);
  const includes = getIncludedLines(ticket);
  const combo = isCombo(ticket);

  const { price, compareAt } = getPrice(ticket);
  


  const available = getAvailable(ticket);
  const maxPerUser = getMaxPerUser(ticket);
  const soldOut = available !== null && available <= 0;
  
  // Check if ticket is unavailable due to grace period being over
  // For event tickets, check if event time + grace period (1 hour) < current time
  let isUnavailableDueToGracePeriod = false;
  
  if (ticket?.category === "event" && ticket?.availableDate) {
    const eventDate = new Date(ticket.availableDate);
    const gracePeriodEnd = new Date(eventDate.getTime() + 60 * 60 * 1000); // +1 hour
    const now = new Date();
    
    isUnavailableDueToGracePeriod = now > gracePeriodEnd;
    
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
    >
      {/* Header */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className={compact ? "text-[15px] font-semibold text-white" : "text-base font-semibold text-white"}>
            {title}
          </div>

          {/* COMBO badge */}
          {combo && (
            <span className="ml-auto inline-flex items-center rounded-full bg-fuchsia-700/30 text-fuchsia-200 text-[10px] font-semibold px-2 py-0.5 ring-1 ring-fuchsia-400/30">
              COMBO
            </span>
          )}
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
            onClick={() => onAdd()}
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
