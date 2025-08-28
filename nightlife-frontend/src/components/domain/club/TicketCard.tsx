// nightlife-frontend/src/components/domain/club/TicketCard.tsx
"use client";

/* eslint-disable no-console */

import { useMemo, useState } from "react";
import type { TicketDTO } from "@/services/clubs.service";

export type TicketCardProps = {
  ticket: TicketDTO;
  bannerUrl?: string | null;
  qtyInCart?: number;
  itemId?: string;
  onAdd: () => void;
  onChangeQty: (itemId: string, nextQty: number) => void;
  compact?: boolean;
  showDescription?: boolean;
  isFree?: boolean;
};

function toNum(v: unknown): number | null {
  const n = Number(v as any);
  return Number.isFinite(n) ? n : null;
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function getTitle(t: any): string {
  return t?.name ?? t?.title ?? "Ticket";
}
function getDescription(t: any): string {
  return t?.description ?? t?.details ?? t?.about ?? "";
}
function getPrice(t: any): { price: number | null; compareAt: number | null; currency: string } {
  const currency: string = (t?.currency as string) || "COP";
  const dynamic = toNum(t?.dynamicPrice);
  const base = toNum(t?.price);
  const price = (t?.dynamicPricingEnabled && dynamic != null ? dynamic : base) ?? null;
  const compareAt = null;
  return { price, compareAt, currency };
}
function getAvailable(t: any): number | null {
  if (isNum(t?.available)) return t.available;
  if (isNum(t?.remaining)) return t.remaining;
  if (isNum(t?.availableQty)) return t.availableQty;
  if (isNum(t?.availableQuantity)) return t.availableQuantity;
  if (isNum(t?.quantity)) return t.quantity;
  return null;
}
function getMaxPerUser(t: any): number | null {
  if (isNum(t?.maxPerPerson)) return t.maxPerPerson;
  if (isNum(t?.maxPerUser)) return t.maxPerUser;
  if (isNum(t?.max)) return t.max;
  return null;
}
function fmtMoney(n: number | null, currency = "COP"): string {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(n);
  } catch {
    return `$ ${n.toLocaleString("es-CO")}`;
  }
}

/** UI helpers to keep list lines tidy */
const MAX_LINE = 80; // characters before we ellipsis
function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}
function clampForDisplay(full: string, max = MAX_LINE) {
  const clean = normalizeSpaces(full);
  return clean.length > max ? { text: clean.slice(0, max - 1) + "…", tooltip: clean } : { text: clean, tooltip: clean };
}

/** Convert `includedMenuItems` (or fallbacks) into objects with display + tooltip */
function getIncludedLines(t: any): Array<{ text: string; tooltip: string }> {
  const raw =
    (Array.isArray(t?.includedMenuItems) && t.includedMenuItems) ||
    (Array.isArray(t?.includedItems) && t.includedItems) ||
    (Array.isArray(t?.includes) && t.includes) ||
    (Array.isArray(t?.menuItems) && t.menuItems) ||
    [];

  if (!Array.isArray(raw) || raw.length === 0) return [];

  const out: Array<{ text: string; tooltip: string }> = [];
  for (const it of raw) {
    const baseName =
      it?.menuItemName ?? it?.name ?? it?.title ?? it?.itemName ?? it?.menuItem?.name ?? "";
    if (!baseName) continue;

    const qty = toNum(it?.quantity) ?? toNum(it?.qty) ?? 1;
    const variant = it?.variantName ?? it?.variant?.name ?? null;

    const label = variant ? `${String(baseName)} (${String(variant)})` : String(baseName);
    const line = `${qty ?? 1}× ${label}`;
    out.push(clampForDisplay(line));
  }
  return out;
}

export default function TicketCard({
  ticket,
  bannerUrl = null,
  qtyInCart = 0,
  itemId = "",
  onAdd,
  onChangeQty,
  compact = true,
  showDescription = true,
  isFree = false,
}: TicketCardProps) {
  const title = getTitle(ticket);
  const desc = getDescription(ticket);
  const includes = getIncludedLines(ticket);
  const { price } = getPrice(ticket);
  const available = getAvailable(ticket);
  const maxPerUser = getMaxPerUser(ticket);
  const soldOut = available !== null && available <= 0;

  const maxAllowed = useMemo(() => {
    const fromAvail = available == null ? Infinity : Math.max(0, available);
    const fromMax = maxPerUser == null ? Infinity : Math.max(0, maxPerUser);
    return Math.min(fromAvail, fromMax);
  }, [available, maxPerUser]);

  const [expandedDesc, setExpandedDesc] = useState(false);
  const [showAllIncludes, setShowAllIncludes] = useState(false);
  const isLongDesc = useMemo(() => (desc?.length ?? 0) > 110, [desc]);

  const canInc = qtyInCart < maxAllowed;
  const canDec = qtyInCart > 0;

  return (
    <div
      className={[
        "rounded-xl border",
        isFree ? "border-yellow-400/50 bg-yellow-500/10" : "border-white/10 bg-white/5",
        compact ? "p-3" : "p-4",
        "w-full overflow-hidden",               // <- contain long content
      ].join(" ")}
    >
      {/* Header */}
      <div className="min-w-0">
        <div className={compact ? "text-[15px] font-semibold text-white" : "text-base font-semibold text-white"}>
          {title}
        </div>

        <div className="mt-1 flex items-baseline gap-2">
          <span className={compact ? "text-white text-[15px] font-bold" : "text-white text-lg font-bold"}>
            {fmtMoney(price, "COP")}
          </span>
        </div>

        {showDescription && desc && (
          <div className="mt-1 text-xs text-white/70 min-w-0">
            <div className={expandedDesc ? "" : "line-clamp-2"}>{desc}</div>
            {isLongDesc && (
              <button
                type="button"
                onClick={() => setExpandedDesc((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/60 hover:text-white/80"
              >
                {expandedDesc ? "Ver menos" : "Ver más"}
                <svg
                  className={`h-4 w-4 transition-transform ${expandedDesc ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M10 12.5l-5-5h10l-5 5z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Included menu items */}
      {includes.length > 0 && (
        <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 min-w-0 max-w-full">
          <div className="text-xs font-medium text-white/90 mb-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Incluye:
          </div>
          <ul className="space-y-1.5">
            {(showAllIncludes ? includes : includes.slice(0, 3)).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 min-w-0">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full flex-shrink-0 mt-2" />
                {/* 
                  break-all: wrap inside long unbroken strings (e.g., 'xxxxxxxx') 
                  min-w-0: allow child to actually shrink within flex container 
                  overflow-hidden + break-words: never spill outside card 
                */}
                <span
                  className="text-white/90 font-medium leading-relaxed break-all break-words whitespace-normal overflow-hidden"
                  title={item.tooltip}
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
          {includes.length > 3 && (
            <button
              type="button"
              className="mt-2 text-xs text-green-400 hover:text-green-300 font-medium transition-colors"
              onClick={() => setShowAllIncludes((v) => !v)}
            >
              {showAllIncludes ? "Ver menos" : `Ver todo (${includes.length})`}
            </button>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="mt-2 text-xs text-white/60">
        {maxPerUser != null && (
          <span>
            Máx: <span className="text-white/80">{maxPerUser}</span>
          </span>
        )}
      </div>

      {/* CTA / Stepper */}
      <div className="mt-3">
        {qtyInCart > 0 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => canDec && onChangeQty(itemId, qtyInCart - 1)}
              disabled={!canDec}
              className={[
                "h-9 w-9 rounded-full font-bold",
                canDec ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/5 text-white/40 cursor-not-allowed",
              ].join(" ")}
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <div className="min-w-[2.25rem] text-center text-sm text-white/90">{qtyInCart}</div>
            <button
              type="button"
              onClick={() => canInc && onChangeQty(itemId, qtyInCart + 1)}
              disabled={!canInc}
              className={[
                "h-9 w-9 rounded-full font-bold",
                canInc ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white/5 text-white/40 cursor-not-allowed",
              ].join(" ")}
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onAdd()}
            disabled={soldOut}
            className={[
              "w-full rounded-full py-2 font-semibold",
              soldOut
                ? "bg-white/10 text-white/60 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-500 text-white",
            ].join(" ")}
          >
            {soldOut ? "Agotado" : "Agregar al carrito"}
          </button>
        )}
      </div>
    </div>
  );
}
