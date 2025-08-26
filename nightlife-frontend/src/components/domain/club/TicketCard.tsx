// src/components/domain/club/TicketCard.tsx
"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TicketDTO } from "@/services/clubs.service";

/** Public props for TicketCard (exported for clarity/use in other files) */
export type TicketCardProps = {
  ticket: TicketDTO;
  bannerUrl?: string | null;                // optional image (we pass null for event tickets)
  qtyInCart?: number;                       // how many of this ticket user has in cart
  itemId?: string;                          // cart line item id for update/remove
  onAdd: () => void;                        // add a single unit (we clamp inside)
  onChangeQty: (itemId: string, nextQty: number) => void; // set new quantity for existing item

  /** NEW — compact layout & description clamp toggle */
  compact?: boolean;                        // render in compact mode (smaller paddings/typography)
  showDescription?: boolean;                // whether to show (clamped) description snippet
  isFree?: boolean;                         // whether this is a free ticket (for yellow highlighting)
};

/** Defensive pickers — no hardcoding to a single field name. */
function getTitle(t: any): string {
  return t?.name ?? t?.title ?? "Ticket";
}
function getDescription(t: any): string {
  return t?.description ?? t?.details ?? t?.about ?? "";
}
function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function isNum(v: any): boolean {
  return typeof v === "number" && Number.isFinite(v);
}
function getPrice(t: any): { price: number | null; compareAt: number | null; currency: string } {
  const currency: string = t?.currency ?? "COP";
  const price = toNum(t?.salePrice) ?? toNum(t?.price) ?? toNum(t?.currentPrice) ?? null;
  const compareAt =
    toNum(t?.originalPrice) ??
    toNum(t?.basePrice) ??
    (price != null && toNum(t?.listPrice) && toNum(t?.listPrice)! > price ? toNum(t?.listPrice) : null) ??
    null;
  return { price, compareAt, currency };
}
function getAvailable(t: any): number | null {
  if (isNum(t?.available)) return Number(t.available);
  if (isNum(t?.remaining)) return Number(t.remaining);
  if (isNum(t?.availableQty)) return Number(t.availableQty);
  if (isNum(t?.availableQuantity)) return Number(t.availableQuantity);
  if (isNum(t?.quantity)) return Number(t.quantity);
  return null;
}
function getMaxPerUser(t: any): number | null {
  if (isNum(t?.maxPerUser)) return Number(t.maxPerUser);
  if (isNum(t?.max)) return Number(t.max);
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

/** Render a short inline "Incluye: 2× Gin Tonic, 1× Picada" if the ticket bundles items. */
function extractIncludes(t: any): string[] {
  const raw = t?.includedItems ?? t?.includes ?? t?.menuItems ?? [];
  if (!Array.isArray(raw)) return [];
  const parts: string[] = [];
  for (const it of raw) {
    const name = it?.name ?? it?.title ?? it?.itemName;
    const q = toNum(it?.qty) ?? toNum(it?.quantity) ?? 1;
    if (!name) continue;
    parts.push(`${q ?? 1}× ${String(name)}`);
  }
  return parts;
}

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
  const includes = extractIncludes(ticket);
  const { price, compareAt, currency } = getPrice(ticket);
  const available = getAvailable(ticket);
  const maxPerUser = getMaxPerUser(ticket);
  const soldOut = available !== null && available <= 0;

  // Clamp the target quantity considering availability and per-user max
  const maxAllowed = useMemo(() => {
    const fromAvail = available == null ? Infinity : Math.max(0, available);
    const fromMax = maxPerUser == null ? Infinity : Math.max(0, maxPerUser);
    return Math.min(fromAvail, fromMax);
  }, [available, maxPerUser]);

  const [expanded, setExpanded] = useState(false);
  // Heuristic: if description looks long, we enable the chevron
  const isLongDesc = useMemo(() => (desc?.length ?? 0) > 110, [desc]);

  const canInc = qtyInCart < maxAllowed;
  const canDec = qtyInCart > 0;

  return (
    <div
      className={[
        "rounded-xl border",
        isFree ? "border-yellow-400/50 bg-yellow-500/10" : "border-white/10 bg-white/5",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      {/* Top row: (optional) small image + title */}
      <div className="flex gap-3">
        {bannerUrl ? (
          <div className="relative h-12 w-12 overflow-hidden rounded-md ring-1 ring-white/10 shrink-0">
            <img src={bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className={compact ? "text-[15px] font-semibold text-white" : "text-base font-semibold text-white"}>
            {title}
          </div>
          {/* Price row */}
          <div className="mt-1 flex items-baseline gap-2">
            {compareAt != null && price != null && compareAt > price ? (
              <span className="text-white/40 line-through text-sm">{fmtMoney(compareAt, currency)}</span>
            ) : null}
            <span className={compact ? "text-white text-[15px] font-bold" : "text-white text-lg font-bold"}>
              {fmtMoney(price, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Description (2-line clamp with chevron to expand) with animation */}
      {showDescription && desc && (
        <div className="mt-2">
          <AnimatePresence initial={false}>
            {expanded ? (
              <motion.p
                key="expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ 
                  duration: 0.2, 
                  ease: [0.16, 1, 0.3, 1],
                  height: { duration: 0.25 }
                }}
                className="text-white/80 text-sm leading-5 overflow-hidden"
              >
                {desc}
              </motion.p>
            ) : (
              <motion.p
                key="collapsed"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "2.5rem" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ 
                  duration: 0.2, 
                  ease: [0.16, 1, 0.3, 1],
                  height: { duration: 0.25 }
                }}
                className="text-white/80 text-sm leading-5 overflow-hidden"
              >
                {desc}
              </motion.p>
            )}
          </AnimatePresence>
          {isLongDesc && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white/90"
              aria-expanded={expanded}
            >
              <span>{expanded ? "Ver menos" : "Ver más"}</span>
              <svg
                className={[
                  "h-3 w-3 transition-transform",
                  expanded ? "rotate-180" : "",
                ].join(" ")}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10 12.5l-5-5h10l-5 5z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Includes inline list */}
      {includes.length > 0 && (
        <div className="mt-2 text-xs text-white/70">
          <span className="text-white/80">Incluye: </span>
          <span className="inline">
            {includes.join(", ")}
          </span>
        </div>
      )}

      {/* Meta line: availability + max */}
      <div className="mt-2 text-xs text-white/60">
        {available != null && <span className="mr-3">Disponible: <span className="text-white/80">{available}</span></span>}
        {maxPerUser != null && <span>Máx: <span className="text-white/80">{maxPerUser}</span></span>}
      </div>

      {/* CTA / Stepper */}
      <div className="mt-3">
        {qtyInCart > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => itemId && onChangeQty(itemId, Math.max(0, qtyInCart - 1))}
              disabled={!canDec}
              className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <div className="min-w-[2rem] text-center text-white font-semibold">{qtyInCart}</div>
            <button
              type="button"
              onClick={() => itemId && onChangeQty(itemId, Math.min(qtyInCart + 1, Number.isFinite(maxAllowed) ? maxAllowed : qtyInCart + 1))}
              disabled={!canInc}
              className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
              aria-label="Aumentar cantidad"
            >
              +
            </button>

            <div className="ml-auto text-xs text-white/60">
              {Number.isFinite(maxAllowed) ? `Límite: ${maxAllowed}` : ""}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            disabled={soldOut}
            className={[
              "w-full rounded-full py-2 font-semibold",
              soldOut
                ? "bg-white/10 text-white/60 cursor-not-allowed"
                // old brighter green as requested
                : "bg-green-600 hover:bg-green-500 text-white",
            ].join(" ")}
          >
            {soldOut ? "Agotado" : "Agregar al carrito"}
          </button>
        )}
      </div>
    </div>
  );
}
