// src/components/domain/club/TicketCard.tsx
"use client";

import type { TicketDTO } from "@/services/clubs.service";
import { formatCOP } from "@/lib/formatters";

export type TicketCardProps = {
  ticket: TicketDTO;
  bannerUrl: string | null;      // optional banner shown for event tickets
  qtyInCart: number;             // current quantity of this ticket in cart
  itemId: string;                // cart item id ("" if not in cart yet)
  onAdd: () => void;             // add first unit
  onChangeQty: (itemId: string, nextQty: number) => void; // +/- controls
};

/**
 * Shared ticket card used in both TicketsGrid and ClubEvents (expanded view).
 * No hardcoded limits: reads all constraints from the Ticket DTO.
 */
export default function TicketCard({
  ticket,
  bannerUrl,
  qtyInCart,
  itemId,
  onAdd,
  onChangeQty,
}: TicketCardProps) {
  const base = Number(ticket.price);
  const dyn = Number(ticket.dynamicPrice ?? ticket.price);
  const showSlash = Boolean(ticket.dynamicPricingEnabled) && dyn !== base;

  // "Sold out" only applies to categories that use quantity (events/free), not "general"
  const soldOut = (ticket.quantity ?? 1) <= 0 && ticket.category !== "general";

  // Respect server-sent per-person cap if present
  const maxPerPerson = Number.isFinite(Number(ticket.maxPerPerson))
    ? Number(ticket.maxPerPerson)
    : 99;

  const atMax = qtyInCart >= maxPerPerson;
  const canAdjust = Boolean(itemId);

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${
        soldOut ? "opacity-60" : ""
      }`}
    >
      {bannerUrl && (
        <div className="relative h-28 w-full">
          {/* no alt text duplication — name shows below */}
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="p-3">
        <div className="text-white font-semibold">{ticket.name}</div>
        {ticket.description && (
          <div className="text-white/70 text-sm mb-2">{ticket.description}</div>
        )}

        {/* Price row with dynamic badge */}
        <div className="flex items-baseline gap-2">
          {showSlash && (
            <span className="text-white/40 line-through text-sm">
              {formatCOP(base)}
            </span>
          )}
          <span className="text-white text-lg font-bold">{formatCOP(dyn)}</span>
        </div>

        {/* Meta line: category, max per person, remaining (for non-general) */}
        <div className="text-white/60 text-xs mt-1">
          {capitalize(ticket.category)}
          {" • Máx: "}
          {maxPerPerson}
          {ticket.category !== "general" && ticket.quantity != null && (
            <> • Disponible: {ticket.quantity}</>
          )}
          {atMax && (
            <span className="ml-1 text-amber-300/80">(límite por persona)</span>
          )}
        </div>

        {/* CTA / Stepper */}
        {soldOut ? (
          <div className="mt-3 rounded-full bg-red-500/20 text-red-200 text-center py-2 font-semibold">
            Agotado
          </div>
        ) : qtyInCart > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => canAdjust && onChangeQty(itemId, qtyInCart - 1)}
              disabled={!canAdjust}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/15 text-white disabled:opacity-40"
              aria-label="Quitar uno"
            >
              −
            </button>
            <div className="min-w-8 text-center text-white font-semibold">
              {qtyInCart}
            </div>
            <button
              onClick={() => canAdjust && !atMax && onChangeQty(itemId, qtyInCart + 1)}
              disabled={!canAdjust || atMax}
              className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/15 text-white disabled:opacity-40"
              aria-label="Agregar uno"
            >
              +
            </button>
          </div>
        ) : (
          <button
            onClick={onAdd}
            className="mt-3 w-full rounded-full bg-green-600 hover:bg-green-500 text-white py-2 font-semibold disabled:opacity-50"
          >
            Agregar al carrito
          </button>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string | null | undefined) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
