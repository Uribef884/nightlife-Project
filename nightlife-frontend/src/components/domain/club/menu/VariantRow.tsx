// src/components/domain/club/menu/VariantRow.tsx
"use client";

import { useMemo } from "react";
import type { MenuVariantDTO } from "@/services/menu.service";

function toNum(v: unknown): number | null {
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

export function VariantRow({
  variant,
  qtyInCart = 0,
  cartLineId = "",
  selectedDate,
  onAdd,
  onChangeQty,
}: {
  variant: MenuVariantDTO;
  qtyInCart?: number;
  cartLineId?: string;
  selectedDate?: string | null;
  onAdd: () => void;
  onChangeQty: (cartLineId: string, nextQty: number) => void;
}) {
  // Dynamic pricing logic - same as TicketCard
  const basePrice = toNum(variant.price);
  const dynamicPrice = toNum(variant.dynamicPrice);
  
  // Only show dynamic pricing if date is selected and valid
  const showDynamicPricing = selectedDate && variant.dynamicPricingEnabled;
  
  // Use dynamic price if available and enabled and date is valid, otherwise use base price
  const priceNow = (showDynamicPricing && dynamicPrice != null && !isNaN(dynamicPrice)) 
    ? dynamicPrice 
    : basePrice;
  
  // Show strike-through only when dynamic price is cheaper than base price and date is valid
  const compareAt = (showDynamicPricing && dynamicPrice != null && basePrice != null && dynamicPrice < basePrice) 
    ? basePrice 
    : null;
  const maxPerPerson = variant.maxPerPerson as number | null | undefined;

  const maxAllowed = useMemo(() => {
    const fromMax = maxPerPerson == null ? Infinity : Math.max(0, maxPerPerson);
    return fromMax;
  }, [maxPerPerson]);

  const canInc = qtyInCart < maxAllowed;
  const canDec = qtyInCart > 0;

  return (
    <div className="flex items-center gap-3 py-2 flex-wrap">
      <div className="flex-1 min-w-0">
        <div className="text-white/90 text-sm font-medium break-words leading-tight">{variant.name}</div>
        <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
          {compareAt && priceNow && compareAt > priceNow ? (
            <>
              <span className="text-white font-semibold text-sm">{fmt(priceNow)}</span>
              <span className="text-purple-400 text-xs line-through font-medium">{fmt(compareAt)}</span>
            </>
          ) : (
            <span className="text-white font-semibold text-sm">{fmt(priceNow)}</span>
          )}
        </div>
      </div>

      {/* Stepper */}
      {qtyInCart > 0 ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!canDec}
            onClick={() => cartLineId && onChangeQty(cartLineId, Math.max(0, qtyInCart - 1))}
            className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
          >
            −
          </button>
          <div className="min-w-[2rem] text-center text-white font-semibold">{qtyInCart}</div>
          <button
            type="button"
            disabled={!canInc}
            onClick={() =>
              cartLineId && onChangeQty(cartLineId, Math.min(qtyInCart + 1, Number.isFinite(maxAllowed) ? maxAllowed : qtyInCart + 1))
            }
            className="h-8 w-8 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-40"
          >
            +
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={selectedDate ? onAdd : undefined}
          disabled={!selectedDate}
          className={`rounded-full text-sm font-semibold px-3 py-1.5 shrink-0 ${
            selectedDate 
              ? "bg-green-600 hover:bg-green-500 text-white cursor-pointer" 
              : "bg-gray-500 text-gray-300 cursor-not-allowed"
          }`}
        >
          {selectedDate ? "Agregar" : "Selecciona fecha"}
        </button>
      )}
    </div>
  );
}
