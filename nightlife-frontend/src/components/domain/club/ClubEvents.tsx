// src/components/domain/club/ClubEvents.tsx
"use client";
import Image from "next/image";
import { formatDateShort } from "@/lib/formatters";

export type EventCardDTO = {
  id: string;
  name: string;
  description?: string | null;
  availableDate: string; // YYYY-MM-DD
  bannerUrl?: string | null;
};

export function ClubEvents({
  events,
  onChooseDate,
}: {
  events: EventCardDTO[];
  onChooseDate: (dateISO: string) => void;
}) {
  if (!events || events.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
      <h3 className="text-white font-semibold mb-3">Próximos eventos</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {events.map((ev) => (
          <div key={ev.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="relative h-40 w-full">
              {ev.bannerUrl ? <Image src={ev.bannerUrl} alt={ev.name} fill className="object-cover" /> : <div className="h-full w-full bg-white/10" />}
            </div>
            <div className="p-3">
              <div className="text-white font-semibold">{ev.name}</div>
              <div className="text-xs text-white/70">{formatDateShort(ev.availableDate)}</div>
              <button
                onClick={() => onChooseDate(ev.availableDate)}
                className="mt-3 w-full rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white py-2 text-sm font-semibold"
              >
                Elegir fecha
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
