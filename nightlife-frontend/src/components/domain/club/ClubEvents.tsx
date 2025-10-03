// nightlife-frontend/src/components/domain/club/ClubEvents.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import type { EventDTO, TicketDTO } from "@/services/clubs.service";
import TicketCard from "./TicketCard";
import { useCartContext } from "@/contexts/CartContext";
import { useClubProtection } from "@/hooks/useClubProtection";
import { CartClubChangeModal } from "@/components/cart";
import { ShareButton } from "@/components/common/ShareButton";
import { ImageSpinner } from "@/components/common/Spinner";

/* ---------------- small helpers ---------------- */
type AvailableForDay = {
  dateHasEvent: boolean;
  event: { id: string; name: string; bannerUrl: string | null; availableDate: string } | null;
  eventTickets: TicketDTO[];
};

// Local types for type safety
type EventWithAny = {
  id?: string | number;
  name?: string;
  bannerUrl?: string | null;
  availableDate?: string;
  date?: string;
  eventDate?: string;
  description?: string;
  details?: string;
  about?: string;
  summary?: string;
  openHours?: { open: string; close: string };
  tickets?: TicketDTO[];
  includesMenuItem?: boolean;
  includedMenuItems?: unknown[];
};

type TicketWithAny = {
  id?: string | number;
  includesMenuItem?: boolean;
  includedMenuItems?: unknown[];
  dynamicPrice?: string | number;
  price?: string | number;
  dynamicPricingEnabled?: boolean;
  event?: {
    id?: string;
    name?: string;
    description?: string | null;
    openHours?: { open: string; close: string };
  };
};
const isCombo = (t: TicketDTO) => {
  const ticketWithAny = t as TicketWithAny;
  return ticketWithAny?.includesMenuItem === true || (Array.isArray(ticketWithAny?.includedMenuItems) && ticketWithAny.includedMenuItems.length > 0);
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
function getEventDate(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null;
  const eventWithAny = e as EventWithAny;
  const raw: unknown = eventWithAny?.availableDate ?? eventWithAny?.date ?? eventWithAny?.eventDate ?? null;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}
function getEventDesc(e: unknown): string {
  if (!e || typeof e !== 'object') return "";
  const eventWithAny = e as EventWithAny;
  return eventWithAny?.description ?? eventWithAny?.details ?? eventWithAny?.about ?? eventWithAny?.summary ?? "";
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
  eventData,
  clubId,
  clubName,
  selectedDate,
}: {
  evKey: string;
  tickets: TicketDTO[];
  qtyByTicketId: Map<string, { qty: number; itemId: string }>;
  onAdd: (t: TicketDTO) => void;
  onChangeQty: (itemId: string, nextQty: number) => void;
  eventData?: { availableDate: string; openHours?: { open: string; close: string } };
  clubId?: string;
  clubName?: string;
  selectedDate?: string | null;
}) {
  // Use the same categorization logic as TicketsGrid
  const combos = useMemo(() => tickets.filter(isCombo), [tickets]);
  const general = useMemo(() => tickets.filter((t) => {
    if (isCombo(t)) return false;
    // Use the same price logic as getPrice function
    const dynamic = Number(t.dynamicPrice);
    const base = Number(t.price);
    // For event tickets, always use dynamic price if available (includes grace period pricing)
    // For other tickets, only use dynamic pricing if it's enabled
    const shouldUseDynamic = t.category === "event" 
      ? (!isNaN(dynamic) && !isNaN(base))
      : (t.dynamicPricingEnabled && !isNaN(dynamic) && !isNaN(base));
    const price = shouldUseDynamic ? dynamic : base;
    
    
    return price > 0;
  }), [tickets]);
  const gratis = useMemo(() => tickets.filter((t) => {
    if (isCombo(t)) return false;
    // Use the same price logic as getPrice function
    const dynamic = Number(t.dynamicPrice);
    const base = Number(t.price);
    // For event tickets, always use dynamic price if available (includes grace period pricing)
    // For other tickets, only use dynamic pricing if it's enabled
    const shouldUseDynamic = t.category === "event" 
      ? (!isNaN(dynamic) && !isNaN(base))
      : (t.dynamicPricingEnabled && !isNaN(dynamic) && !isNaN(base));
    const price = shouldUseDynamic ? dynamic : base;
    return price === 0;
  }), [tickets]);

  const combosRef = useRef<HTMLDivElement | null>(null);
  const generalRef = useRef<HTMLDivElement | null>(null);
  const gratisRef = useRef<HTMLDivElement | null>(null);
  
  const chips = useMemo(
    () =>
      [
        { key: "combos" as const, label: "Combos", ref: combosRef, count: combos.length, id: `event-sec-combos-${evKey}` },
        { key: "general" as const, label: "General", ref: generalRef, count: general.length, id: `event-sec-general-${evKey}` },
        { key: "gratis" as const, label: "Gratis", ref: gratisRef, count: gratis.length, id: `event-sec-gratis-${evKey}` },
      ].filter((c) => c.count > 0),
    [combos.length, general.length, gratis.length, evKey, combosRef, generalRef, gratisRef]
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
      <Section id={`event-sec-combos-${evKey}`} title="Combos:" count={combos.length} innerRef={combosRef}>
        {combos.map((t) => {
          const ticketWithAny = t as TicketWithAny;
          const inCart = qtyByTicketId.get(String(ticketWithAny.id));
          // Attach event data to ticket for grace period logic
          const ticketWithEvent = eventData ? {
            ...t,
            event: {
              id: t.event?.id || '',
              name: t.event?.name || '',
              description: t.event?.description || null,
              availableDate: eventData.availableDate,
              openHours: eventData.openHours || t.event?.openHours
            }
          } : t;
          return (
            <TicketCard
              key={String(ticketWithAny.id)}
              ticket={ticketWithEvent}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => onAdd(t)}
              onChangeQty={onChangeQty}
              compact
              showDescription
              clubId={clubId}
              clubName={clubName}
              showShareButton={true}
              selectedDate={selectedDate ?? undefined}
            />
          );
        })}
      </Section>

      <Section id={`event-sec-general-${evKey}`} title="General:" count={general.length} innerRef={generalRef}>
        {general.map((t) => {
          const ticketWithAny = t as TicketWithAny;
          const inCart = qtyByTicketId.get(String(ticketWithAny.id));
          // Attach event data to ticket for grace period logic
          const ticketWithEvent = eventData ? {
            ...t,
            event: {
              id: t.event?.id || '',
              name: t.event?.name || '',
              description: t.event?.description || null,
              availableDate: eventData.availableDate,
              openHours: eventData.openHours || t.event?.openHours
            }
          } : t;
          return (
            <TicketCard
              key={String(ticketWithAny.id)}
              ticket={ticketWithEvent}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => onAdd(t)}
              onChangeQty={onChangeQty}
              compact
              showDescription
              clubId={clubId}
              clubName={clubName}
              showShareButton={true}
              selectedDate={selectedDate ?? undefined}
            />
          );
        })}
      </Section>

      <Section id={`event-sec-gratis-${evKey}`} title="Gratis:" count={gratis.length} innerRef={gratisRef}>
        {gratis.map((t) => {
          const ticketWithAny = t as TicketWithAny;
          const inCart = qtyByTicketId.get(String(ticketWithAny.id));
          // Attach event data to ticket for grace period logic
          const ticketWithEvent = eventData ? {
            ...t,
            event: {
              id: t.event?.id || '',
              name: t.event?.name || '',
              description: t.event?.description || null,
              availableDate: eventData.availableDate,
              openHours: eventData.openHours || t.event?.openHours
            }
          } : t;
          return (
            <TicketCard
              key={String(ticketWithAny.id)}
              ticket={ticketWithEvent}
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
  clubId,
  clubName,
}: {
  events: EventDTO[];
  selectedDate?: string | null;
  available?: AvailableForDay;
  onChooseDate: (d: string) => void;
  clubId?: string;
  clubName?: string;
}) {
  // Local lightbox (no redirect)
  const [lightbox, setLightbox] = useState<{ open: boolean; url: string | null }>({ open: false, url: null });
  const [eventImageLoading, setEventImageLoading] = useState<Record<string, boolean>>({});

  // Smooth scroll to the expanded tickets of the selected event
  const ticketsRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingScrollToId, setPendingScrollToId] = useState<string | null>(null);

  // Per-event "show full description" state
  const [descExpanded, setDescExpanded] = useState<Record<string, boolean>>({});

  // Initialize loading states for event images
  useEffect(() => {
    if (events && events.length > 0) {
      const initialStates: Record<string, boolean> = {};
      events.forEach(event => {
        const eventWithAny = event as EventWithAny;
        const evId = String(eventWithAny.id ?? "");
        if (eventWithAny.bannerUrl) {
          initialStates[evId] = true;
        }
      });
      setEventImageLoading(initialStates);
    }
  }, [events]);

  const {
    items: cartItems,
    addTicket,
    updateItemQuantity,
    removeItem
  } = useCartContext();

  // Club protection (only if clubId is provided)
  const clubProtection = useClubProtection({
    clubId: clubId || '',
  });


  const qtyByTicketId = useMemo(() => {
    const map = new Map<string, { qty: number; itemId: string }>();
    for (const item of cartItems) {
      if (item.itemType === 'ticket' && item.ticketId) {
        map.set(item.ticketId, { qty: item.quantity, itemId: item.id });
      }
    }
    return map;
  }, [cartItems]);


  // Index events by date
  const byDate = useMemo(() => {
    const m = new Map<string, EventDTO>();
    for (const e of events ?? []) {
      const eventWithAny = e as EventWithAny;
      const d = normalizeISO(eventWithAny.availableDate ?? eventWithAny.date);
      if (d) m.set(d, e);
    }
    return m;
  }, [events]);

  const dayHasEvent = available?.dateHasEvent ?? (selectedDate ? byDate.has(selectedDate) : false);
  const selectedEvent = useMemo(() => {
    if (!dayHasEvent || !selectedDate) return null;
    const eventFromAvailable = available?.event;
    const eventFromByDate = byDate.get(selectedDate) as EventWithAny;
    const event = eventFromAvailable ?? eventFromByDate ?? null;
    
    // Ensure the event has openHours from the original event data
    if (event && eventFromByDate) {
      return {
        ...event,
        openHours: eventFromByDate.openHours || (event as EventWithAny).openHours
      };
    }
    
    return event;
  }, [dayHasEvent, selectedDate, available, byDate]);

  const eventTickets: TicketDTO[] = useMemo(() => {
    if (available?.eventTickets?.length) return available.eventTickets;
    if (!selectedDate) return [];
    const ev = byDate.get(selectedDate) as EventWithAny;
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
    if (!selectedDate) return;
    
    const addFunction = async () => {
      const ticketWithAny = ticket as TicketWithAny;
      await addTicket(String(ticketWithAny.id), selectedDate, 1);
    };
    
    // Use club protection if clubId is provided
    if (clubId) {
      await clubProtection.handleAddWithProtection(addFunction);
    } else {
      await addFunction();
    }
  }
  
  async function handleChangeQty(itemId: string, nextQty: number) {
    if (nextQty <= 0) {
      await removeItem(itemId);
    } else {
      await updateItemQuantity(itemId, nextQty);
    }
  }
  

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold mb-3">Próximos eventos</h3>

      <div className="grid gap-6 lg:grid-cols-2">
        {events.map((ev) => {
          const eventWithAny = ev as EventWithAny;
          const evId = String(eventWithAny.id);
          const evDate = getEventDate(ev);
          const isSelected = !!selectedEvent && evDate && getEventDate(selectedEvent) === evDate;
          const desc = getEventDesc(ev);
          const looksLong = (desc?.length ?? 0) > 180;
          const expanded = !!descExpanded[evId];

          return (
            <div key={evId} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden" data-event-id={evId}>
              {/* Header row with image + content */}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => eventWithAny.bannerUrl && setLightbox({ open: true, url: eventWithAny.bannerUrl })}
                    className="relative h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-xl shrink-0 ring-1 ring-white/10 hover:ring-white/20 transition-all duration-200"
                    aria-label={`Ver imagen del evento ${eventWithAny.name ?? ""}`}
                  >
                    <Image 
                      src={eventWithAny.bannerUrl ?? ""} 
                      alt={eventWithAny.name ?? ""} 
                      fill 
                      className="object-cover"
                      onLoad={() => setEventImageLoading(prev => ({ ...prev, [evId]: false }))}
                      onError={() => setEventImageLoading(prev => ({ ...prev, [evId]: false }))}
                    />
                    {eventImageLoading[evId] !== false && <ImageSpinner />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-white font-semibold text-lg leading-tight">{eventWithAny.name}</div>
                      <ShareButton
                        options={{
                          event: {
                            id: evId,
                            name: eventWithAny.name || '',
                            description: getEventDesc(ev),
                            availableDate: eventWithAny.availableDate || '',
                            bannerUrl: eventWithAny.bannerUrl || undefined,
                            clubId: clubId || '',
                            clubName: clubName
                          },
                          clubId: clubId || '',
                          clubName: clubName
                        }}
                        variant="button-gray"
                        size="sm"
                      />
                    </div>
                    {evDate && (
                      <div className="text-white/70 text-sm font-medium mt-1">
                        {formatDateLabel(evDate)}
                      </div>
                    )}
                    {eventWithAny.openHours && (
                      <div className="mt-2 flex items-center gap-2 text-white/70 text-sm">
                        <svg className="h-4 w-4 text-white/60 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{eventWithAny.openHours.open} - {eventWithAny.openHours.close}</span>
                      </div>
                    )}

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
                        className="mt-4 w-full rounded-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white py-3 px-4 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
                        const hasAny = eventTickets.length > 0;
                        return hasAny ? (
                          <ExpandedEventTickets
                            evKey={evId}
                            tickets={eventTickets}
                            qtyByTicketId={qtyByTicketId}
                            onAdd={handleAdd}
                            onChangeQty={handleChangeQty}
                            eventData={selectedEvent ? {
                              availableDate: selectedEvent.availableDate || '',
                              openHours: (selectedEvent as EventWithAny).openHours
                            } : undefined}
                            clubId={clubId}
                            clubName={clubName}
                            selectedDate={selectedDate ?? undefined}
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
          <Image src={lightbox.url ?? ""} alt="" width={800} height={600} className="max-h-[90vh] max-w-[90vw] object-contain" />
        </button>
      )}

      {/* Club Change Modal */}
      {clubId && (
        <CartClubChangeModal
          isOpen={clubProtection.showClubModal}
          onClose={clubProtection.handleCancelClubChange}
          onClearCart={clubProtection.handleClearCartAndClose}
          currentClubName={clubProtection.currentClubName}
          newClubName={clubName || "este club"}
        />
      )}

    </section>
  );
}
