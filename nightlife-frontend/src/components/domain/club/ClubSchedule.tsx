// src/components/domain/club/ClubSchedule.tsx
"use client";

/**
 * Compact weekly schedule card.
 * - Shows all 7 days (Lun → Dom) with hours.
 * - If a day is in openHours: show ranges (e.g., 18:00 – 02:00).
 * - Else if in openDays: show "Abierto".
 * - Else: "Cerrado".
 * - Today's row is subtly highlighted.
 */

type HoursItem = { day: string; open: string; close: string };

type Props = {
  openDays?: string[] | null;
  openHours?: HoursItem[] | null;
};

const DAYS_EN: Array<
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
> = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const DAY_LABEL_ES: Record<(typeof DAYS_EN)[number], string> = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mié",
  thursday: "Jue",
  friday: "Vie",
  saturday: "Sáb",
  sunday: "Dom",
};

function normDay(s?: string) {
  return (s ?? "").trim().toLowerCase();
}

function jsTodayEn(): (typeof DAYS_EN)[number] {
  const idx = new Date().getDay(); // 0 = Sun, 6 = Sat
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
    idx
  ] as any;
}

function toHoursMap(items: HoursItem[] | null | undefined) {
  const map: Record<string, Array<{ open: string; close: string }>> = {};
  if (!items) return map;
  for (const it of items) {
    const d = normDay(it?.day);
    if (!d) continue;
    (map[d] ||= []).push({ open: it.open, close: it.close });
  }
  return map;
}

export function ClubSchedule({ openDays, openHours }: Props) {
  const openSet = new Set((openDays ?? []).map(normDay));
  const hoursMap = toHoursMap(openHours);
  const today = jsTodayEn();

  const hasAny =
    (openDays && openDays.length > 0) ||
    (openHours && openHours.length > 0);

  // Compact card wrapper — small type/spacing
  return (
    <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 p-3">
      <div className="text-white font-semibold text-sm mb-2">Horario</div>

      {!hasAny ? (
        <p className="text-white/60 text-xs">Sin horario disponible.</p>
      ) : (
        <div className="space-y-1">
          {DAYS_EN.map((d) => {
            const ranges = hoursMap[d];
            const isOpenByHours = Array.isArray(ranges) && ranges.length > 0;
            const isOpenByDay = openSet.has(d);

            let display = "Cerrado";
            if (isOpenByHours) {
              display = ranges.map((r) => `${r.open} – ${r.close}`).join(", ");
            } else if (isOpenByDay) {
              display = "Abierto";
            }

            const isToday = d === today;

            return (
              <div
                key={d}
                className={[
                  "grid grid-cols-[3.5rem,1fr] items-center gap-2 rounded-lg px-2 py-1",
                  isToday ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-white/[0.02]",
                ].join(" ")}
              >
                <div className="text-white/75 text-xs">{DAY_LABEL_ES[d]}</div>
                <div className="text-white/90 text-xs">{display}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClubSchedule;
