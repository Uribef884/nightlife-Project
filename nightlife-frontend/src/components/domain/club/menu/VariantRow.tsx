// src/components/domain/club/menu/VariantRow.tsx
"use client";

import { useMemo } from "react";
import type { MenuVariantDTO } from "@/services/menu.service";

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

export function VariantRow({
  variant,
  qtyInCart = 0,
  cartLineId = "",
  onAdd,
  onChangeQty,
}: {
  variant: MenuVariantDTO;
  qtyInCart?: number;
  cartLineId?: string;
  onAdd: () => void;
  onChangeQty: (cartLineId: string, nextQty: number) => void;
}) {
  const priceNow = toNum((variant as any)?.price);
  // Optional: if backend provides a compareAt-original price, we'll show slash
  const compareAt =
    toNum((variant as any)?.compareAtPrice) ??
    toNum((variant as any)?.originalPrice) ??
    null;
  const maxPerPerson = (variant as any)?.maxPerPerson as number | null | undefined;

  const maxAllowed = useMemo(() => {
    const fromMax = maxPerPerson == null ? Infinity : Math.max(0, maxPerPerson);
    return fromMax;
  }, [maxPerPerson]);

  const canInc = qtyInCart < maxAllowed;
  const canDec = qtyInCart > 0;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-white/90 text-sm font-medium truncate">{(variant as any).name}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          {compareAt != null && priceNow != null && compareAt > priceNow ? (
            <span className="text-white/40 line-through text-xs">{fmt(compareAt)}</span>
          ) : null}
          <span className="text-white font-semibold text-sm">{fmt(priceNow)}</span>
        </div>
      </div>

      {/* Stepper */}
      {qtyInCart > 0 ? (
        <div className="flex items-center gap-2">
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
          onClick={onAdd}
          className="rounded-full bg-green-600 hover:bg-green-500 text-white text-sm font-semibold px-3 py-1.5"
        >
          Agregar
        </button>
      )}
    </div>
  );
}
