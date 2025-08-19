// src/components/domain/club/ClubCalendar.tsx
"use client";
import { useMemo, useState } from "react";

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}
function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISO(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
const WEEK = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEK_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

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
  openDays: Set<string>; // lowercased names (e.g., "friday")
  selectedDate: string | null;
  onSelect: (iso: string) => void;
}) {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const [cursor, setCursor] = useState<Date>(base);

  const meta = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const firstDow = new Date(y, m, 1).getDay(); // 0..6
    const total = daysInMonth(y, m);
    const cells: { iso: string; disabled: boolean; kind: "event" | "open" | "free" | null }[] = [];
    // Fill leading blanks
    for (let i=0; i<firstDow; i++) cells.push({ iso: "", disabled: true, kind: null });
    // Fill days
    for (let d=1; d<=total; d++) {
      const date = new Date(y, m, d);
      const iso = toISO(date);
      const inPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const dowName = WEEK[date.getDay()].toLowerCase(); // sun..sat
      // Map to full names used by openDays: convert "sun" -> "sunday" etc.
      const full = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][date.getDay()];
      let kind: "event" | "open" | "free" | null = null;

      if (eventDates.has(iso)) kind = "event";
      else if (freeDates.has(iso)) kind = "free";
      else if (openDays.has(full)) kind = "open";

      const disabled = inPast;
      cells.push({ iso, disabled, kind });
    }
    return { y: cursor.getFullYear(), m: cursor.getMonth(), cells };
  }, [cursor, eventDates, freeDates, openDays]);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-white"
        >
          ‹
        </button>
        <div className="text-white font-semibold">
          {cursor.toLocaleString("es-CO", { month: "long", year: "numeric" })}
        </div>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="rounded-md bg-white/10 hover:bg-white/15 px-2 py-1 text-white"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-white/60 mb-1">
        {WEEK_ES.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      {/* Responsive month grid */}
      <div className="grid grid-cols-7 gap-1">
        {meta.cells.map((c, i) => {
          const isSelected = c.iso && selectedDate === c.iso;
          const bg =
            c.disabled ? "bg-white/5" :
            c.kind === "event" ? "bg-red-500/20" :
            c.kind === "free" ? "bg-yellow-500/20" :
            c.kind === "open" ? "bg-blue-500/20" :
            "bg-white/10";
          const ring = isSelected ? "ring-2 ring-[#7A48D3]" : "ring-1 ring-white/5";
          return (
            <button
              key={i}
              disabled={!c.iso || c.disabled}
              onClick={() => c.iso && onSelect(c.iso)}
              className={`aspect-square rounded-lg ${bg} ${ring} text-white/90 text-sm flex items-center justify-center`}
            >
              {c.iso ? Number(c.iso.slice(-2)) : ""}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/70">
        <Legend color="bg-red-500/50" label="Eventos" />
        <Legend color="bg-blue-500/50" label="Días abiertos" />
        <Legend color="bg-yellow-500/50" label="Días con entradas gratis" />
        <Legend color="bg-[#7A48D3]/70" label="Fecha seleccionada" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className={`inline-block w-3 h-3 rounded-sm ${color}`} />
      <span>{label}</span>
    </div>
  );
}
