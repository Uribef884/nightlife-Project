// src/components/domain/club/ClubCalendar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/** ---------- Small date helpers ---------- */
function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}
function chunkWeeks<T>(cells: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}
function findWeekIndex(weeks: DayCell[][], focusISO: string): number {
  if (!focusISO) return 0;
  return Math.max(
    0,
    weeks.findIndex((row) => row.some((c) => !!c.iso && c.iso === focusISO))
  );
}

const WEEK_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type DayCell = {
  iso: string; // "" for leading blanks
  disabled: boolean; // past days
  kind: "event" | "open" | "free" | null; // status badge
  isToday: boolean;
};

export function ClubCalendar({
  monthOffset = 0,
  eventDates,
  freeDates,
  openDays,
  selectedDate,
  onSelect,
}: {
  monthOffset?: number;
  eventDates: Set<string>;
  freeDates: Set<string>;
  openDays: Set<string>; // lowercased full names: sunday..saturday
  selectedDate: string | null;
  onSelect: (iso: string) => void;
}) {
  /** Stabilize "today" so we don't churn state on each render */
  const todayISO = useMemo(() => toISO(new Date()), []);
  const today = useMemo(() => parseISO(todayISO), [todayISO]);

  /** Single source of truth for the calendar view */
  const [focusISO, setFocusISO] = useState<string>(selectedDate ?? todayISO);
  const focusRef = useRef(focusISO);
  useEffect(() => {
    focusRef.current = focusISO;
  }, [focusISO]);

  /** Only remaining effect: parent selectedDate → focusISO (guarded, single dep) */
  useEffect(() => {
    if (selectedDate && selectedDate !== focusRef.current) {
      setFocusISO(selectedDate);
    }
  }, [selectedDate]);

  /** Collapsed = single-line week view (default) */
  const [collapsed, setCollapsed] = useState<boolean>(true);

  /** ===== Derived month (no `cursor` state at all) =====
   * We derive the *visible month start* from focusISO + monthOffset.
   * That means there is no cursor↔focus ping-pong anymore.
   */
  const visibleMonthStart = useMemo(() => {
    const base = parseISO(focusISO || todayISO);
    const v = addMonths(new Date(base.getFullYear(), base.getMonth(), 1), monthOffset);
    return new Date(v.getFullYear(), v.getMonth(), 1);
  }, [focusISO, monthOffset, todayISO]);
  
  /** Build month cells (with leading blanks) */
  const meta = useMemo(() => {
    const y = visibleMonthStart.getFullYear();
    const m = visibleMonthStart.getMonth();

    const firstDow = new Date(y, m, 1).getDay(); // 0..6
    const total = daysInMonth(y, m);

    const cells: DayCell[] = [];

    // Leading blanks so the first row aligns by weekday
    for (let i = 0; i < firstDow; i++) {
      cells.push({ iso: "", disabled: true, kind: null, isToday: false });
    }

    // Real days
    for (let d = 1; d <= total; d++) {
      const date = new Date(y, m, d);
      const iso = toISO(date);

      // Disable past dates (based on local midnight)
      const inPast =
        date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = iso === todayISO;

      // openDays contains full weekday names in lowercase
      const weekdayFull = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][date.getDay()];

      // Priority: event > free > open (selection handled later)
      let kind: "event" | "open" | "free" | null = null;
      if (eventDates.has(iso)) kind = "event";
      else if (freeDates.has(iso)) kind = "free";
      else if (openDays.has(weekdayFull)) kind = "open";

      cells.push({ iso, disabled: inPast, kind, isToday });
    }

    return { y, m, cells };
  }, [visibleMonthStart, eventDates, freeDates, openDays, today, todayISO]);

  const weeks = useMemo(() => chunkWeeks(meta.cells), [meta.cells]);

  /** Utilities for arrow clicks */
  function monthFirstISO(year: number, monthIndex: number) {
    return `${year}-${pad(monthIndex + 1)}-01`;
  }
  function computeAnchoredFocus(target: Date) {
    // Prefer selectedDate if it falls into target month; otherwise first of month
    const y = target.getFullYear();
    const m = target.getMonth();

    if (selectedDate) {
      const s = parseISO(selectedDate);
      if (s.getFullYear() === y && s.getMonth() === m) return selectedDate;
    }
    return monthFirstISO(y, m);
  }

  /** Render a single day button */
  function renderDay(c: DayCell, i: number) {
    const isSelected = c.iso && selectedDate === c.iso;
    const isToday = c.isToday;

    // Background priority
    let bg = "bg-white/10";
    if (c.disabled) {
      bg = "bg-white/5"; // past -> dim
    } else if (isSelected) {
      bg = "bg-[#7A48D3]"; // selection always wins
    } else if (c.kind === "event") {
      bg = "bg-red-500/20";
    } else if (c.kind === "free") {
      bg = "bg-yellow-500/20";
    } else if (c.kind === "open") {
      bg = "bg-blue-500/20";
    } else if (isToday) {
      // Only apply "today" tint if no other status matched
      bg = "bg-[#7A48D3]/50";
    }

    const ring = isSelected ? "ring-2 ring-[#7A48D3]" : "ring-1 ring-white/5";
    const textColor = "text-white/90";

    return (
      <button
        key={c.iso ? c.iso : `blank-${i}`}
        disabled={!c.iso || c.disabled}
        onClick={() => {
          if (!c.iso) return;
          onSelect(c.iso);
          if (c.iso !== focusRef.current) setFocusISO(c.iso); // keep the strip anchored to the chosen day
        }}
        className={`${
          collapsed ? "min-h-[44px] h-11" : "aspect-square"
        } rounded-lg ${bg} ${ring} ${textColor} text-sm flex items-center justify-center font-medium`}
        title={c.iso || ""}
      >
        {c.iso ? Number(c.iso.slice(-2)) : ""}
      </button>
    );
  }

  /** -------- Render -------- */
  return (
    <div className="w-full">
      {/* Header: month arrows + label + Semana/Mes toggle */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // New: arrows set focus directly to previous month's anchored day
              const prevMonth = addMonths(visibleMonthStart, -1);
              const desired = computeAnchoredFocus(prevMonth);
              if (desired !== focusRef.current) setFocusISO(desired);
            }}
            className="rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-white"
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <button
            onClick={() => {
              // New: arrows set focus directly to next month's anchored day
              const nextMonth = addMonths(visibleMonthStart, 1);
              const desired = computeAnchoredFocus(nextMonth);
              if (desired !== focusRef.current) setFocusISO(desired);
            }}
            className="rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-white"
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <div className="text-white font-semibold select-none">
          {visibleMonthStart.toLocaleString("es-CO", {
            month: "long",
            year: "numeric",
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-white"
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expandir a mes completo" : "Mostrar solo semana"}
            title={collapsed ? "Expandir a mes completo" : "Mostrar solo semana"}
          >
            {collapsed ? "Mes ▾" : "Semana ▴"}
          </button>
        </div>
      </div>

      {/* Weekday header (always one line) */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-white/60 mb-1">
        {WEEK_ES.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Body: either full month grid or single-week strip */}
      {!collapsed ? (
        // Full month grid for the derived month
        <div className="grid grid-cols-7 gap-1">
          {meta.cells.map((c, i) => renderDay(c, i))}
        </div>
      ) : (
        // Collapsed: show the week containing focusISO
        (() => {
          const weeks = chunkWeeks(meta.cells);
          const idx = findWeekIndex(weeks as DayCell[][], focusISO);
          const row = (weeks[idx] ?? weeks[0] ?? []) as DayCell[];
          return (
            <div className="grid grid-cols-7 gap-1">
              {row.map((c, i) => renderDay(c, i))}
            </div>
          );
        })()
      )}

      {/* Legend: always visible */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/70">
        <Legend color="bg-red-500/50" label="Eventos" />
        <Legend color="bg-blue-500/50" label="Días abiertos" />
        <Legend color="bg-yellow-500/50" label="Días con entradas gratis" />
        <Legend color="bg-[#7A48D3]/50" label="Día actual" />
        <Legend color="bg-[#7A48D3]" label="Fecha seleccionada" />
      </div>
    </div>
  );
}

/** Simple legend pill */
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
      <span>{label}</span>
    </div>
  );
}
