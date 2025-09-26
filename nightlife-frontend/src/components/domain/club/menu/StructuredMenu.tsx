// src/components/domain/club/menu/StructuredMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getMenuItemsForClubCSR,
  getAvailableMenuForDate,
  type MenuItemDTO,
  type MenuVariantDTO,
} from "@/services/menu.service";
import { useCartContext } from "@/contexts/CartContext";
import { useClubProtection } from "@/hooks/useClubProtection";
import { CartClubChangeModal } from "@/components/cart";
import { MenuItemCard } from "./MenuItemCard";

/** Sticky category pill nav + sections + animated variants */
export function StructuredMenu({ 
  clubId, 
  clubName,
  selectedDate, 
  openDays, 
  eventDates, 
  freeDates 
}: { 
  clubId: string; 
  clubName?: string;
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

  const {
    items: cartItems,
    addMenuItem,
    updateItemQuantity,
    removeItem,
    isLoading: cartLoading,
  } = useCartContext();

  // Club protection
  const clubProtection = useClubProtection({
    clubId,
    clubName: clubName || "este club",
  });


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
          try {
            const menuData = await getAvailableMenuForDate(clubId, selectedDate);
            if (!alive) return;
            
            // Extract menu items from categories
            const allItems: MenuItemDTO[] = [];
            if (menuData?.categories) {
              menuData.categories.forEach(category => {
                if (category?.items) {
                  allItems.push(...category.items);
                }
              });
            }
            
            const filteredItems = allItems.filter((it) => it.isActive !== false);
            setItems(filteredItems);
            setEventInfo({
              dateHasEvent: menuData?.dateHasEvent || false,
              event: menuData?.event || null
            });
          } catch {
            // Fallback to basic menu loading
            const data = await getMenuItemsForClubCSR(clubId, selectedDate);
            if (!alive) return;
            setItems((data ?? []).filter((it) => it.isActive !== false));
            setEventInfo(null);
          }
        } else {
          // Fallback to old service when no date is selected
          const data = await getMenuItemsForClubCSR(clubId, selectedDate);
          if (!alive) return;
          setItems((data ?? []).filter((it) => (it as any)?.isActive !== false));
          setEventInfo(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [clubId, selectedDate]);

  const qtyByItemId = useMemo(() => {
    const mp = new Map<string, { qty: number; id: string }>();
    for (const item of cartItems) {
      if (item.itemType === 'menu' && item.menuItemId && !item.variantId) {
        mp.set(item.menuItemId, { qty: item.quantity, id: item.id });
      }
    }
    return mp;
  }, [cartItems]);

  const qtyByVariantId = useMemo(() => {
    const mp = new Map<string, { qty: number; id: string }>();
    for (const item of cartItems) {
      if (item.itemType === 'menu' && item.variantId) {
        mp.set(item.variantId, { qty: item.quantity, id: item.id });
      }
    }
    return mp;
  }, [cartItems]);


  // Build categories map and items per category
  const categories = useMemo(() => {
    const byCat: Record<string, { id: string; name: string; items: MenuItemDTO[] }> = {};
    for (const it of items) {
      const catId = String(it.categoryId);
      const catName = it.category?.name ?? "Otros";
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


  // Handlers
  async function handleAddItem(menuItemId: string) {
    if (!selectedDate) {
      console.error('No date selected for menu item');
      return;
    }
    
    const addFunction = async () => {
      await addMenuItem(menuItemId, undefined, selectedDate, 1);
    };
    
    await clubProtection.handleAddWithProtection(addFunction);
  }
  
  async function handleAddVariant(menuItemId: string, variant: MenuVariantDTO) {
    if (!selectedDate) {
      console.error('No date selected for menu variant');
      return;
    }
    
    const addFunction = async () => {
      await addMenuItem(menuItemId, String(variant.id), selectedDate, 1);
    };
    
    await clubProtection.handleAddWithProtection(addFunction);
  }
  
  async function handleChangeQty(lineId: string, nextQty: number) {
    if (nextQty <= 0) {
      await removeItem(lineId);
    } else {
      await updateItemQuantity(lineId, nextQty);
    }
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
              const variants: MenuVariantDTO[] | undefined = item.variants;

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

      {/* Club Change Modal */}
      <CartClubChangeModal
        isOpen={clubProtection.showClubModal}
        onClose={clubProtection.handleCancelClubChange}
        onClearCart={clubProtection.handleClearCartAndClose}
        currentClubName={clubProtection.currentClubName}
        newClubName={clubName || "este club"}
      />

    </div>
  );
}
