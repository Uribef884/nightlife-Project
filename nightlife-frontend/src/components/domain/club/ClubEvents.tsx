// nightlife-frontend/src/components/domain/club/ClubEvents.tsx
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
  clearMenuCart,
} from "@/services/cart.service";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/* ---------------- small helpers ---------------- */
type AvailableForDay = {
  dateHasEvent: boolean;
  event: { id: string; name: string; bannerUrl: string | null; availableDate: string } | null;
  eventTickets: TicketDTO[];
};
const isCombo = (t: TicketDTO) => {
  const anyT = t as any;
  return anyT?.includesMenuItem === true || (Array.isArray(anyT?.includedMenuItems) && anyT.includedMenuItems.length > 0);
};
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
function smoothScrollTo(el: HTMLElement, offset = 80) {
  try {
    const rect = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: "smooth" });
  } catch {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ---- Child component that renders chips + grouped tickets for ONE event ---- */
function ExpandedEventTickets({
  evKey,
  tickets,
  qtyByTicketId,
  onAdd,
  onChangeQty,
}: {
  evKey: string;
  tickets: TicketDTO[];
  qtyByTicketId: Map<string, { qty: number; itemId: string }>;
  onAdd: (t: TicketDTO) => void;
  onChangeQty: (itemId: string, nextQty: number) => void;
}) {
  // Use the same categorization logic as TicketsGrid
  const combos = useMemo(() => tickets.filter(isCombo), [tickets]);
  const general = useMemo(() => tickets.filter((t) => {
    if (isCombo(t)) return false;
    // Use the same price logic as getPrice function
    const dynamic = Number(t.dynamicPrice);
    const base = Number(t.price);
    const price = (t.dynamicPricingEnabled && !isNaN(dynamic) ? dynamic : base);
    return price > 0;
  }), [tickets]);
  const gratis = useMemo(() => tickets.filter((t) => {
    if (isCombo(t)) return false;
    // Use the same price logic as getPrice function
    const dynamic = Number(t.dynamicPrice);
    const base = Number(t.price);
    const price = (t.dynamicPricingEnabled && !isNaN(dynamic) ? dynamic : base);
    return price === 0;
  }), [tickets]);

  const secRefs = {
    combos: useRef<HTMLDivElement | null>(null),
    general: useRef<HTMLDivElement | null>(null),
    gratis: useRef<HTMLDivElement | null>(null),
  };
  const chips = useMemo(
    () =>
      [
        { key: "combos" as const, label: "Combos", ref: secRefs.combos, count: combos.length, id: `event-sec-combos-${evKey}` },
        { key: "general" as const, label: "General", ref: secRefs.general, count: general.length, id: `event-sec-general-${evKey}` },
        { key: "gratis" as const, label: "Gratis", ref: secRefs.gratis, count: gratis.length, id: `event-sec-gratis-${evKey}` },
      ].filter((c) => c.count > 0),
    [combos.length, general.length, gratis.length, evKey]
  );

  const [activeChip, setActiveChip] = useState<"combos" | "general" | "gratis" | null>(chips[0]?.key ?? null);

  useEffect(() => {
    setActiveChip(chips[0]?.key ?? null);
  }, [chips]);

  // Observe to auto-highlight
  useEffect(() => {
    if (chips.length === 0) return;
    const entriesMap = new Map<Element, { key: "combos" | "general" | "gratis"; ratio: number }>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const info = entriesMap.get(e.target);
          if (info) info.ratio = e.intersectionRatio;
        }
        let best: { key: "combos" | "general" | "gratis"; ratio: number } | null = null;
        for (const v of entriesMap.values()) {
          if (!best || v.ratio > best.ratio) best = v;
        }
        if (best && best.ratio > 0) setActiveChip(best.key);
      },
      { root: null, threshold: [0.15, 0.35, 0.55, 0.75], rootMargin: "-40px 0px -40% 0px" }
    );

    chips.forEach((c) => {
      const el = c.ref.current;
      if (el) {
        entriesMap.set(el, { key: c.key, ratio: 0 });
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [chips]);

  /* segmented control look (same as grid) */
  const chipBase =
    "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors";
  const chipActive =
    "bg-[#7A48D3] text-white";
  const chipInactive = "bg-white/5 text-white/70 hover:text-white hover:bg-white/10";
  const chipBadge =
    "ml-1 inline-flex min-w-[18px] h-[18px] px-1.5 rounded-full justify-center items-center text-[10px] font-bold";

  // Section shell (ref type = React.Ref<HTMLDivElement>)
  function Section({
    id,
    title,
    count,
    innerRef,
    children,
  }: {
    id: string;
    title: string;
    count: number;
    innerRef: React.Ref<HTMLDivElement>;
    children: React.ReactNode;
  }) {
    if (count === 0) return null;
    return (
      <div ref={innerRef} id={id} className="mb-4 scroll-mt-24">
        <div className="mb-2">
          <h5 className="text-white/90 text-sm font-semibold">{title}</h5>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      </div>
    );
  }

  return (
    <div className="mt-1">
      {/* Chip nav for event tickets */}
      {chips.length > 0 && (
        <div className="mb-3 flex items-center gap-2 overflow-x-auto">
          {chips.map((c) => {
            const active = activeChip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                className={[chipBase, active ? chipActive : chipInactive].join(" ")}
                onClick={() => {
                  setActiveChip(c.key);
                  const el = c.ref.current;
                  if (el) smoothScrollTo(el, 80);
                }}
                aria-pressed={active}
              >
                {c.label}
                <span
                  className={[
                    chipBadge,
                    active ? "bg-white text-[#7A48D3]" : "bg-white/10 text-white/70",
                  ].join(" ")}
                >
                  {c.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sections */}
      <Section id={`event-sec-combos-${evKey}`} title="Combos:" count={combos.length} innerRef={secRefs.combos}>
        {combos.map((t) => {
          const inCart = qtyByTicketId.get((t as any).id);
          return (
            <TicketCard
              key={(t as any).id}
              ticket={t}
              bannerUrl={null}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => onAdd(t)}
              onChangeQty={onChangeQty}
              compact
              showDescription
            />
          );
        })}
      </Section>

      <Section id={`event-sec-general-${evKey}`} title="General:" count={general.length} innerRef={secRefs.general}>
        {general.map((t) => {
          const inCart = qtyByTicketId.get((t as any).id);
          return (
            <TicketCard
              key={(t as any).id}
              ticket={t}
              bannerUrl={null}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => onAdd(t)}
              onChangeQty={onChangeQty}
              compact
              showDescription
            />
          );
        })}
      </Section>

      <Section id={`event-sec-gratis-${evKey}`} title="Gratis:" count={gratis.length} innerRef={secRefs.gratis}>
        {gratis.map((t) => {
          const inCart = qtyByTicketId.get((t as any).id);
          return (
            <TicketCard
              key={(t as any).id}
              ticket={t}
              bannerUrl={null}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => onAdd(t)}
              onChangeQty={onChangeQty}
              compact
              showDescription
              isFree
            />
          );
        })}
      </Section>
    </div>
  );
}

/* ----------------------------- Parent component ----------------------------- */
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
  const [lightbox, setLightbox] = useState<{ open: boolean; url: string | null }>({ open: false, url: null });

  // Smooth scroll to the expanded tickets of the selected event
  const ticketsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingScrollToId, setPendingScrollToId] = useState<string | null>(null);

  // Per-event "show full description" state
  const [descExpanded, setDescExpanded] = useState<Record<string, boolean>>({});

  // Cart state
  const [ticketCart, setTicketCart] = useState<{ items: { id: string; ticketId: string; quantity: number }[] } | null>(null);
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
    for (const it of ticketCart?.items ?? []) map.set(it.ticketId, { qty: it.quantity, itemId: it.id });
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
    }, 280);
    return () => window.clearTimeout(timer);
  }, [pendingScrollToId, selectedDate]);

  // Add / change qty
  async function handleAdd(ticket: TicketDTO) {
    if ((menuCart?.items?.length ?? 0) > 0) {
      setPendingTicket(ticket);
      setShowConfirmClearMenu(true);
      return;
    }
    await addTicketToCart({ ticketId: (ticket as any).id, quantity: 1, date: selectedDate! });
    await refreshCarts();
  }
  async function handleChangeQty(itemId: string, nextQty: number) {
    if (nextQty <= 0) await removeTicketItem(itemId);
    else await updateTicketQty({ id: itemId, quantity: nextQty });
    await refreshCarts();
  }
  async function confirmClearMenuAndAdd() {
    try {
      await clearMenuCart();
      if (pendingTicket && selectedDate) {
        await addTicketToCart({ ticketId: (pendingTicket as any).id, quantity: 1, date: selectedDate });
      }
    } finally {
      setPendingTicket(null);
      setShowConfirmClearMenu(false);
      await refreshCarts();
    }
  }

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
          const isSelected = !!selectedEvent && evDate && getEventDate(selectedEvent as any) === evDate;
          const desc = getEventDesc(ev);
          const looksLong = (desc?.length ?? 0) > 180;
          const expanded = !!descExpanded[evId];

          return (
            <div key={evId} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
              {/* Header row with image + content */}
              <div className="p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => (ev as any).bannerUrl && setLightbox({ open: true, url: (ev as any).bannerUrl })}
                    className="relative h-24 w-24 overflow-hidden rounded-lg shrink-0 ring-1 ring-white/10"
                    aria-label={`Ver imagen del evento ${(ev as any).name ?? ""}`}
                  >
                    <img src={(ev as any).bannerUrl ?? ""} alt={(ev as any).name ?? ""} className="absolute inset-0 h-full w-full object-cover" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold">{(ev as any).name}</div>
                    {evDate && <div className="text-white/60 text-sm">{formatDateLabel(evDate)}</div>}

                    {/* Description (animated clamp) */}
                    {desc ? (
                      <div className="mt-2">
                        <AnimatePresence initial={false}>
                          {expanded ? (
                            <motion.p
                              key="expanded"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1], height: { duration: 0.25 } }}
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
                              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1], height: { duration: 0.25 } }}
                              className="text-white/75 text-sm leading-5 overflow-hidden"
                            >
                              {desc}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        {looksLong && (
                          <button
                            type="button"
                            onClick={() => setDescExpanded((m) => ({ ...m, [evId]: !m[evId] }))}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white/90"
                            aria-expanded={expanded}
                          >
                            <span>{expanded ? "Ver menos" : "Ver más"}</span>
                            <svg className={["h-3 w-3 transition-transform", expanded ? "rotate-180" : ""].join(" ")} viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 12.5l-5-5h10l-5 5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ) : null}

                    {!isSelected && (
                      <button
                        className="mt-3 w-full rounded-full bg-violet-600 hover:bg-violet-500 text-white py-2 text-sm font-semibold"
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

              {/* Expanded tickets with chip nav + sections */}
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
                    <div className="mt-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-white/90 font-semibold">Reservas del evento</span>
                        <div className="h-px bg-white/10 flex-1" />
                      </div>

                      {(() => {
                        const combos = eventTickets.filter(isCombo);
                        const hasAny = eventTickets.length > 0;
                        return hasAny ? (
                          <ExpandedEventTickets
                            evKey={evId}
                            tickets={eventTickets}
                            qtyByTicketId={qtyByTicketId}
                            onAdd={handleAdd}
                            onChangeQty={handleChangeQty}
                          />
                        ) : (
                          <div className="text-white/60">No hay reservas disponibles para esta fecha.</div>
                        );
                      })()}
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
          onConfirm={async () => {
            await clearMenuCart();
            if (pendingTicket && selectedDate) {
              await addTicketToCart({ ticketId: (pendingTicket as any).id, quantity: 1, date: selectedDate });
            }
            setPendingTicket(null);
            setShowConfirmClearMenu(false);
            await refreshCarts();
          }}
        />
      )}
    </section>
  );
}
