// nightlife-frontend/src/components/domain/club/TicketsGrid.tsx
"use client";

/* eslint-disable no-console */

import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  addTicketToCart,
  getMenuCartSummary,
  getTicketCartSummary,
  updateTicketQty,
  removeTicketItem,
  clearMenuCart,
} from "@/services/cart.service";
import type { ClubDTO, EventDTO, TicketDTO } from "@/services/clubs.service";
import type { AvailableTicketsResponse } from "@/services/tickets.service";
import TicketCard from "./TicketCard";

/** Merge a lightweight “ordering” list with a richer source by id.
 *  The rich copy wins so relations (includedMenuItems) survive.
 */
function mergeById(ordering: TicketDTO[] | undefined, enriched: TicketDTO[]): TicketDTO[] {
  if (!ordering || ordering.length === 0) return enriched;
  const map = new Map(enriched.map((t) => [t.id, t]));
  return ordering.map((o) => (map.has(o.id) ? { ...o, ...map.get(o.id)! } : o));
}



type CartSummary = {
  items: Array<{ id: string; ticketId: string; quantity: number }>;
};

export default function TicketsGrid({
  club,
  selectedDate,
  events,
  tickets,   // expected rich list (may or may not include includedMenuItems)
  available, // lightweight ordering
}: {
  club: ClubDTO;
  selectedDate: string | null;
  events?: EventDTO[];
  tickets: TicketDTO[];
  available?: Pick<
    AvailableTicketsResponse,
    "dateHasEvent" | "event" | "eventTickets" | "generalTickets" | "freeTickets"
  >;
}) {
  // ── carts
  const [ticketCart, setTicketCart] = useState<CartSummary | null>(null);
  const [menuCart, setMenuCart] = useState<{ items: any[] } | null>(null);

  // Modal state
  const [showConfirmClearMenu, setShowConfirmClearMenu] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<TicketDTO | null>(null);

  async function refreshCarts() {
    const [t, m] = await Promise.all([getTicketCartSummary(), getMenuCartSummary()]);
    setTicketCart(t as any);
    setMenuCart(m as any);
  }
  useEffect(() => {
    refreshCarts().catch(() => {});
  }, []);

  const qtyByTicketId = useMemo(() => {
    const map = new Map<string, { qty: number; itemId: string }>();
    for (const it of ticketCart?.items ?? []) {
      map.set(it.ticketId, { qty: it.quantity, itemId: it.id });
    }
    return map;
  }, [ticketCart]);

  // Build enriched lists (these should carry includedMenuItems if `tickets` does)
  const ticketsGeneral = useMemo(() => tickets.filter((t) => (t as any).category === "general"), [tickets]);
  const ticketsFree = useMemo(() => tickets.filter((t) => (t as any).category === "free"), [tickets]);

  // Merge server ordering (light) with enriched copies
  const effGeneralTickets = useMemo(
    () => mergeById(available?.generalTickets, ticketsGeneral),
    [available?.generalTickets, ticketsGeneral]
  );
  const effFreeTickets = useMemo(
    () => mergeById(available?.freeTickets, ticketsFree),
    [available?.freeTickets, ticketsFree]
  );



  // ── UI guard
  if (!selectedDate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Selecciona una fecha para ver las reservas disponibles.
      </div>
    );
  }

  // ── handlers
  async function handleAdd(t: TicketDTO) {
    if (!selectedDate) return;

    // Do not mix carts
    if (menuCart && (menuCart.items?.length ?? 0) > 0) {
      setPendingTicket(t);
      setShowConfirmClearMenu(true);
      return;
    }

    await addTicketToCart({
      ticketId: t.id,
      date: selectedDate,
      quantity: 1,
    });
    await refreshCarts();
  }

  async function handleChangeQty(itemId: string, nextQty: number) {
    if (nextQty <= 0) {
      await removeTicketItem(itemId);
    } else {
      await updateTicketQty({ id: itemId, quantity: nextQty });
    }
    await refreshCarts();
  }

  async function confirmClearMenuAndAdd() {
    if (!pendingTicket || !selectedDate) return;

    try {
      await clearMenuCart();
      await addTicketToCart({
        ticketId: pendingTicket.id,
        date: selectedDate,
        quantity: 1,
      });
    } finally {
      setPendingTicket(null);
      setShowConfirmClearMenu(false);
      await refreshCarts();
    }
  }

  const hasAnyGeneral = (effGeneralTickets ?? []).length > 0;
  const hasAnyFree = (effFreeTickets ?? []).length > 0;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold mb-3">Reservas disponibles</h3>

      {/* GENERAL tickets */}
      {hasAnyGeneral && (
        <div className="mb-6">
          <h4 className="text-white/80 text-sm mb-2">Covers</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {effGeneralTickets.map((t) => {
              const inCart = qtyByTicketId.get(t.id);
              return (
                <TicketCard
                  key={t.id}
                  ticket={t} // merged -> should include includedMenuItems if source had them
                  bannerUrl={null}
                  qtyInCart={inCart?.qty ?? 0}
                  itemId={inCart?.itemId ?? ""}
                  onAdd={() => handleAdd(t)}
                  onChangeQty={handleChangeQty}
                  compact
                  showDescription
                />
              );
            })}
          </div>
        </div>
      )}

      {/* FREE tickets */}
      {hasAnyFree && (
        <div>
          <h4 className="text-white/80 text-sm mb-2">Promos gratis</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {effFreeTickets.map((t) => {
              const inCart = qtyByTicketId.get(t.id);
              return (
                <TicketCard
                  key={t.id}
                  ticket={t}
                  bannerUrl={null}
                  qtyInCart={inCart?.qty ?? 0}
                  itemId={inCart?.itemId ?? ""}
                  onAdd={() => handleAdd(t)}
                  onChangeQty={handleChangeQty}
                  compact
                  showDescription
                  isFree
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Confirm clearing OTHER cart (menu) */}
      {showConfirmClearMenu && (
        <ConfirmModal
          title="Tienes consumos en el carrito"
          body="Para comprar entradas debes vaciar primero el carrito de consumos. ¿Quieres vaciarlo y continuar?"
          onClose={() => {
            setShowConfirmClearMenu(false);
            setPendingTicket(null);
          }}
          onConfirm={confirmClearMenuAndAdd}
        />
      )}
    </section>
  );
}

export { TicketsGrid };
