// src/components/domain/club/ClubEvents.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { EventDTO, TicketDTO } from "@/services/clubs.service";
import TicketCard from "./TicketCard";
import {
  addTicketToCart,
  getMenuCartSummary,
  getTicketCartSummary,
  updateTicketQty,
  removeTicketItem,
  clearMenuCart, // ← used to clear the OTHER cart (menu) when adding tickets
} from "@/services/cart.service";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

type AvailableForDay = {
  dateHasEvent: boolean;
  event: { id: string; name: string; bannerUrl: string | null; availableDate: string } | null;
  eventTickets: TicketDTO[];
};

// Defensive helpers
function normalizeISO(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
function formatDateLabel(iso: string) {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return dt.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return iso;
  }
}
function getEventDate(e: any): string | null {
  const raw: unknown = e?.availableDate ?? e?.date ?? e?.eventDate ?? null;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
function getEventDesc(e: any): string {
  return e?.description ?? e?.details ?? e?.about ?? e?.summary ?? "";
}

export function ClubEvents({
  events,
  selectedDate,
  available,
  onChooseDate,
}: {
  events: EventDTO[];
  selectedDate?: string | null;
  available?: AvailableForDay;
  onChooseDate: (d: string) => void;
}) {
  // Local lightbox (no redirect)
  const [lightbox, setLightbox] = useState<{ open: boolean; url: string | null }>({
    open: false,
    url: null,
  });

  // Smooth scroll to the expanded tickets of the selected event
  const ticketsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingScrollToId, setPendingScrollToId] = useState<string | null>(null);

  // Per-event "show full description" state
  const [descExpanded, setDescExpanded] = useState<Record<string, boolean>>({});

  // Cart state for steppers inside expanded event panel
  const [ticketCart, setTicketCart] = useState<{ items: { id: string; ticketId: string; quantity: number }[] } | null>(
    null
  );
  const [menuCart, setMenuCart] = useState<{ items: any[] } | null>(null);

  // Modal when user tries to add while menu cart has items
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

  // Index events by date
  const byDate = useMemo(() => {
    const m = new Map<string, EventDTO>();
    for (const e of events ?? []) {
      const d = normalizeISO((e as any).availableDate ?? (e as any).date);
      if (d) m.set(d, e);
    }
    return m;
  }, [events]);

  const dayHasEvent = available?.dateHasEvent ?? (selectedDate ? byDate.has(selectedDate) : false);
  const selectedEvent = useMemo(() => {
    if (!dayHasEvent || !selectedDate) return null;
    return available?.event ?? (byDate.get(selectedDate) as any) ?? null;
  }, [dayHasEvent, selectedDate, available, byDate]);

  const eventTickets: TicketDTO[] = useMemo(() => {
    if (available?.eventTickets?.length) return available.eventTickets;
    if (!selectedDate) return [];
    const ev = byDate.get(selectedDate) as any;
    return Array.isArray(ev?.tickets) ? (ev.tickets as TicketDTO[]) : [];
  }, [available, byDate, selectedDate]);

  // After choosing a date, scroll to that event's expanded tickets.
  useEffect(() => {
    if (!pendingScrollToId) return;
    const el = ticketsRefs.current[pendingScrollToId];
    if (!el) return;
    const timer = window.setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } finally {
        setPendingScrollToId(null);
      }
    }, 280); // ~0.25s + slack
    return () => window.clearTimeout(timer);
  }, [pendingScrollToId, selectedDate]);

  // Add from expanded tickets
  async function handleAdd(ticket: TicketDTO) {
    if ((menuCart?.items?.length ?? 0) > 0) {
      // Other cart (menu) has items → ask first
      setPendingTicket(ticket);
      setShowConfirmClearMenu(true);
      return;
    }
    await addTicketToCart({ ticketId: (ticket as any).id, quantity: 1, date: selectedDate! });
    await refreshCarts();
  }

  // Stepper changes
  async function handleChangeQty(itemId: string, nextQty: number) {
    if (nextQty <= 0) {
      await removeTicketItem(itemId);
    } else {
      await updateTicketQty({ id: itemId, quantity: nextQty });
    }
    await refreshCarts();
  }

  // Confirm "Vaciar y continuar"
  async function confirmClearMenuAndAdd() {
    try {
      await clearMenuCart(); // clear OTHER cart (menu)
      if (pendingTicket && selectedDate) {
        await addTicketToCart({ ticketId: (pendingTicket as any).id, quantity: 1, date: selectedDate });
      }
    } finally {
      setPendingTicket(null);
      setShowConfirmClearMenu(false);
      await refreshCarts();
    }
  }

  /* Hide entire section when there are no events */
  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold mb-3">Próximos eventos</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((ev) => {
          const evId = String((ev as any).id);
          const evDate = getEventDate(ev);
          const isSelected =
            !!selectedEvent && evDate && getEventDate(selectedEvent as any) === evDate;

          const desc = getEventDesc(ev);
          const looksLong = (desc?.length ?? 0) > 180;
          const expanded = !!descExpanded[evId];

          return (
            <div key={evId} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              {/* Header row with small square thumbnail + content */}
              <div className="p-3">
                <div className="flex items-start gap-3">
                  {/* Square thumbnail; opens lightbox (no redirect) */}
                  <button
                    type="button"
                    onClick={() => (ev as any).bannerUrl && setLightbox({ open: true, url: (ev as any).bannerUrl })}
                    className="relative h-24 w-24 overflow-hidden rounded-lg shrink-0 ring-1 ring-white/10"
                    aria-label={`Ver imagen del evento ${(ev as any).name ?? ""}`}
                  >
                    <img
                      src={(ev as any).bannerUrl ?? ""}
                      alt={(ev as any).name ?? ""}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold">{(ev as any).name}</div>
                    {evDate && <div className="text-white/60 text-sm">{formatDateLabel(evDate)}</div>}

                    {/* Description 3-line clamp + chevron with animation */}
                    {desc ? (
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
                              className="text-white/75 text-sm leading-5 overflow-hidden"
                            >
                              {desc}
                            </motion.p>
                          ) : (
                            <motion.p
                              key="collapsed"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "3.75rem" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ 
                                duration: 0.2, 
                                ease: [0.16, 1, 0.3, 1],
                                height: { duration: 0.25 }
                              }}
                              className="text-white/75 text-sm leading-5 overflow-hidden"
                            >
                              {desc}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        {looksLong && (
                          <button
                            type="button"
                            onClick={() =>
                              setDescExpanded((m) => ({ ...m, [evId]: !m[evId] }))
                            }
                            className="mt-1 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white/90"
                            aria-expanded={expanded}
                          >
                            <span>{expanded ? "Ver menos" : "Ver más"}</span>
                            <svg
                              className={["h-3 w-3 transition-transform", expanded ? "rotate-180" : ""].join(" ")}
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M10 12.5l-5-5h10l-5 5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* CTA (hidden when this event's date is selected) */}
                    {!isSelected && (
                      <button
                        className="mt-3 w-full rounded-full bg-violet-600 hover:bg-violet-500 text-white py-2 font-semibold"
                        onClick={() => {
                          if (!evDate) return;
                          setPendingScrollToId(evId);
                          onChooseDate(evDate);
                        }}
                      >
                        Elegir fecha
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded tickets for the selected event */}
              <AnimatePresence initial={false}>
                {isSelected && (
                  <motion.div
                    key="expanded"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "tween", duration: 0.25 }}
                    className="px-3 pb-3"
                    ref={(el: HTMLDivElement | null) => {
                      ticketsRefs.current[evId] = el;
                    }}
                  >
                    {/* Borderless simplified block */}
                    <div className="mt-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-white/90 font-semibold">Reservas del evento</span>
                        <div className="h-px bg-white/10 flex-1" />
                      </div>

                      {eventTickets?.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {eventTickets.map((t) => {
                            const inCart = qtyByTicketId.get((t as any).id);
                            return (
                              <TicketCard
                                key={(t as any).id}
                                ticket={t}
                                bannerUrl={null} // no images in event tickets
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
                      ) : (
                        <div className="text-white/60">No hay reservas disponibles para esta fecha.</div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Local lightbox */}
      {lightbox.open && (
        <button
          aria-label="Cerrar"
          onClick={() => setLightbox({ open: false, url: null })}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
        >
          <img src={lightbox.url ?? ""} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" />
        </button>
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
