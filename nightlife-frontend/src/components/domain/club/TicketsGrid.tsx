// src/components/domain/club/TicketsGrid.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCOP } from "@/lib/formatters";
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

/** ────────────────────────────────────────────────────────────────────────────
 * Local types + guards (keeps UI stable even if backend shape varies)
 * ──────────────────────────────────────────────────────────────────────────── */
type CartItemLite = { id: string; ticketId: string; quantity: number };
type LocalCart = { items: CartItemLite[] };

/** Always return a safe LocalCart shape */
function normalizeCartSummary(s: any): LocalCart {
  const items = Array.isArray(s?.items)
    ? s.items
        .filter((i: any) => i && i.id && i.ticketId)
        .map((i: any) => ({
          id: String(i.id),
          ticketId: String(i.ticketId),
          quantity: Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 0,
        }))
    : [];
  return { items };
}

/** ────────────────────────────────────────────────────────────────────────────
 * Date utilities (stable UTC to avoid timezone shifts)
 * ──────────────────────────────────────────────────────────────────────────── */
function weekdayIndexFromISO_UTC(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  // Force UTC noon to avoid DST/offset shifts
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  return dt.getUTCDay(); // 0..6 (Sun..Sat)
}

/** Free = explicit free category OR non-event with computed price === 0 */
function isFreeGeneralTicket(t: TicketDTO): boolean {
  const effective = Number(t.dynamicPrice ?? t.price);
  return t.category === "free" || (t.category !== "event" && Number.isFinite(effective) && effective === 0);
}

/** ────────────────────────────────────────────────────────────────────────────
 * OPTION A: Robust day normalization + open-day detection
 * Supports English/Spanish, full names and 3-letter abbreviations.
 * Works with club.openDays: string[] and/or club.openHours: { day: string }[]
 * ──────────────────────────────────────────────────────────────────────────── */

function stripDiacriticsLower(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // remove accents
}

/** Map many spellings to weekday indices 0..6 (Sun..Sat) */
function normalizeDayToIndex(day: string): number | null {
  const d = stripDiacriticsLower(day.trim());

  // English full + short
  const map: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3, weds: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,

    // Spanish full + short (diacritics already stripped)
    domingo: 0, dom: 0,
    lunes: 1, lun: 1,
    martes: 2, mar: 2,
    miercoles: 3, mie: 3,
    jueves: 4, jue: 4,
    viernes: 5, vie: 5,
    sabado: 6, sab: 6,
  };

  return (d in map) ? map[d] : null;
}

/** Read open days from either openDays or openHours */
function extractOpenDayIndices(club: Partial<ClubDTO>): Set<number> {
  const set = new Set<number>();

  // openDays: string[]
  const openDays: unknown = (club as any)?.openDays;
  if (Array.isArray(openDays)) {
    for (const v of openDays) {
      if (typeof v === "string") {
        const idx = normalizeDayToIndex(v);
        if (idx != null) set.add(idx);
      }
    }
  }

  // openHours: { day: string }[]
  const openHours: unknown = (club as any)?.openHours;
  if (Array.isArray(openHours)) {
    for (const oh of openHours) {
      const day = (oh && typeof oh.day === "string") ? oh.day : null;
      if (day) {
        const idx = normalizeDayToIndex(day);
        if (idx != null) set.add(idx);
      }
    }
  }

  return set;
}

let __warnedMissingOpenDays = false;

/** True if club is open on selected date (using indices). */
function isClubOpenOnDate(club: ClubDTO, selectedDate: string): boolean {
  const indices = extractOpenDayIndices(club);
  if (indices.size === 0) {
    // Dev hint: if nobody configured open days/hours,
    // general tickets will never show on non-event days.
    if (process.env.NODE_ENV !== "production" && !__warnedMissingOpenDays) {
      // eslint-disable-next-line no-console
      console.warn(
        "[TicketsGrid] Club has no openDays/openHours configured. Non-event 'general' tickets will be hidden."
      );
      __warnedMissingOpenDays = true;
    }
    return false;
  }
  const idx = weekdayIndexFromISO_UTC(selectedDate);
  return indices.has(idx);
}

export function TicketsGrid({
  club,
  selectedDate,
  events,
  tickets,
  selectedEventTickets, // optional prefiltered event tickets (SSR/parent-provided)
}: {
  club: ClubDTO;
  selectedDate: string | null;
  events: EventDTO[];
  tickets: TicketDTO[];
  selectedEventTickets?: TicketDTO[] | undefined;
}) {
  const [confirm, setConfirm] = useState<{ title: string; body: string; onConfirm: () => void } | null>(null);
  const [cart, setCart] = useState<LocalCart>({ items: [] });
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // Initial cart load (defensive: always normalize; on error use empty cart)
  useEffect(() => {
    getTicketCartSummary()
      .then((s) => setCart(normalizeCartSummary(s)))
      .catch(() => setCart({ items: [] }));
  }, []);

  // Map events by date for quick lookup
  const eventByDate = useMemo(() => {
    const map = new Map<string, EventDTO>();
    for (const e of events) map.set(e.availableDate, e);
    return map;
  }, [events]);

  const dateHasEvent = selectedDate ? eventByDate.has(selectedDate) : false;

  // Prefer tickets provided for the specific event (from parent), otherwise filter here
  const ticketsForSelectedEvent = useMemo<TicketDTO[]>(() => {
    if (!selectedDate) return [];
    if (selectedEventTickets && selectedEventTickets.length > 0) return selectedEventTickets;
    // Fallback: filter club tickets by event category + matching date
    return tickets.filter((t) => t.category === "event" && t.availableDate === selectedDate);
  }, [selectedDate, selectedEventTickets, tickets]);

  // Partition tickets for the selected date
  const { eventTickets, generalTickets, freeTickets } = useMemo(() => {
    const eventTickets: TicketDTO[] = [];
    const generalTickets: TicketDTO[] = [];
    const freeTickets: TicketDTO[] = [];

    if (!selectedDate) return { eventTickets, generalTickets, freeTickets };

    // If there is an event for the date, only show event tickets (events override free/general)
    if (dateHasEvent) {
      for (const t of ticketsForSelectedEvent) {
        if (t.isActive) eventTickets.push(t);
      }
    }

    // Otherwise, show non-event tickets (general + free)
    if (!dateHasEvent) {
      const openToday = isClubOpenOnDate(club, selectedDate);

      for (const t of tickets) {
        if (!t.isActive) continue;
        if (t.category === "event") continue;

        const matchesExplicitDate = t.availableDate != null && t.availableDate === selectedDate;
        const hasNoDateButOpen = t.availableDate == null && openToday;

        if (isFreeGeneralTicket(t)) {
          // Free general ticket must have explicit date & quantity > 0
          if (t.availableDate === selectedDate && (t.quantity ?? 0) > 0) {
            freeTickets.push(t);
          }
        } else {
          if (matchesExplicitDate || hasNoDateButOpen) generalTickets.push(t);
        }
      }
    }

    // Priority: ascending (1 is highest priority)
    eventTickets.sort((a, b) => a.priority - b.priority);
    generalTickets.sort((a, b) => a.priority - b.priority);
    freeTickets.sort((a, b) => a.priority - b.priority);

    return { eventTickets, generalTickets, freeTickets };
  }, [tickets, selectedDate, club, dateHasEvent, ticketsForSelectedEvent]);

  /** Safe lookup against possibly-empty cart */
  const findCartItem = (ticketId: string) => (cart.items ?? []).find((i) => i.ticketId === ticketId);
  const qtyInCart = (ticketId: string) => findCartItem(ticketId)?.quantity ?? 0;
  const itemIdFor = (ticketId: string) => findCartItem(ticketId)?.id ?? "";

  /** Add with guard: clear menu cart if needed */
  async function guardAndAdd(ticket: TicketDTO) {
    const menuSummary = await getMenuCartSummary().catch(() => null);

    // If there are items in the menu cart, ask to clear them first
    if (menuSummary && Array.isArray(menuSummary.items) && menuSummary.items.length > 0) {
      setConfirm({
        title: "Limpiar carrito de carta",
        body: "Tu carrito tiene productos de la carta. ¿Limpiar para continuar con boletas?",
        onConfirm: async () => {
          try {
            await clearMenuCart();
            await addTicketToCart({ ticketId: ticket.id, date: selectedDate!, quantity: 1 });
            const summary = await getTicketCartSummary();
            if (summary) setCart(normalizeCartSummary(summary));
          } finally {
            setConfirm(null);
          }
        },
      });
      return;
    }

    // Normal add flow
    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(ticket.id);
      return next;
    });

    try {
      await addTicketToCart({ ticketId: ticket.id, date: selectedDate!, quantity: 1 });
      const summary = await getTicketCartSummary();
      if (summary) setCart(normalizeCartSummary(summary));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
    }
  }

  /** Quantity change or removal */
  async function changeQty(itemId: string, nextQty: number) {
    if (!itemId) return;

    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      if (nextQty <= 0) {
        await removeTicketItem(itemId);
      } else {
        await updateTicketQty({ id: itemId, quantity: nextQty });
      }
      const summary = await getTicketCartSummary();
      if (summary) setCart(normalizeCartSummary(summary));
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────────────────────────
  if (!selectedDate) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Selecciona una fecha para ver las reservas disponibles.
      </div>
    );
  }

  // Event-day: show event tickets only (includes free event tickets)
  if (dateHasEvent) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-white font-semibold mb-3">Boletas del evento</h3>
        {eventTickets.length === 0 ? (
          <div className="text-white/60">No hay boletas disponibles para esta fecha.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {eventTickets.map((t) => (
              <TicketCard
                key={t.id}
                ticket={t}
                bannerUrl={eventByDate.get(selectedDate!)?.bannerUrl ?? null}
                qtyInCart={qtyInCart(t.id)}
                itemId={itemIdFor(t.id)}
                onAdd={() => guardAndAdd(t)}
                onChangeQty={changeQty}
              />
            ))}
          </div>
        )}
        {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
      </div>
    );
  }

  // Non-event day: general + free (general)
  const noNonEventTickets = generalTickets.length === 0 && freeTickets.length === 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold mb-3">Reservas disponibles</h3>

      {noNonEventTickets && <div className="text-white/60">No hay reservas disponibles para esta fecha.</div>}

      {!noNonEventTickets && (
        <div className="grid gap-4">
          {generalTickets.length > 0 && (
            <div>
              <div className="text-white/90 font-semibold mb-2">Generales</div>
              <div className="grid gap-4 sm:grid-cols-2">
                {generalTickets.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    bannerUrl={null}
                    qtyInCart={qtyInCart(t.id)}
                    itemId={itemIdFor(t.id)}
                    onAdd={() => guardAndAdd(t)}
                    onChangeQty={changeQty}
                  />
                ))}
              </div>
            </div>
          )}

          {freeTickets.length > 0 && (
            <div>
              <div className="text-white/90 font-semibold mb-2">Gratis</div>
              <div className="grid gap-4 sm:grid-cols-2">
                {freeTickets.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    bannerUrl={null}
                    qtyInCart={qtyInCart(t.id)}
                    itemId={itemIdFor(t.id)}
                    onAdd={() => guardAndAdd(t)}
                    onChangeQty={changeQty}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function TicketCard({
  ticket,
  bannerUrl,
  qtyInCart,
  itemId,
  onAdd,
  onChangeQty,
}: {
  ticket: TicketDTO;
  bannerUrl: string | null;
  qtyInCart: number;
  itemId: string;
  onAdd: () => void;
  onChangeQty: (itemId: string, nextQty: number) => void;
}) {
  const base = Number(ticket.price);
  const dyn = Number(ticket.dynamicPrice ?? ticket.price);
  const showSlash = !!ticket.dynamicPricingEnabled && dyn !== base;

  // "Sold out" only applies to categories that use quantity (events/free), not "general"
  const soldOut = (ticket.quantity ?? 1) <= 0 && ticket.category !== "general";

  const maxPerPerson = Number.isFinite(Number(ticket.maxPerPerson)) ? Number(ticket.maxPerPerson) : 99;
  const atMax = qtyInCart >= maxPerPerson;
  const canAdjust = Boolean(itemId);

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${soldOut ? "opacity-60" : ""}`}>
      {bannerUrl && (
        <div className="relative h-28 w-full">
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-3">
        <div className="text-white font-semibold">{ticket.name}</div>
        {ticket.description && <div className="text-white/70 text-sm mb-2">{ticket.description}</div>}

        <div className="flex items-baseline gap-2">
          {showSlash && <span className="text-white/40 line-through">{formatCOP(base)}</span>}
          <span className="text-white text-lg font-bold">{formatCOP(dyn)}</span>
        </div>

        <div className="text-white/60 text-xs mt-1">
          {ticket.category === "event" ? "Evento" : ticket.category === "free" ? "Gratis" : "General"}
          {" • Máx: "}{maxPerPerson}
          {ticket.category !== "general" && ticket.quantity != null && <> • Disponible: {ticket.quantity}</>}
          {atMax && <span className="ml-1 text-amber-300/80">(límite por persona)</span>}
        </div>

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
            <div className="min-w-8 text-center text-white font-semibold">{qtyInCart}</div>
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
