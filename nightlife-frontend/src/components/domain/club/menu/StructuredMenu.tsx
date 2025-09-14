// src/components/domain/club/menu/StructuredMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMenuItemToCart,
  addMenuVariantToCart,
  getMenuItemsForClubCSR,
  getAvailableMenuForDate,
  getMenuCartSummaryCSR,
  clearTicketCartForMenuCSR, // clears OTHER cart (tickets) when adding menu
  updateMenuCartQty,
  removeMenuCartItem,
  type MenuItemDTO,
  type MenuVariantDTO,
  type AvailableMenuResponse,
} from "@/services/menu.service";
import { getTicketCartSummary } from "@/services/cart.service";
import { MenuItemCard } from "./MenuItemCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/** Sticky category pill nav + sections + animated variants */
export function StructuredMenu({ 
  clubId, 
  selectedDate, 
  openDays, 
  eventDates, 
  freeDates 
}: { 
  clubId: string; 
  selectedDate?: string;
  openDays?: Set<string>;
  eventDates?: Set<string>;
  freeDates?: Set<string>;
}) {
  const [items, setItems] = useState<MenuItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventInfo, setEventInfo] = useState<{
    dateHasEvent: boolean;
    event: {
      id: string;
      name: string;
      availableDate: string;
      bannerUrl: string | null;
    } | null;
  } | null>(null);

  // Cart summaries
  const [menuCart, setMenuCart] = useState<{
    items: { id: string; menuItemId: string; variantId?: string | null; quantity: number }[];
  } | null>(null);
  const [ticketCart, setTicketCart] = useState<{ items: any[] } | null>(null);

  // Confirm modal: clear ticket cart before adding menu
  const [askClearTickets, setAskClearTickets] = useState<null | { proceed: () => Promise<void> }>(null);

  // Helper function to validate if a date is a valid/open day
  const isValidDate = (date: string | null | undefined): boolean => {
    if (!date) return false;
    
    const openDaysSet = openDays || new Set<string>();
    const eventDatesSet = eventDates || new Set<string>();
    const freeDatesSet = freeDates || new Set<string>();
    
    // Check if it's an event date, free date, or regular open day
    if (eventDatesSet.has(date) || freeDatesSet.has(date)) {
      return true;
    }
    
    // Check if it's a regular open day
    // Fix timezone issue: append noon time to ensure local date parsing
    const dateObj = new Date(date + 'T12:00:00');
    const weekdayFull = [
      "sunday",
      "monday", 
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday"
    ][dateObj.getDay()];
    
    return openDaysSet.has(weekdayFull);
  };



  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        
        // Use the new event-aware menu service if we have a selected date
        if (selectedDate) {
          const [menuData, m, t] = await Promise.all([
            getAvailableMenuForDate(clubId, selectedDate),
            getMenuCartSummaryCSR(),
            getTicketCartSummary(),
          ]);
          if (!alive) return;
          
          // Extract menu items from categories
          const allItems: MenuItemDTO[] = [];
          menuData.categories.forEach(category => {
            allItems.push(...category.items);
          });
          
          setItems(allItems.filter((it) => (it as any)?.isActive !== false));
          setEventInfo({
            dateHasEvent: menuData.dateHasEvent,
            event: menuData.event
          });
          setMenuCart(m as any);
          setTicketCart(t as any);
        } else {
          // Fallback to old service when no date is selected
          const [data, m, t] = await Promise.all([
            getMenuItemsForClubCSR(clubId),
            getMenuCartSummaryCSR(),
            getTicketCartSummary(),
          ]);
          if (!alive) return;
          setItems((data ?? []).filter((it) => (it as any)?.isActive !== false));
          setEventInfo(null);
          setMenuCart(m as any);
          setTicketCart(t as any);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [clubId, selectedDate]);

  async function refreshCarts() {
    const [m, t] = await Promise.all([getMenuCartSummaryCSR(), getTicketCartSummary()]);
    setMenuCart(m as any);
    setTicketCart(t as any);
  }

  const qtyByItemId = useMemo(() => {
    const mp = new Map<string, { qty: number; id: string }>();
    for (const it of menuCart?.items ?? []) {
      if (it.variantId) continue; // parent-only quantity for items without variants
      mp.set(String(it.menuItemId), { qty: it.quantity, id: it.id });
    }
    return mp;
  }, [menuCart]);

  const qtyByVariantId = useMemo(() => {
    const mp = new Map<string, { qty: number; id: string }>();
    for (const it of menuCart?.items ?? []) {
      if (!it.variantId) continue;
      mp.set(String(it.variantId), { qty: it.quantity, id: it.id });
    }
    return mp;
  }, [menuCart]);

  // Build categories map and items per category
  const categories = useMemo(() => {
    const byCat: Record<string, { id: string; name: string; items: MenuItemDTO[] }> = {};
    for (const it of items) {
      const catId = String((it as any).categoryId);
      const catName = (it as any)?.category?.name ?? "Otros";
      if (!byCat[catId]) byCat[catId] = { id: catId, name: catName, items: [] };
      byCat[catId].items.push(it);
    }
    return Object.values(byCat).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [items]);

  // ✅ sections are <section> → use HTMLElement, not HTMLDivElement
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeCat, setActiveCat] = useState<string | null>(null);

  /** Read `--nl-sticky-top` safely (fallback 64px) */
  const readStickyTop = () => {
    const root = document.documentElement;
    const v = getComputedStyle(root).getPropertyValue("--nl-sticky-top").trim();
    const n = parseFloat(v.replace("px", ""));
    return Number.isFinite(n) ? n : 64;
  };

  function scrollToCategory(catId: string) {
    const el = sectionRefs.current[catId];
    if (!el) return;
    
    try {
      const stickyTop = readStickyTop();
      // Fix: Use offsetTop instead of getBoundingClientRect for more reliable positioning
      const y = el.offsetTop - stickyTop - 20; // Add 20px buffer for better visual
      window.scrollTo({ top: y, behavior: "smooth" });
    } catch (error) {
      // Fallback: simple scroll to element
      console.warn('Smooth scroll failed, using fallback:', error);
      el.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }

  // Show a confirm modal if tickets cart has items, then run `proceed` on confirm
  async function withTicketsClearGuard(proceed: () => Promise<void>) {
    const hasTickets = (ticketCart?.items?.length ?? 0) > 0;
    if (hasTickets) {
      setAskClearTickets({
        proceed: async () => {
          try {
            await clearTicketCartForMenuCSR(); // clear OTHER cart (tickets)
            setAskClearTickets(null);
            await proceed(); // now run the original add
          } finally {
            await refreshCarts();
          }
        },
      });
      return;
    }
    await proceed();
    await refreshCarts();
  }

  // Handlers
  async function handleAddItem(menuItemId: string) {
    await withTicketsClearGuard(async () => {
      await addMenuItemToCart({ menuItemId, quantity: 1 });
    });
  }
  async function handleAddVariant(menuItemId: string, variant: MenuVariantDTO) {
    await withTicketsClearGuard(async () => {
      await addMenuVariantToCart({
        menuItemId,
        variantId: String((variant as any).id),
        quantity: 1,
      });
    });
  }
  async function handleChangeQty(lineId: string, nextQty: number) {
    if (nextQty <= 0) {
      await removeMenuCartItem(lineId);
    } else {
      await updateMenuCartQty({ id: lineId, quantity: nextQty });
    }
    await refreshCarts();
  }

  // 🔎 Highlight active category while scrolling (aligned to stickyTop)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stickyTop = readStickyTop();

    const io = new IntersectionObserver(
      (entries) => {
        let candidate: { id: string; top: number } | null = null;
        for (const en of entries) {
          const el = en.target as HTMLElement;
          const id = el.dataset.catid;
          if (!id) continue;
          if (!en.isIntersecting) continue;
          const top = Math.abs(el.getBoundingClientRect().top - stickyTop);
          if (!candidate || top < candidate.top) candidate = { id, top };
        }
        if (candidate) setActiveCat(candidate.id);
      },
      {
        root: null,
        rootMargin: `-${stickyTop}px 0px -60% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const els: HTMLElement[] = [];
    for (const id of Object.keys(sectionRefs.current)) {
      const el = sectionRefs.current[id];
      if (el) {
        els.push(el);
        io.observe(el);
      }
    }
    if (els.length === 0) {
      requestAnimationFrame(() => {
        for (const id of Object.keys(sectionRefs.current)) {
          const el = sectionRefs.current[id];
          if (el) io.observe(el);
        }
      });
    }
    return () => io.disconnect();
  }, [categories]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Rounded sticky CATEGORY PILL (centered + draggable horizontal scroll)
  // ─────────────────────────────────────────────────────────────────────────────
  const pillRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = pillRef.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startScroll = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      el.scrollLeft = startScroll - dx;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onUp, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        Cargando carta…
      </div>
    );
  }
  if (!categories.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/60">
        Este club no tiene ítems de carta.
      </div>
    );
  }

  // Event information display
  const renderEventInfo = () => {
    if (!eventInfo || !eventInfo.dateHasEvent || !eventInfo.event) return null;

    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div>
            <h3 className="text-white font-semibold text-lg">{eventInfo.event.name}</h3>
            <p className="text-white/70 text-sm">
              Evento especial • Precios con descuento por reserva anticipada
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Event information */}
      {renderEventInfo()}
      
      {/* Sticky category pill */}
      <div className="sticky z-30 -mx-4 px-4 top-[var(--nl-sticky-top,64px)]">
        <div
          ref={pillRef}
          className="
            w-full rounded-full
            bg-[#0D1222]/80 ring-1 ring-white/15 shadow-[0_4px_16px_rgba(0,0,0,0.25)]
            overflow-x-auto no-scrollbar backdrop-blur
          "
          // ↑ Darker (but still transparent) pill for readability
          style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex items-center justify-center gap-2 min-w-max px-2 py-2">
            {categories.map((c, idx) => {
              const isActive = activeCat ? activeCat === c.id : idx === 0;
              return (
                <button
                  key={c.id}
                  onClick={() => scrollToCategory(c.id)}
                  className={[
                    "shrink-0 rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-[#7A48D3] text-white shadow"
                      : "bg-white/10 text-white/80 hover:text-white hover:bg-white/15",
                  ].join(" ")}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sections */}
      {categories.map((c) => (
        <section
          key={c.id}
          ref={(el: HTMLElement | null) => {
            sectionRefs.current[c.id] = el; // ✅ HTMLElement
          }}
          data-catid={c.id}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
          style={{ scrollMarginTop: "calc(var(--nl-sticky-top, 64px) + 20px)" }}
        >
          <h3 className="text-white font-semibold mb-3">{c.name}</h3>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {c.items.map((item) => {
              const itemId = String(item.id);
              const itemInCart = qtyByItemId.get(itemId);
              const variants: MenuVariantDTO[] | undefined = (item as any)?.variants;

              const hasVariants = Array.isArray(variants) && variants.length > 0;

              return (
                <div key={itemId} className="rounded-2xl">
                  {/* Existing card (unchanged) */}
                  <MenuItemCard
                    item={item}
                    qtyInCartForItem={itemInCart?.qty ?? 0}
                    cartLineIdForItem={itemInCart?.id ?? ""}
                    qtyByVariantId={qtyByVariantId}
                    selectedDate={isValidDate(selectedDate) ? selectedDate : null}
                    onAddItem={() => handleAddItem(itemId)}
                    onAddVariant={(v) => handleAddVariant(itemId, v)}
                    onChangeQty={handleChangeQty}
                  />


                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Confirm clearing OTHER cart (tickets) */}
      {askClearTickets && (
        <ConfirmModal
          title="Tienes entradas en el carrito"
          body="Para agregar consumos debes vaciar primero el carrito de entradas. ¿Quieres vaciarlo y continuar?"
          onClose={() => setAskClearTickets(null)}
          onConfirm={askClearTickets.proceed}
        />
      )}
    </div>
  );
}
