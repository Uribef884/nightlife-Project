// src/components/domain/club/TicketsGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  addTicketToCart,
  getMenuCartSummary,
  getTicketCartSummary,
  updateTicketQty,
  removeTicketItem,
  clearMenuCart, // ← used to clear the OTHER cart (menu) when adding tickets
} from "@/services/cart.service";
import type { ClubDTO, EventDTO, TicketDTO } from "@/services/clubs.service";
import type { AvailableTicketsResponse } from "@/services/tickets.service";
import TicketCard from "./TicketCard";

type CartSummary = {
  items: { id: string; ticketId: string; quantity: number }[];
};

export function TicketsGrid({
  club,
  selectedDate,
  events,
  tickets,
  selectedEventTickets,
  available,
}: {
  club: ClubDTO;
  selectedDate: string | null;
  events: EventDTO[];
  tickets: TicketDTO[];
  selectedEventTickets?: TicketDTO[] | undefined;
  available?: Pick<
    AvailableTicketsResponse,
    "dateHasEvent" | "event" | "eventTickets" | "generalTickets" | "freeTickets"
  >;
}) {
  // ── carts
  const [ticketCart, setTicketCart] = useState<CartSummary | null>(null);
  const [menuCart, setMenuCart] = useState<{ items: any[] } | null>(null);

  // Modal state: when user tries to add a ticket while menu cart has items
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

  // ── buckets (server wins; fallback by category)
  const effGeneralTickets =
    available?.generalTickets ?? tickets.filter((t) => (t as any).category === "general");
  const effFreeTickets =
    available?.freeTickets ?? tickets.filter((t) => (t as any).category === "free");

  // ── early UI
  if (!selectedDate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Selecciona una fecha para ver las reservas disponibles.
      </div>
    );
  }

  // ── handlers
  async function handleAdd(ticket: TicketDTO) {
    // If there are MENU items in cart, ask the user before clearing them
    if ((menuCart?.items?.length ?? 0) > 0) {
      setPendingTicket(ticket);
      setShowConfirmClearMenu(true);
      return;
    }
    // Normal add
    await addTicketToCart({
      ticketId: (ticket as any).id,
      quantity: 1,
      date: selectedDate!, // guaranteed here
    });
    await refreshCarts();
  }

  // Called by TicketCard stepper
  async function handleChangeQty(itemId: string, nextQty: number) {
    if (nextQty <= 0) {
      await removeTicketItem(itemId);
    } else {
      await updateTicketQty({ id: itemId, quantity: nextQty });
    }
    await refreshCarts();
  }

  // Confirm modal "Vaciar y continuar"
  async function confirmClearMenuAndAdd() {
    try {
      await clearMenuCart(); // clear OTHER cart (menu)
      if (pendingTicket && selectedDate) {
        await addTicketToCart({
          ticketId: (pendingTicket as any).id,
          quantity: 1,
          date: selectedDate,
        });
      }
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

      {!hasAnyGeneral && !hasAnyFree ? (
        <div className="text-white/60">No hay reservas disponibles para esta fecha.</div>
      ) : (
        <div className="space-y-6">
          {hasAnyGeneral && (
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                {effGeneralTickets.map((t) => {
                  const inCart = qtyByTicketId.get((t as any).id);
                  return (
                    <TicketCard
                      key={(t as any).id}
                      ticket={t}
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

          {/* Gratis */}
          {hasAnyFree && (
            <div>
              <div className="text-white/80 font-semibold mb-2">Gratis</div>
              <div className="grid gap-4 sm:grid-cols-2">
                                 {effFreeTickets.map((t) => {
                   const inCart = qtyByTicketId.get((t as any).id);
                   return (
                     <TicketCard
                       key={(t as any).id}
                       ticket={t}
                       bannerUrl={null}
                       qtyInCart={inCart?.qty ?? 0}
                       itemId={inCart?.itemId ?? ""}
                       onAdd={() => handleAdd(t)}
                       onChangeQty={handleChangeQty}
                       compact
                       showDescription
                       isFree={true}
                     />
                   );
                 })}
              </div>
            </div>
          )}
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
