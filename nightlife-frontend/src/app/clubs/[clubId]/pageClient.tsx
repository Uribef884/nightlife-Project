// src/app/clubs/[clubId]/pageClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ClubTabs } from "@/components/domain/club/ClubTabs";
import { ClubHeader } from "@/components/domain/club/ClubHeader";
import { ClubAdsCarousel } from "@/components/domain/club/ClubAdsCarousel";
import { ClubSocials } from "@/components/domain/club/ClubSocials";
import { MapGoogle } from "@/components/domain/club/MapGoogle.client";
import { ClubCalendar } from "@/components/domain/club/ClubCalendar";
import { ClubEvents } from "@/components/domain/club/ClubEvents";
import { TicketsGrid } from "@/components/domain/club/TicketsGrid";
import { formatDayLong } from "@/lib/formatters";
import {
  getClubAdsCSR,
  getClubByIdCSR,
  getEventsForClubCSR,
  getTicketsForClubCSR,
  type ClubDTO,
  type EventDTO,
  type TicketDTO,
  type ClubAdDTO,
} from "@/services/clubs.service";

type Props = {
  clubId: string;
  clubSSR: ClubDTO;
};

type TabKey = "general" | "reservas" | "carta";

export default function ClubPageClient({ clubId, clubSSR }: Props) {
  // ✨ Always start with "general" so SSR HTML == first client render HTML.
  const [tab, setTab] = useState<TabKey>("general");

  const [club, setClub] = useState<ClubDTO>(clubSSR);
  const [ads, setAds] = useState<ClubAdDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // YYYY-MM-DD

  // After mount, read hash once and subscribe to changes.
  useEffect(() => {
    const readHash = () => {
      const raw = window.location.hash?.replace("#", "");
      if (raw === "general" || raw === "reservas" || raw === "carta") {
        setTab(raw);
        // When user navigates tabs, UX: scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    readHash(); // initial
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const setTabAndHash = (t: TabKey) => {
    // Update hash (triggers readHash listener as well)
    window.location.hash = t;
  };

  // CSR data
  useEffect(() => {
    getClubByIdCSR(clubId).then((c) => c && setClub(c)).catch(() => {});
    getClubAdsCSR(clubId).then(setAds).catch(() => {});
    getEventsForClubCSR(clubId).then(setEvents).catch(() => {});
    getTicketsForClubCSR(clubId).then(setTickets).catch(() => {});
  }, [clubId]);

  // Safety: coerce arrays
  const safeEvents: EventDTO[] = Array.isArray(events) ? events : [];
  const safeTickets: TicketDTO[] = Array.isArray(tickets) ? tickets : [];

  // Calendar: event dates
  const eventDates = useMemo(() => {
    return new Set<string>(safeEvents.map((e) => e.availableDate));
  }, [safeEvents]);

  // Calendar: free dates (any ticket with effective price 0), minus event dates so event color wins
  const freeDates = useMemo(() => {
    const s = new Set<string>();
    for (const t of safeTickets) {
      const date = t?.availableDate;
      if (!date) continue;
      const eff = Number(t.dynamicPrice ?? t.price);
      if (Number.isFinite(eff) && eff === 0) s.add(date);
    }
    for (const d of eventDates) s.delete(d);
    return s;
  }, [safeTickets, eventDates]);

  const openDays = useMemo(
    () => new Set((club.openDays || []).map((d: string) => d.toLowerCase())),
    [club]
  );

  // If user lands on "reservas" with no selection, auto-pick first event date
  useEffect(() => {
    if (tab === "reservas" && !selectedDate) {
      if (safeEvents.length > 0) setSelectedDate(safeEvents[0].availableDate);
    }
  }, [tab, selectedDate, safeEvents]);

  // Tickets embedded in the selected event (if backend provided them in /events/club/:id)
  const selectedEventTickets = useMemo<TicketDTO[] | undefined>(() => {
    if (!selectedDate) return undefined;
    const ev = safeEvents.find((e) => e.availableDate === selectedDate);
    return ev?.tickets && Array.isArray(ev.tickets) ? ev.tickets : undefined;
  }, [safeEvents, selectedDate]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="sticky top-0 z-10 bg-[#0B0F1A]/80 backdrop-blur rounded-b-xl">
        <ClubTabs current={tab} onChange={setTabAndHash} />
      </div>

      {/* GENERAL */}
      {tab === "general" && (
        <section className="space-y-6">
          <ClubHeader club={club} onReservarClick={() => setTabAndHash("reservas")} />
          <ClubAdsCarousel ads={ads} />
          <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
            <h3 className="text-white font-semibold mb-2">¿Cómo llegar?</h3>
            <MapGoogle
              latitude={club.latitude}
              longitude={club.longitude}
              googleMapsUrl={club.googleMaps}
              name={club.name}
            />
          </div>
          <ClubSocials instagram={club.instagram} whatsapp={club.whatsapp} />
          <div className="pt-2">
            <button
              onClick={() => setTabAndHash("reservas")}
              className="w-full rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white py-3 font-semibold shadow"
            >
              Reservar
            </button>
          </div>
        </section>
      )}

      {/* RESERVAS */}
      {tab === "reservas" && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
            <h3 className="text-white font-semibold mb-3">Selecciona la fecha</h3>
            <ClubCalendar
              monthOffset={0}
              eventDates={eventDates}
              freeDates={freeDates}
              openDays={openDays}
              onSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
            {selectedDate && (
              <p className="mt-3 text-sm text-white/70">
                Fecha seleccionada: <span className="font-semibold">{formatDayLong(selectedDate)}</span>
              </p>
            )}
          </div>

          <ClubEvents
            events={safeEvents}
            onChooseDate={(d) => {
              setSelectedDate(d);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />

          <TicketsGrid
            club={club}
            selectedDate={selectedDate}
            events={safeEvents}
            tickets={safeTickets}
            selectedEventTickets={selectedEventTickets}
          />
        </section>
      )}

      {/* CARTA */}
      {tab === "carta" && (
        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
            <h3 className="text-white font-semibold mb-2">Carta</h3>
            {club.menuType === "pdf" && club.pdfMenuUrl ? (
              <iframe
                src={club.pdfMenuUrl}
                className="w-full h-[70vh] rounded-xl bg-black"
                title={club.pdfMenuName ?? "Menú"}
              />
            ) : club.menuType === "structured" ? (
              <p className="text-white/80">
                La carta estructurada se mostrará aquí. (Pendiente endpoint de items/variantes)
              </p>
            ) : (
              <p className="text-white/50">Este club no tiene carta configurada.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
