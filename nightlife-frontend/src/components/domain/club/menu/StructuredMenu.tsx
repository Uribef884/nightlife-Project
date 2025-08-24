// src/components/domain/club/menu/StructuredMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  addMenuItemToCart,
  addMenuVariantToCart,
  getMenuItemsForClubCSR,
  getMenuCartSummaryCSR,
  clearTicketCartForMenuCSR, // clears OTHER cart (tickets) when adding menu
  updateMenuCartQty,
  removeMenuCartItem,
  type MenuItemDTO,
  type MenuVariantDTO,
} from "@/services/menu.service";
import { getTicketCartSummary } from "@/services/cart.service";
import { MenuItemCard } from "./MenuItemCard";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/** Sticky category chip nav + sections */
export function StructuredMenu({ clubId }: { clubId: string }) {
  const [items, setItems] = useState<MenuItemDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart summaries
  const [menuCart, setMenuCart] = useState<{
    items: { id: string; menuItemId: string; variantId?: string | null; quantity: number }[];
  } | null>(null);
  const [ticketCart, setTicketCart] = useState<{ items: any[] } | null>(null);

  // Confirm modal: clear ticket cart before adding menu
  const [askClearTickets, setAskClearTickets] = useState<null | { proceed: () => Promise<void> }>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [data, m, t] = await Promise.all([
          getMenuItemsForClubCSR(clubId),
          getMenuCartSummaryCSR(),
          getTicketCartSummary(),
        ]);
        if (!alive) return;
        setItems((data ?? []).filter((it) => (it as any)?.isActive !== false));
        setMenuCart(m as any);
        setTicketCart(t as any);
      } finally {
        if (alive) setLoading(false);
      }
    })().catch(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, [clubId]);

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

  const chipsRef = useRef<HTMLDivElement | null>(null);
  // ✅ FIX: sections are <section> elements → use HTMLElement, not HTMLDivElement
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  function scrollToCategory(catId: string) {
    const el = sectionRefs.current[catId];
    if (!el) return;
    const offset = 72; // reserve space for sticky tabs/header
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
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

  return (
    <div className="space-y-4">
      {/* Sticky category chips */}
      <div
        ref={chipsRef}
        className="sticky top-14 z-10 -mx-4 px-4 py-2 bg-[#0B0B10]/75 backdrop-blur border-b border-white/10"
      >
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => scrollToCategory(c.id)}
              className="shrink-0 rounded-full bg-white/10 hover:bg-white/15 text-white text-sm px-3 py-1.5"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {categories.map((c) => (
        <section
          key={c.id}
          ref={(el: HTMLElement | null) => {
            sectionRefs.current[c.id] = el; // ✅ HTMLElement
          }}
          className="rounded-2xl border border-white/10 bg-white/5 p-4"
        >
          <h3 className="text-white font-semibold mb-3">{c.name}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {c.items.map((item) => {
              const itemInCart = qtyByItemId.get(String(item.id));
              return (
                <MenuItemCard
                  key={String(item.id)}
                  item={item}
                  qtyInCartForItem={itemInCart?.qty ?? 0}
                  cartLineIdForItem={itemInCart?.id ?? ""}
                  qtyByVariantId={qtyByVariantId}
                  onAddItem={() => handleAddItem(String(item.id))}
                  onAddVariant={(v) => handleAddVariant(String(item.id), v)}
                  onChangeQty={handleChangeQty}
                />
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
