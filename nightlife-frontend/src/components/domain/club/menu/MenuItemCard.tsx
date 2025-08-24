// src/components/domain/club/menu/MenuItemCard.tsx
"use client";

import { useMemo, useState } from "react";
import type { MenuItemDTO, MenuVariantDTO } from "@/services/menu.service";
import { VariantRow } from "./VariantRow";

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmt(n: number | null, currency = "COP"): string {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(n);
  } catch {
    return `$ ${n.toLocaleString("es-CO")}`;
  }
}

export function MenuItemCard({
  item,
  qtyInCartForItem = 0,
  cartLineIdForItem = "",
  qtyByVariantId = new Map<string, { qty: number; id: string }>(),
  onAddItem,
  onAddVariant,
  onChangeQty,
}: {
  item: MenuItemDTO;
  qtyInCartForItem?: number;
  cartLineIdForItem?: string;
  qtyByVariantId?: Map<string, { qty: number; id: string }>;
  onAddItem: () => void; // only for items without variants
  onAddVariant: (variant: MenuVariantDTO) => void;
  onChangeQty: (cartLineId: string, nextQty: number) => void;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  const hasVariants = !!item.hasVariants && (item.variants?.length ?? 0) > 0;

  const priceNow = toNum((item as any).price);
  const compareAt =
    toNum((item as any)?.compareAtPrice) ??
    toNum((item as any)?.originalPrice) ??
    null;

  const maxPerPerson = (item as any)?.maxPerPerson as number | null | undefined;
  const maxAllowed = useMemo(() => {
    const fromMax = maxPerPerson == null ? Infinity : Math.max(0, maxPerPerson);
    return fromMax;
  }, [maxPerPerson]);
  const canInc = qtyInCartForItem < maxAllowed;
  const canDec = qtyInCartForItem > 0;

  const desc = (item.description ?? "") as string;
  const longDesc = (desc?.length ?? 0) > 110;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex gap-3">
        {item.imageUrl ? (
          <div className="relative h-14 w-14 overflow-hidden rounded-md ring-1 ring-white/10 shrink-0">
            <img src={item.imageUrl} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-white truncate">{item.name}</div>

          <div className="mt-1 flex items-baseline gap-2">
            {/* DP: only show slash when we actually have a higher compareAt */}
            {compareAt != null && priceNow != null && compareAt > priceNow ? (
              <span className="text-white/40 line-through text-sm">{fmt(compareAt)}</span>
            ) : null}

            {/* price or "desde" when variants */}
            {!hasVariants ? (
              <span className="text-white text-[15px] font-bold">{fmt(priceNow)}</span>
            ) : (
              <span className="text-white/90 text-sm">Desde {fmt(
                toNum(
                  (item.variants ?? [])
                    .map((v) => Number(v.price))
                    .filter((n) => Number.isFinite(n))
                    .sort((a, b) => a - b)[0] ?? null
                )
              )}</span>
            )}
          </div>

          {/* Description (2-line clamp + chevron) */}
          {desc ? (
            <div className="mt-2">
              <p className={["text-white/80 text-sm leading-5", descExpanded ? "" : "max-h-[2.5rem] overflow-hidden"].join(" ")}>
                {desc}
              </p>
              {longDesc && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white/90"
                  aria-expanded={descExpanded}
                >
                  <span>{descExpanded ? "Ver menos" : "Ver más"}</span>
                  <svg className={["h-3 w-3 transition-transform", descExpanded ? "rotate-180" : ""].join(" ")} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12.5l-5-5h10l-5 5z" />
                  </svg>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* CTA area */}
      <div className="mt-3">
        {!hasVariants ? (
          // Item directly purchasable
          qtyInCartForItem > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => cartLineIdForItem && onChangeQty(cartLineIdForItem, Math.max(0, qtyInCartForItem - 1))}
                disabled={!canDec}
                className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                −
              </button>
              <div className="min-w-[2rem] text-center text-white font-semibold">{qtyInCartForItem}</div>
              <button
                type="button"
                onClick={() => cartLineIdForItem && onChangeQty(cartLineIdForItem, Math.min(qtyInCartForItem + 1, Number.isFinite(maxAllowed) ? maxAllowed : qtyInCartForItem + 1))}
                disabled={!canInc}
                className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                +
              </button>

              {Number.isFinite(maxAllowed) ? <div className="ml-auto text-xs text-white/60">Límite: {maxAllowed}</div> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={onAddItem}
              className="w-full rounded-full bg-green-600 hover:bg-green-500 text-white py-2 font-semibold"
            >
              Agregar al carrito
            </button>
          )
        ) : (
          // Has variants — show toggle to reveal variant rows
          <button
            type="button"
            onClick={() => setShowVariants((v) => !v)}
            className="w-full rounded-full bg-white/10 hover:bg-white/15 text-white py-2 font-semibold"
          >
            {showVariants ? "Ocultar opciones" : "Ver opciones"}
          </button>
        )}
      </div>

      {/* Variants list (no images) */}
      {hasVariants && showVariants && (
        <div className="mt-2 border-t border-white/10 pt-2">
          {(item.variants ?? []).filter((v) => (v as any)?.isActive !== false).map((variant) => {
            const vId = String((variant as any).id);
            const inCart = qtyByVariantId.get(vId);
            return (
              <VariantRow
                key={vId}
                variant={variant}
                qtyInCart={inCart?.qty ?? 0}
                cartLineId={inCart?.id ?? ""}
                onAdd={() => onAddVariant(variant)}
                onChangeQty={onChangeQty}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
