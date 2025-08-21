// src/app/clubs/[clubId]/pageClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  getAvailableTicketsForDate,
  type AvailableTicketsResponse,
} from "@/services/tickets.service";

type Props = { clubId: string; clubSSR: ClubDTO };
type TabKey = "general" | "reservas" | "carta";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:4000";

/** Normalize various event date fields into YYYY-MM-DD */
function pickEventDate(e: any): string | null {
  const raw: unknown = e?.availableDate ?? e?.date ?? e?.eventDate ?? null;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

// YYYY-MM-DD in local time (not UTC)
function todayLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

export default function ClubPageClient({ clubId, clubSSR }: Props) {
  const [tab, setTab] = useState<TabKey>("general");

  const [club, setClub] = useState<ClubDTO>(clubSSR);
  const [ads, setAds] = useState<ClubAdDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [calendarTickets, setCalendarTickets] = useState<TicketDTO[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [available, setAvailable] = useState<AvailableTicketsResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [dateCache, setDateCache] = useState<Record<string, AvailableTicketsResponse>>({});

  // ── Normalize initial URL & state (tab+date) when landing on a club ──
  useEffect(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    // 1) Determine tab: hash > ?tab= ; default general
    const hash = (url.hash || "").replace("#", "").toLowerCase();
    let t: TabKey =
      hash === "reservas" || hash === "carta" || hash === "general"
        ? (hash as TabKey)
        : "general";
    if (t === "general") {
      const qtab = (sp.get("tab") || "").toLowerCase();
      if (qtab === "reservas" || qtab === "reservations") t = "reservas";
      else if (qtab === "carta" || qtab === "menu") t = "carta";
    }

    // 2) Write canonical hash so NavBar + page stay in sync
    if (window.location.hash.replace("#", "") !== t) {
      window.location.hash = t; // will also fire hashchange
    }
    setTab(t);

    // 3) Clean URL — drop ?tab= but keep ?date=
    if (sp.has("tab")) {
      sp.delete("tab");
      const clean = `${url.pathname}${sp.toString() ? `?${sp}` : ""}#${t}`;
      history.replaceState({}, "", clean);
    }

    // 4) Date: use ?date=YYYY-MM-DD if valid, otherwise today (local)
    const qdate = sp.get("date");
    const date =
      qdate && /^\d{4}-\d{2}-\d{2}$/.test(qdate) ? qdate : todayLocal();
    setSelectedDate(date);

    // 5) Reset availability/cache
    setAvailable(null);
    setAvailError(null);
    setDateCache({});
  }, [clubId]);

  // React to hash changes (tabs)
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace("#", "") as TabKey;
      if (h === "general" || h === "reservas" || h === "carta") setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // ── CSR data loads ──
  useEffect(() => {
    getClubByIdCSR(clubId).then((c) => c && setClub(c)).catch(() => {});
    getClubAdsCSR(clubId).then(setAds).catch(() => {});

    (async () => {
      try {
        const e = await getEventsForClubCSR(clubId);
        if (Array.isArray(e) && e.length > 0) {
          setEvents(e);
        } else {
          const res = await fetch(`${API_BASE}/events/club/${encodeURIComponent(clubId)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) setEvents(data as EventDTO[]);
          }
        }
      } catch {
        try {
          const res = await fetch(`${API_BASE}/events/club/${encodeURIComponent(clubId)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) setEvents(data as EventDTO[]);
          }
        } catch {}
      }
    })();

    (async () => {
      try {
        const t = await getTicketsForClubCSR(clubId);
        if (Array.isArray(t) && t.length > 0) {
          setTickets(t);
        } else {
          const url = `${API_BASE}/tickets/club/${encodeURIComponent(clubId)}?isActive=true`;
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) setTickets(data as TicketDTO[]);
          }
        }
      } catch {
        try {
          const url = `${API_BASE}/tickets/club/${encodeURIComponent(clubId)}?isActive=true`;
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) setTickets(data as TicketDTO[]);
          }
        } catch {}
      }
    })();

    (async () => {
      try {
        const url = `${API_BASE}/tickets/calendar/${encodeURIComponent(clubId)}`;
        const res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.tickets && Array.isArray(data.tickets)) {
            setCalendarTickets(data.tickets as TicketDTO[]);
          }
        }
      } catch {}
    })();
  }, [clubId]);

  // Safety: coerce arrays
  const safeEvents: EventDTO[] = Array.isArray(events) ? events : [];
  const safeTickets: TicketDTO[] = Array.isArray(tickets) ? tickets : [];
  const safeCalendarTickets: TicketDTO[] = Array.isArray(calendarTickets) ? calendarTickets : [];

  // Calendar colors
  const eventDates = useMemo(() => {
    const filtered = safeEvents.filter((e) => {
      const evClub = (e as any)?.clubId;
      return !evClub || evClub === clubId;
    });
    const dates = filtered.map((e) => pickEventDate(e)).filter((d): d is string => !!d);
    return new Set<string>(dates);
  }, [safeEvents, clubId]);

  const freeDates = useMemo(() => {
    const s = new Set<string>();

    // Immediate display from calendar tickets
    for (const t of safeCalendarTickets) {
      const tClub = (t as any)?.clubId;
      if (tClub && tClub !== clubId) continue;
      if ((t as any)?.isActive === false) continue;

      const date = t?.availableDate;
      if (!date) continue;

      const qty = (t as any)?.quantity;
      if (qty != null && Number(qty) <= 0) continue;

      if (t.category !== "free") continue; // strict free category
      s.add(date);
    }

    // Merge refined availability (from server buckets)
    if (available?.freeTickets?.length) {
      for (const ticket of available.freeTickets) {
        if (ticket.availableDate) s.add(ticket.availableDate.split("T")[0]);
      }
    }

    // Merge cached results for previously-visited dates
    Object.entries(dateCache).forEach(([date, data]) => {
      if (data?.freeTickets && data.freeTickets.length > 0) s.add(date);
    });

    // Events override free coloring
    for (const d of eventDates) s.delete(d);

    return s;
  }, [safeCalendarTickets, clubId, eventDates, available, dateCache]);

  const openDays = useMemo(
    () => new Set((club.openDays || []).map((d: string) => d.toLowerCase())),
    [club]
  );

  // If user lands on "reservas" with no selection, auto-pick first event date
  useEffect(() => {
    if (tab === "reservas" && !selectedDate) {
      if (safeEvents.length > 0) setSelectedDate(pickEventDate(safeEvents[0]));
    }
  }, [tab, selectedDate, safeEvents]);

  // Tickets embedded in the selected event (if provided by backend)
  const selectedEventTickets = useMemo<TicketDTO[] | undefined>(() => {
    if (!selectedDate) return undefined;
    const ev = safeEvents.find((e) => pickEventDate(e) === selectedDate);
    return ev?.tickets && Array.isArray(ev.tickets) ? ev.tickets : undefined;
  }, [safeEvents, selectedDate]);

  // Availability buckets (debounced + cached per date)
  useEffect(() => {
    if (!selectedDate) {
      setAvailable(null);
      setAvailError(null);
      return;
    }

    if (dateCache[selectedDate]) {
      setAvailable(dateCache[selectedDate]);
      setAvailError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      let cancelled = false;
      setAvailLoading(true);
      setAvailError(null);

      getAvailableTicketsForDate(clubId, selectedDate)
        .then((data) => {
          if (!cancelled) {
            setAvailable(data);
            setDateCache((prev) => ({ ...prev, [selectedDate]: data }));
          }
        })
        .catch((e) => {
          if (!cancelled) setAvailError(e?.message || "Error cargando boletas");
        })
        .finally(() => {
          if (!cancelled) setAvailLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [clubId, selectedDate, dateCache]);

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="pt-3 pb-6">
        {/* GENERAL */}
        {tab === "general" && (
          <section className="space-y-6">
            <ClubHeader club={club} onReservarClick={() => (window.location.hash = "reservas")} />
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
                onClick={() => (window.location.hash = "reservas")}
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

            {availLoading && <div className="text-white/70">Cargando boletas...</div>}
            {availError && <div className="text-red-300">{availError}</div>}

            <TicketsGrid
              club={club}
              selectedDate={selectedDate}
              events={safeEvents}
              tickets={safeTickets}
              selectedEventTickets={selectedEventTickets}
              available={
                available
                  ? {
                      dateHasEvent: available.dateHasEvent,
                      event: available.event,
                      eventTickets: available.eventTickets,
                      generalTickets: available.generalTickets,
                      freeTickets: available.freeTickets,
                    }
                  : undefined
              }
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
    </div>
  );
}
