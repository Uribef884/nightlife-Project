// src/components/domain/club/menu/MenuItemCard.tsx
"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

// 🔸 Small, self-contained cocktail placeholder (SVG data URL)
// - Dark tile + purple liquid + stirrer
// - Very compact and safe to inline
const PLACEHOLDER_DATA_URL =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160' role='img' aria-label='Cocktail'>
      <defs>
        <radialGradient id='g' cx='0' cy='0' r='1' gradientUnits='userSpaceOnUse'
          gradientTransform='translate(80 60) rotate(90) scale(100)'>
          <stop offset='0' stop-color='#7A48D3' stop-opacity='.18'/>
          <stop offset='1' stop-color='#0B0F1A' stop-opacity='.88'/>
        </radialGradient>
      </defs>
      <rect x='6' y='6' width='148' height='148' rx='18' fill='url(#g)'/>
      <rect x='6.5' y='6.5' width='147' height='147' rx='17.5' fill='none' stroke='rgba(255,255,255,.10)'/>
      <g transform='translate(0,4)' stroke-linecap='round'>
        <!-- liquid -->
        <path d='M56 52H104L80 74Z' fill='#7A48D3' fill-opacity='.45'/>
        <!-- ice (clipped) -->
        <clipPath id='c'><path d='M58 54H102L80 73Z'/></clipPath>
        <g clip-path='url(#c)' stroke='rgba(255,255,255,.55)' fill='none' stroke-width='1.5'>
          <rect x='70' y='58' width='10' height='10' rx='1.6' transform='rotate(12 70 58)'/>
          <rect x='88' y='59' width='9.5' height='9.5' rx='1.5' transform='rotate(-14 88 59)'/>
        </g>
        <!-- stirrer (under rim) -->
        <path d='M96 36L112 20' stroke='rgba(255,255,255,.8)' stroke-width='2'/>
        <!-- bowl rim -->
        <path d='M50 46H110L80 80Z' fill='none' stroke='rgba(255,255,255,.85)' stroke-width='2'/>
        <!-- stem + base -->
        <path d='M80 80V112' stroke='rgba(255,255,255,.85)' stroke-width='2'/>
        <path d='M60 114H100' stroke='rgba(255,255,255,.65)' stroke-width='2'/>
      </g>
    </svg>`
  );

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

  // Pick initial src; if empty, start with placeholder
  const initialImageSrc =
    (item.imageUrl && String(item.imageUrl).trim().length > 0)
      ? String(item.imageUrl)
      : PLACEHOLDER_DATA_URL;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex gap-3">
        {/* Thumbnail: always rendered; swaps to data-URL on error */}
        <div className="relative h-14 w-14 overflow-hidden rounded-md ring-1 ring-white/10 shrink-0">
          <img
            src={initialImageSrc}
            alt={item.name || "Menu item"}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== PLACEHOLDER_DATA_URL) {
                img.src = PLACEHOLDER_DATA_URL; // guaranteed to exist
              }
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-white truncate">{item.name}</div>

          <div className="mt-1 flex items-baseline gap-2">
            {compareAt != null && priceNow != null && compareAt > priceNow ? (
              <span className="text-white/40 line-through text-sm">{fmt(compareAt)}</span>
            ) : null}

            {!hasVariants ? (
              <span className="text-white text-[15px] font-bold">{fmt(priceNow)}</span>
            ) : (
              <span className="text-white/90 text-sm">
                Desde{" "}
                {fmt(
                  toNum(
                    (item.variants ?? [])
                      .map((v) => Number(v.price))
                      .filter((n) => Number.isFinite(n))
                      .sort((a, b) => a - b)[0] ?? null
                  )
                )}
              </span>
            )}
          </div>

          {/* Description (2-line clamp + chevron) with animation */}
          {desc ? (
            <div className="mt-2">
              <AnimatePresence initial={false}>
                {descExpanded ? (
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
                    className="text-white/80 text-sm leading-5 overflow-hidden"
                  >
                    {desc}
                  </motion.p>
                ) : (
                  <motion.p
                    key="collapsed"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "2.5rem" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                      duration: 0.2,
                      ease: [0.16, 1, 0.3, 1],
                      height: { duration: 0.25 }
                    }}
                    className="text-white/80 text-sm leading-5 overflow-hidden"
                  >
                    {desc}
                  </motion.p>
                )}
              </AnimatePresence>
              {longDesc && (
                <button
                  type="button"
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-1 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white/90"
                  aria-expanded={descExpanded}
                >
                  <span>{descExpanded ? "Ver menos" : "Ver más"}</span>
                  <svg
                    className={["h-3 w-3 transition-transform", descExpanded ? "rotate-180" : ""].join(" ")}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
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
                onClick={() =>
                  cartLineIdForItem &&
                  onChangeQty(
                    cartLineIdForItem,
                    Math.min(qtyInCartForItem + 1, Number.isFinite(maxAllowed) ? maxAllowed : qtyInCartForItem + 1)
                  )
                }
                disabled={!canInc}
                className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
              >
                +
              </button>

              {Number.isFinite(maxAllowed) ? (
                <div className="ml-auto text-xs text-white/60">Límite: {maxAllowed}</div>
              ) : null}
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
          <button
            type="button"
            onClick={() => setShowVariants((v) => !v)}
            className="w-full rounded-full bg-white/10 hover:bg-white/15 text-white py-2 font-semibold"
          >
            {showVariants ? "Ocultar opciones" : "Ver opciones"}
          </button>
        )}
      </div>

      {/* Variants list with smooth animation */}
      <AnimatePresence initial={false}>
        {hasVariants && showVariants && (
          <motion.div
            key="variants"
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: "auto", marginTop: 8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{
              duration: 0.2,
              ease: [0.16, 1, 0.3, 1],
              height: { duration: 0.25 }
            }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 pt-2">
              {(item.variants ?? [])
                .filter((v) => (v as any)?.isActive !== false)
                .map((variant) => {
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
