// nightlife-frontend/src/components/domain/club/TicketsGrid.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Merge ordering (available.*) with enriched tickets by id. Enriched wins. */
function mergeById(ordering: TicketDTO[] | undefined, enriched: TicketDTO[]): TicketDTO[] {
  if (!ordering || ordering.length === 0) return enriched;
  const map = new Map(enriched.map((t) => [t.id, t]));
  return ordering.map((o) => (map.has(o.id) ? { ...o, ...map.get(o.id)! } : o));
}

/** Define "Combo" for the UI */
function isCombo(t: TicketDTO): boolean {
  const anyT = t as any;
  return anyT?.includesMenuItem === true || (Array.isArray(anyT?.includedMenuItems) && anyT.includedMenuItems.length > 0);
}

// Smooth-scroll helper with small offset (in case of sticky headers)
function smoothScrollTo(el: HTMLElement, offset = 80) {
  try {
    const rect = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + rect.top - offset, behavior: "smooth" });
  } catch {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

type CartSummary = { items: Array<{ id: string; ticketId: string; quantity: number }> };

export default function TicketsGrid({
  club,
  selectedDate,
  events,
  tickets,
  available,
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
  if (process.env.NODE_ENV !== "production") {
    console.assert(typeof TicketCard === "function", "[TicketsGrid] TicketCard import invalid");
  }

  // Carts
  const [ticketCart, setTicketCart] = useState<CartSummary | null>(null);
  const [menuCart, setMenuCart] = useState<{ items: any[] } | null>(null);



  // Section refs for scroll/highlight
  const secRefs = {
    combos: useRef<HTMLDivElement | null>(null),
    general: useRef<HTMLDivElement | null>(null),
    gratis: useRef<HTMLDivElement | null>(null),
  };
  const [activeChip, setActiveChip] = useState<"combos" | "general" | "gratis" | null>(null);

  // Modal
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

  // qty map
  const qtyByTicketId = useMemo(() => {
    const map = new Map<string, { qty: number; itemId: string }>();
    for (const it of ticketCart?.items ?? []) map.set(it.ticketId, { qty: it.quantity, itemId: it.id });
    return map;
  }, [ticketCart]);

  // Category slices from enriched
  const ticketsGeneral = useMemo(() => tickets.filter((t) => (t as any).category === "general"), [tickets]);
  const ticketsFree = useMemo(() => tickets.filter((t) => (t as any).category === "free"), [tickets]);

  // Merge available ordering
  const mergedGeneral = useMemo(
    () => mergeById(available?.generalTickets, ticketsGeneral),
    [available?.generalTickets, ticketsGeneral]
  );
  const mergedFree = useMemo(() => mergeById(available?.freeTickets, ticketsFree), [available?.freeTickets, ticketsFree]);

  // Grouping (maintains backend priority order)
  const [combos, general, gratis] = useMemo(() => {
    return [
      mergedGeneral.filter(isCombo),
      mergedGeneral.filter((t) => !isCombo(t)),
      mergedFree,
    ] as const;
  }, [mergedGeneral, mergedFree]);

  // Build chips only for non-empty categories
  const chips = useMemo(
    () =>
      [
        { key: "combos" as const, label: "Combos", ref: secRefs.combos, count: combos.length },
        { key: "general" as const, label: "General", ref: secRefs.general, count: general.length },
        { key: "gratis" as const, label: "Gratis", ref: secRefs.gratis, count: gratis.length },
      ].filter((c) => c.count > 0),
    [combos.length, general.length, gratis.length]
  );

  // Initialize active chip to the first available
  useEffect(() => {
    setActiveChip((prev) => prev ?? (chips[0]?.key ?? null));
  }, [chips]);

  // Observe sections to auto-highlight chips while scrolling
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
      {
        root: null,
        threshold: [0.15, 0.35, 0.55, 0.75],
        rootMargin: "-40px 0px -40% 0px",
      }
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

  if (!selectedDate) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Selecciona una fecha para ver las reservas disponibles.
      </section>
    );
  }

  // Handlers
  async function handleAdd(t: TicketDTO) {
    if (!selectedDate) return;
    if (menuCart && (menuCart.items?.length ?? 0) > 0) {
      setPendingTicket(t);
      setShowConfirmClearMenu(true);
      return;
    }
    await addTicketToCart({ ticketId: t.id, date: selectedDate, quantity: 1 });
    await refreshCarts();
  }
  async function handleChangeQty(itemId: string, nextQty: number) {
    if (nextQty <= 0) await removeTicketItem(itemId);
    else await updateTicketQty({ id: itemId, quantity: nextQty });
    await refreshCarts();
  }
  async function confirmClearMenuAndAdd() {
    if (!pendingTicket || !selectedDate) return;
    try {
      await clearMenuCart();
      await addTicketToCart({ ticketId: pendingTicket.id, date: selectedDate, quantity: 1 });
    } finally {
      setPendingTicket(null);
      setShowConfirmClearMenu(false);
      await refreshCarts();
    }
  }

  // Section shell (ref type = React.Ref<HTMLDivElement> so useRef<HTMLDivElement|null> is OK)
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
      <div ref={innerRef} id={id} className="mb-5 scroll-mt-24">
        <div className="mb-2">
          <h4 className="text-white/90 text-sm font-semibold">{title}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>
      </div>
    );
  }

  /* -------------- segmented control (pills) -------------- */
  const chipBase =
    "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors";
  const chipActive =
    "bg-[#7A48D3] text-white";
  const chipInactive = "bg-white/5 text-white/70 hover:text-white hover:bg-white/10";
  const chipBadge =
    "ml-1 inline-flex min-w-[18px] h-[18px] px-1.5 rounded-full justify-center items-center text-[10px] font-bold";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="text-white font-semibold mb-3">Reservas disponibles</h3>

      {/* Chip nav + sort */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 overflow-x-auto">
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


      </div>

      {/* Sections */}
      <Section id="tickets-sec-combos" title="Combos:" count={combos.length} innerRef={secRefs.combos}>
        {combos.map((t) => {
          const inCart = qtyByTicketId.get(t.id);
          return (
            <TicketCard
              key={t.id}
              ticket={t}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => handleAdd(t)}
              onChangeQty={handleChangeQty}
              compact
              showDescription
            />
          );
        })}
      </Section>

      <Section id="tickets-sec-general" title="General:" count={general.length} innerRef={secRefs.general}>
        {general.map((t) => {
          const inCart = qtyByTicketId.get(t.id);
          return (
            <TicketCard
              key={t.id}
              ticket={t}
              qtyInCart={inCart?.qty ?? 0}
              itemId={inCart?.itemId ?? ""}
              onAdd={() => handleAdd(t)}
              onChangeQty={handleChangeQty}
              compact
              showDescription
            />
          );
        })}
      </Section>

      <Section id="tickets-sec-gratis" title="Gratis:" count={gratis.length} innerRef={secRefs.gratis}>
        {gratis.map((t) => {
          const inCart = qtyByTicketId.get(t.id);
          return (
            <TicketCard
              key={t.id}
              ticket={t}
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
      </Section>

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
