// src/components/domain/club/ClubCalendar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  todayInBogota,
  parseBogotaDate,
  isPastDateInBogota,
  isDateSelectableInBogota,
  startOfDayInBogota,
} from "@/utils/timezone";

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
// Removed unused functions: chunkWeeks and findWeekIndex

/** NOTE: We use Sunday-start weeks visually */
const WEEK_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type DayCell = {
  iso: string; // "" for leading blanks (month grid only)
  disabled: boolean; // past days and dates more than 3 weeks in the future
  kind: "event" | "open" | "free" | null; // status badge
  isToday: boolean;
};

/* ===================== BOGOTÁ-AWARE HELPERS (INLINE) ===================== */
/**
 * Returns the 7 ISO dates (Sunday → Saturday) for the week that contains the given anchor date,
 * computed in BOGOTÁ time using Luxon (via our helpers).
 *
 * Luxon weekday: Monday=1 ... Sunday=7  → daysBack = weekday % 7 makes Sun(7)→0, Mon(1)→1, etc.
 */
function getWeekDatesISOInBogota(anchorISO: string): string[] {
  const anchorDt = parseBogotaDate(anchorISO); // Luxon DateTime in America/Bogota at start of day
  const daysBack = anchorDt.weekday % 7;
  const weekStart = anchorDt.minus({ days: daysBack });

  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    out.push(weekStart.plus({ days: i }).toISODate()!); // YYYY-MM-DD
  }
  return out;
}

/** True if any day in the week is selectable OR an event is on any day in the list. */
function weekHasSelectableOrEvent(weekISOList: string[], eventDates: Set<string>): boolean {
  for (const dayISO of weekISOList) {
    if (isDateSelectableInBogota(dayISO)) return true;
    if (eventDates.has(dayISO)) return true;
  }
  return false;
}

/**
 * Checks a month and returns true if ANY day is selectable or there is at least one event in that month.
 * `anyISOInMonth` should be any ISO inside the target month (usually the 1st).
 */
function monthHasSelectableOrEvent(anyISOInMonth: string, eventDates: Set<string>): boolean {
  const anyDate = parseISO(anyISOInMonth);
  const y = anyDate.getFullYear();
  const m = anyDate.getMonth();
  const total = daysInMonth(y, m);

  const monthPrefix = `${y}-${pad(m + 1)}-`;
  for (const e of eventDates) {
    if (e.startsWith(monthPrefix)) return true;
  }

  for (let d = 1; d <= total; d++) {
    const iso = `${y}-${pad(m + 1)}-${pad(d)}`;
    if (isDateSelectableInBogota(iso)) return true;
  }
  return false;
}

/** Build a DayCell for a specific ISO date (used in collapsed/week mode rendering). */
function buildDayCellForISO(
  iso: string,
  opts: {
    todayISO: string;
    eventDates: Set<string>;
    freeDates: Set<string>;
    openDays: Set<string>; // sunday..saturday
  }
): DayCell {
  const { todayISO, eventDates, freeDates, openDays } = opts;
  const d = parseISO(iso);

  const isPast = isPastDateInBogota(iso);
  const isTooFarFuture = !isDateSelectableInBogota(iso);
  const disabled = isPast || isTooFarFuture;
  const isToday = iso === todayISO;

  const weekdayFull = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][d.getDay()];

  let kind: "event" | "open" | "free" | null = null;
  if (eventDates.has(iso)) kind = "event";
  else if (freeDates.has(iso)) kind = "free";
  else if (openDays.has(weekdayFull)) kind = "open";

  return { iso, disabled, kind, isToday };
}

/** Format week header like "28 sep – 4 oct 2025" when collapsed=true */
function formatWeekHeaderES(weekISOs: string[]): string {
  const start = parseISO(weekISOs[0]);
  const end = parseISO(weekISOs[6]);

  const monthNames = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];

  const startStr = `${start.getDate()} ${monthNames[start.getMonth()]}`;
  const endStr = `${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;

  return `${startStr} – ${endStr}`;
}
/* ============================================================================ */

export function ClubCalendar({
  monthOffset = 0,
  eventDates,
  freeDates,
  openDays,
  selectedDate,
  onSelect,
  hasCartItems = false,
  onDateChangeBlocked,
}: {
  monthOffset?: number;
  eventDates: Set<string>;
  freeDates: Set<string>;
  openDays: Set<string>; // lowercased full names: sunday..saturday
  selectedDate: string | null;
  onSelect: (iso: string) => void;
  hasCartItems?: boolean;
  onDateChangeBlocked?: (desiredDate?: string) => void;
}) {
  /** Stabilize "today" so we don't churn state on each render */
  const todayISO = useMemo(() => todayInBogota(), []);
  const today = useMemo(() => parseBogotaDate(todayISO), [todayISO]);

  /** Single source of truth for the calendar view */
  const [focusISO, setFocusISO] = useState<string>(selectedDate ?? todayISO);
  const focusRef = useRef(focusISO);
  useEffect(() => {
    focusRef.current = focusISO;
  }, [focusISO]);

  /** Parent selectedDate → focusISO */
  useEffect(() => {
    if (selectedDate && selectedDate !== focusRef.current) {
      setFocusISO(selectedDate);
    }
  }, [selectedDate]);

  /** Collapsed = single-line week view (default) */
  const [collapsed, setCollapsed] = useState<boolean>(true);

  /** ===== Derived month (for MONTH GRID ONLY) =====
   * Never allow navigation to past months.
   */
  const visibleMonthStart = useMemo(() => {
    const base = parseISO(focusISO || todayISO);
    const v = addMonths(new Date(base.getFullYear(), base.getMonth(), 1), monthOffset);
    const requestedMonth = new Date(v.getFullYear(), v.getMonth(), 1);

    const currentMonth = new Date(today.year, today.month - 1, 1); // Luxon months are 1-based
    return requestedMonth < currentMonth ? currentMonth : requestedMonth;
  }, [focusISO, monthOffset, todayISO, today]);

  /** Build month cells (with leading blanks) — used ONLY in month (expanded) view */
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

      const isPast = isPastDateInBogota(iso);
      const isTooFarFuture = !isDateSelectableInBogota(iso);
      const inPast = isPast || isTooFarFuture;
      const isToday = iso === todayISO;

      const weekdayFull = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ][date.getDay()];

      let kind: "event" | "open" | "free" | null = null;
      if (eventDates.has(iso)) kind = "event";
      else if (freeDates.has(iso)) kind = "free";
      else if (openDays.has(weekdayFull)) kind = "open";

      cells.push({ iso, disabled: inPast, kind, isToday });
    }

    return { y, m, cells };
  }, [visibleMonthStart, eventDates, freeDates, openDays, todayISO]);

  /** Utilities for arrow clicks */
  function monthFirstISO(year: number, monthIndex: number) {
    return `${year}-${pad(monthIndex + 1)}-01`;
  }
  function computeAnchoredFocus(target: Date) {
    const currentMonth = new Date(today.year, today.month - 1, 1);
    const targetMonth = new Date(target.getFullYear(), target.getMonth(), 1);
    const actualTarget = targetMonth < currentMonth ? currentMonth : target;
    const y = actualTarget.getFullYear();
    const m = actualTarget.getMonth();

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
      bg = "bg-white/5"; // past or too far -> dim
    } else if (isSelected) {
      bg = "bg-[#7A48D3]";
    } else if (c.kind === "event") {
      bg = "bg-red-500/20";
    } else if (c.kind === "free") {
      bg = "bg-yellow-500/20";
    } else if (c.kind === "open") {
      bg = "bg-blue-500/20";
    } else if (isToday) {
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

          if (hasCartItems && c.iso !== selectedDate) {
            onDateChangeBlocked?.(c.iso);
            return;
          }

          onSelect(c.iso);
          if (c.iso !== focusRef.current) setFocusISO(c.iso);
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
  const collapsedWeekISOs = collapsed ? getWeekDatesISOInBogota(focusISO) : null;
  const collapsedWeekHeader = collapsed && collapsedWeekISOs
    ? formatWeekHeaderES(collapsedWeekISOs)
    : null;

  return (
    <div className="w-full">
      {/* Header: arrows + dynamic label + Semana/Mes toggle */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2">
          {/* PREVIOUS (WEEK / MONTH) */}
          <button
            onClick={() => {
              if (collapsed) {
                const focusWeekStartISO = getWeekDatesISOInBogota(focusISO)[0];
                const todayWeekStartISO = getWeekDatesISOInBogota(todayISO)[0];
                if (focusWeekStartISO > todayWeekStartISO) {
                  const prevAnchorISO = parseBogotaDate(focusISO).minus({ days: 7 }).toISODate()!;
                  setFocusISO(prevAnchorISO);
                }
              } else {
                const currentMonth = new Date(today.year, today.month - 1, 1);
                if (visibleMonthStart.getTime() <= currentMonth.getTime()) return;
                const prevMonth = addMonths(visibleMonthStart, -1);
                const desired = computeAnchoredFocus(prevMonth);
                if (desired !== focusRef.current) setFocusISO(desired);
              }
            }}
            disabled={
              collapsed
                ? (() => {
                    const focusWeekStartISO = getWeekDatesISOInBogota(focusISO)[0];
                    const todayWeekStartISO = getWeekDatesISOInBogota(todayISO)[0];
                    return focusWeekStartISO <= todayWeekStartISO;
                  })()
                : (() => {
                    const todayDate = startOfDayInBogota(todayISO);
                    const currentMonthStart = new Date(
                      todayDate.year,
                      todayDate.month - 1,
                      1
                    );
                    return visibleMonthStart.getTime() <= currentMonthStart.getTime();
                  })()
            }
            className="rounded-md bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:cursor-not-allowed px-2 py-1 text-white disabled:text-white/50"
            aria-label={collapsed ? "Semana anterior" : "Mes anterior"}
          >
            ‹
          </button>

          {/* NEXT (WEEK / MONTH) */}
          <button
            onClick={() => {
              if (collapsed) {
                const nextAnchorISO = parseBogotaDate(focusISO).plus({ days: 7 }).toISODate()!;
                const nextWeekDates = getWeekDatesISOInBogota(nextAnchorISO);
                if (weekHasSelectableOrEvent(nextWeekDates, eventDates)) {
                  setFocusISO(nextAnchorISO);
                }
              } else {
                const nextMonth = addMonths(visibleMonthStart, 1);
                const nextMonthISO = toISO(nextMonth);
                if (monthHasSelectableOrEvent(nextMonthISO, eventDates)) {
                  const desired = computeAnchoredFocus(nextMonth);
                  if (desired !== focusRef.current) setFocusISO(desired);
                }
              }
            }}
            disabled={
              collapsed
                ? (() => {
                    const nextAnchorISO = parseBogotaDate(focusISO).plus({ days: 7 }).toISODate()!;
                    const nextWeekDates = getWeekDatesISOInBogota(nextAnchorISO);
                    return !weekHasSelectableOrEvent(nextWeekDates, eventDates);
                  })()
                : (() => {
                    const nextMonth = addMonths(visibleMonthStart, 1);
                    const nextMonthISO = toISO(nextMonth);
                    return !monthHasSelectableOrEvent(nextMonthISO, eventDates);
                  })()
            }
            className="rounded-md bg-white/10 hover:bg-white/15 disabled:bg-white/5 disabled:cursor-not-allowed px-2 py-1 text-white disabled:text-white/50"
            aria-label={collapsed ? "Semana siguiente" : "Mes siguiente"}
          >
            ›
          </button>
        </div>

        {/* Header label:
            - Collapsed: show week range (e.g., "28 sep – 4 oct 2025")
            - Month: show "octubre de 2025" as before
        */}
        <div className="text-white font-semibold select-none">
          {collapsed && collapsedWeekHeader
            ? collapsedWeekHeader
            : visibleMonthStart.toLocaleString("es-CO", {
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

      {/* Body */}
      {!collapsed ? (
        // FULL MONTH GRID (unchanged behavior)
        <div className="grid grid-cols-7 gap-1">
          {meta.cells.map((c, i) => renderDay(c, i))}
        </div>
      ) : (
        // COLLAPSED: RENDER THE ACTUAL WEEK (Sun→Sat) EVEN IF IT CROSSES MONTHS
        (() => {
          const weekISOs = getWeekDatesISOInBogota(focusISO);
          const row: DayCell[] = weekISOs.map((iso) =>
            buildDayCellForISO(iso, { todayISO, eventDates, freeDates, openDays })
          );
          return (
            <div className="grid grid-cols-7 gap-1">
              {row.map((c, i) => renderDay(c, i))}
            </div>
          );
        })()
      )}

      {/* Legend */}
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
