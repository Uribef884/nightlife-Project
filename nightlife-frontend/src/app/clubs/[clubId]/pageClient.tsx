// src/app/clubs/[clubId]/pageClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";

import { ClubHeader } from "@/components/domain/club/ClubHeader";
import { ClubAdsCarousel } from "@/components/domain/club/ClubAdsCarousel";
import { ClubSocials } from "@/components/domain/club/ClubSocials";
import MapGoogle from "@/components/domain/club/MapGoogle.client";
import { ClubCalendar } from "@/components/domain/club/ClubCalendar";
import { ClubEvents } from "@/components/domain/club/ClubEvents";
import { TicketsGrid } from "@/components/domain/club/TicketsGrid";
import { PdfMenu } from "@/components/domain/club/PdfMenu";
import { StructuredMenu } from "@/components/domain/club/menu/StructuredMenu";
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

import { joinUrl, API_BASE_CSR } from "@/lib/env";

type Props = { clubId: string; clubSSR: ClubDTO };
type TabKey = "general" | "reservas" | "carta";



/** Normalize event date fields into YYYY-MM-DD */
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

/** Merge CSR club into SSR club, but do NOT clobber defined SSR menu fields with null/undefined. */
function safeMergeClub(prev: ClubDTO, next?: Partial<ClubDTO> | null): ClubDTO {
  if (!next) return prev;
  const merged: ClubDTO = { ...(prev as any), ...(next as any) };

  // Protect SSR menu meta if CSR omitted or nullish
  const nMenuType = (next as any)?.menuType ?? undefined;
  const nPdfUrl = (next as any)?.pdfMenuUrl ?? undefined;
  const nPdfName = (next as any)?.pdfMenuName ?? undefined;

  if (nMenuType === undefined || nMenuType === null || nMenuType === "") {
    (merged as any).menuType = (prev as any).menuType;
  }
  if (nPdfUrl === undefined || nPdfUrl === null || nPdfUrl === "") {
    (merged as any).pdfMenuUrl = (prev as any).pdfMenuUrl;
  }
  if (nPdfName === undefined || nPdfName === null || nPdfName === "") {
    (merged as any).pdfMenuName = (prev as any).pdfMenuName;
  }

  return merged;
}

/** Normalize menu meta strictly to your entity. Falls back intelligently. */
function normalizeMenuMeta(
  club: Partial<ClubDTO> | null | undefined,
  clubSSR: Partial<ClubDTO> | null | undefined
) {
  // Pull raw values from both sources (CSR wins if defined)
  const csr = (club as any) ?? {};
  const ssr = (clubSSR as any) ?? {};

  // Raw values and source tracking
  let rawType: string | null | undefined = csr.menuType ?? ssr.menuType;
  let typeSource: "csr" | "ssr" | "inferred" | "none" = rawType ? (csr.menuType !== undefined ? "csr" : "ssr") : "none";

  let rawPdf: string | null | undefined = csr.pdfMenuUrl ?? ssr.pdfMenuUrl;
  const pdfSource: "csr" | "ssr" | "none" = rawPdf ? (csr.pdfMenuUrl !== undefined ? "csr" : "ssr") : "none";

  // Canonicalize type
  let type = typeof rawType === "string" ? rawType.toLowerCase() : "";
  if (type !== "structured" && type !== "pdf" && type !== "none") {
    type = ""; // unknown
  }

  // If type unknown but we have a PDF URL, infer pdf
  if (!type && rawPdf) {
    type = "pdf";
    typeSource = "inferred";
  }

  // If still unknown, assume none
  if (!type) {
    type = "none";
    if (typeSource === "none") typeSource = "none";
  }

  const pdf = typeof rawPdf === "string" && rawPdf.trim().length > 0 ? rawPdf : null;
  const pdfName = (csr.pdfMenuName ?? ssr.pdfMenuName) || "Menú";

  const hasMenu = type === "structured" || (type === "pdf" && !!pdf);

  return { type, pdf, pdfName, hasMenu, typeSource, pdfSource };
}

/** Observe in-page URL changes (Next soft navigations) */
function installLocationObserver(cb: () => void) {
  let timer: number | null = null;
  const schedule = () => {
    if (timer != null) return;
    timer = window.setTimeout(() => {
      timer = null;
      cb();
    }, 0);
  };

  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);

  (history.pushState as typeof history.pushState) = ((...args: Parameters<typeof history.pushState>) => {
    const ret = origPush(...args);
    schedule();
    return ret;
  }) as typeof history.pushState;

  (history.replaceState as typeof history.replaceState) = ((...args: Parameters<typeof history.replaceState>) => {
    const ret = origReplace(...args);
    schedule();
    return ret;
  }) as typeof history.replaceState;

  const onPop = () => schedule();
  const onHash = () => schedule();
  window.addEventListener("popstate", onPop);
  window.addEventListener("hashchange", onHash);

  return () => {
    history.pushState = origPush;
    history.replaceState = origReplace;
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("hashchange", onHash);
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/** Shared motion for tab sections */
const tabTransition: Transition = { duration: 0.18, ease: [0.16, 1, 0.3, 1] };
const tabMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: tabTransition,
};

export default function ClubPageClient({ clubId, clubSSR }: Props) {
  const [tab, setTab] = useState<TabKey>("general");

  // Start with SSR club; CSR will MERGE into this (not overwrite)
  const [club, setClub] = useState<ClubDTO>(clubSSR);
  const [clubFetchDone, setClubFetchDone] = useState(false);

  const [ads, setAds] = useState<ClubAdDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [calendarTickets, setCalendarTickets] = useState<TicketDTO[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [available, setAvailable] = useState<AvailableTicketsResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [dateCache, setDateCache] = useState<Record<string, AvailableTicketsResponse>>({});

  // Merged/normalized menu meta (CSR→SSR fallback)
  const menuMeta = useMemo(() => normalizeMenuMeta(club, clubSSR), [club, clubSSR]);

  /* NEW: publish the effective menu type for global consumers (e.g., ClubTabs)
     We show Carta ONLY when data-club-menu="structured" or "pdf". */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const nextType = menuMeta?.type ?? "unknown";
    
    if (root.getAttribute("data-club-menu") !== nextType) {
      root.setAttribute("data-club-menu", nextType);
    }
    // optional: expose id for debugging/future
    if (root.getAttribute("data-club-id") !== String(clubId)) {
      root.setAttribute("data-club-id", String(clubId));
    }
    return () => {
      root.removeAttribute("data-club-id");
      root.removeAttribute("data-club-menu");
    };
  }, [menuMeta?.type, clubId]);



  /** Parse current URL and sync tab + date (NO hard redirect away from Carta). */
  const syncFromLocation = () => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    const rawHash = url.hash;
    const hash = (url.hash || "").replace("#", "").toLowerCase();
    let t: TabKey =
      hash === "reservas" || hash === "carta" || hash === "general"
        ? (hash as TabKey)
        : "general";

    let fromQuery: string | null = null;
    if (t === "general") {
      const qtab = (sp.get("tab") || "").toLowerCase();
      fromQuery = qtab || null;
      if (qtab === "reservas" || qtab === "reservations") t = "reservas";
      else if (qtab === "carta" || qtab === "menu") t = "carta";
    }

    // NOTE: We intentionally DO NOT redirect away from "carta" anymore.
    // If the club truly has no menu, the Carta view will show a friendly empty state.

    // Canonicalize: remove ?tab=, keep hash
    if (sp.has("tab")) {
      sp.delete("tab");
      const clean = `${url.pathname}${sp.toString() ? `?${sp}` : ""}${t ? `#${t}` : ""}`;
      history.replaceState({}, "", clean);
    }

    const qdate = sp.get("date");
    const date = qdate && /^\d{4}-\d{2}-\d{2}$/.test(qdate) ? qdate : todayLocal();



    setTab((prev) => (prev !== t ? t : prev));
    setSelectedDate((prev) => {
      if (prev !== date) {
        setAvailable(null);
        setAvailError(null);
        setDateCache({});
        return date;
      }
      return prev;
    });
  };

  useEffect(() => {
    syncFromLocation();
    const off = installLocationObserver(syncFromLocation);
    return () => off();
  }, [clubId, clubSSR]); // IMPORTANT: removed menuMeta dependency to avoid racey re-runs

  // ── CSR data loads ──
  useEffect(() => {
    getClubByIdCSR(clubId)
      .then((c) => {
        if (c) {
          setClub((prev) => {
            const merged = safeMergeClub(prev, c as Partial<ClubDTO>);
            return merged;
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        setClubFetchDone(true);
      });

    getClubAdsCSR(clubId)
      .then((data) => {
        setAds(data ?? []);
      })
      .catch(() => {});

    (async () => {
      try {
        const e = await getEventsForClubCSR(clubId);
        if (Array.isArray(e) && e.length > 0) {
          setEvents(e);
        } else {
          const url = joinUrl(API_BASE_CSR, `/events/club/${encodeURIComponent(clubId)}`);
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            setEvents(Array.isArray(data) ? (data as EventDTO[]) : []);
          }
        }
      } catch (err) {
        // Silent fail
      }
    })();

    (async () => {
      try {
        const t = await getTicketsForClubCSR(clubId);
        if (Array.isArray(t) && t.length > 0) {
          setTickets(t);
        } else {
          const url = joinUrl(API_BASE_CSR, `/tickets/club/${encodeURIComponent(clubId)}?isActive=true`);
          const res = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
          });
          if (res.ok) {
            const data = await res.json();
            setTickets(Array.isArray(data) ? (data as TicketDTO[]) : []);
          }
        }
      } catch (err) {
        // Silent fail
      }
    })();

    (async () => {
      try {
        const url = joinUrl(API_BASE_CSR, `/tickets/calendar/${encodeURIComponent(clubId)}`);
        const res = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const arr = data?.tickets ?? [];
          setCalendarTickets(Array.isArray(arr) ? (arr as TicketDTO[]) : []);
        }
      } catch (err) {
        // Silent fail
      }
    })();
  }, [clubId]);

  // Safety: coerce arrays
  const safeEvents: EventDTO[] = Array.isArray(events) ? events : [];
  const safeTickets: TicketDTO[] = Array.isArray(tickets) ? tickets : [];
  const safeCalendarTickets: TicketDTO[] = Array.isArray(calendarTickets) ? calendarTickets : [];

  // Calendar colors: Event dates
  const eventDates = useMemo(() => {
    const filtered = safeEvents.filter((e) => {
      const evClub = (e as any)?.clubId;
      return !evClub || evClub === clubId;
    });
    const dates = filtered.map((e) => pickEventDate(e)).filter((d): d is string => !!d);
    return new Set<string>(dates);
  }, [safeEvents, clubId]);



  // Calendar colors: Free ticket dates (with availability + cache)
  const freeDates = useMemo(() => {
    const s = new Set<string>();

    for (const t of safeCalendarTickets) {
      const tClub = (t as any)?.clubId;
      if (tClub && tClub !== clubId) continue;
      if ((t as any)?.isActive === false) continue;

      const date = (t as any)?.availableDate;
      if (!date) continue;

      const qty = (t as any)?.quantity;
      if (qty != null && Number(qty) <= 0) continue;

      if ((t as any).category !== "free") continue; // strict free category
      s.add(date);
    }

    if (available?.freeTickets?.length) {
      for (const ticket of available.freeTickets) {
        if ((ticket as any)?.availableDate) s.add((ticket as any).availableDate.split("T")[0]);
      }
    }

    Object.entries(dateCache).forEach(([date, data]) => {
      if (data?.freeTickets && data.freeTickets.length > 0) s.add(date);
    });

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
      if (safeEvents.length > 0) {
        const first = pickEventDate(safeEvents[0]);
        setSelectedDate(first);
      }
    }
  }, [tab, selectedDate, safeEvents]);

  // Tickets embedded in the selected event (if provided by backend)
  const selectedEventTickets = useMemo<TicketDTO[] | undefined>(() => {
    if (!selectedDate) return undefined;
    const ev = safeEvents.find((e) => pickEventDate(e) === selectedDate);
    return ev?.tickets && Array.isArray(ev?.tickets) ? ev.tickets : undefined;
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
          if (cancelled) return;
          setAvailable(data);
          setDateCache((prev) => ({ ...prev, [selectedDate]: data }));
        })
        .catch((e) => {
          if (cancelled) return;
          setAvailError(e?.message || "Error cargando boletas");
        })
        .finally(() => {
          if (cancelled) return;
          setAvailLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [clubId, selectedDate, dateCache]);

  // Hide the general grid when it's an event day
  const isEventDay = Boolean(
    selectedDate && (available?.dateHasEvent ?? eventDates.has(selectedDate))
  );

  return (
    <div className="max-w-5xl mx-auto px-4">
      <div className="pt-3 pb-6">
        <AnimatePresence mode="wait">
          {tab === "general" && (
            <motion.section key="tab-general" {...tabMotion} className="space-y-6">
              <ClubHeader
                club={club}
                onReservarClick={() => {
                  window.location.hash = "reservas";
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />

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
                  onClick={() => {
                    window.location.hash = "reservas";
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white py-3 font-semibold shadow"
                >
                  Reservar
                </button>
              </div>
            </motion.section>
          )}

          {tab === "reservas" && (
            <motion.section key="tab-reservas" {...tabMotion} className="space-y-6">
              <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
                <h3 className="text-white font-semibold mb-3">Selecciona la fecha</h3>

                <ClubCalendar
                  monthOffset={0}
                  eventDates={eventDates}
                  freeDates={freeDates}
                  openDays={openDays}
                  onSelect={(val: unknown) => {
                    // Normalize Date|string → 'YYYY-MM-DD'
                    let iso: string | null = null;
                    if (val instanceof Date) {
                      const y = val.getFullYear();
                      const m = String(val.getMonth() + 1).padStart(2, "0");
                      const d = String(val.getDate()).padStart(2, "0");
                      iso = `${y}-${m}-${d}`;
                    } else if (typeof val === "string") {
                      const m = val.match(/^\d{4}-\d{2}-\d{2}/);
                      if (m) iso = m[0];
                    }
                    if (iso) setSelectedDate(iso);
                  }}
                  selectedDate={selectedDate}
                />
                {selectedDate && (
                  <p className="mt-3 text-sm text-white/70">
                    Fecha seleccionada:{" "}
                    <span className="font-semibold">{formatDayLong(selectedDate)}</span>
                  </p>
                )}
              </div>

              {/* Events list; expands the selected event card on event days */}
              <ClubEvents
                events={safeEvents}
                selectedDate={selectedDate}
                available={
                  available
                    ? {
                        dateHasEvent: available.dateHasEvent,
                        event: available.event,
                        eventTickets: available.eventTickets,
                      }
                    : undefined
                }
                onChooseDate={(d) => {
                  setSelectedDate(d);
                }}
              />

              {availLoading && <div className="text-white/70">Cargando boletas...</div>}
              {availError && <div className="text-red-300">{availError}</div>}

              {/* Tickets grid — only when it is NOT an event day */}
              {!isEventDay && (
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
                          generalTickets: (available as any).generalTickets,
                          freeTickets: (available as any).freeTickets,
                        }
                      : undefined
                  }
                />
              )}
            </motion.section>
          )}

          {tab === "carta" && (
            <motion.section key="tab-carta" {...tabMotion} className="space-y-6">
              {(() => {
                const hasPdf = menuMeta.type === "pdf" && Boolean(menuMeta.pdf);
                const isStructured = menuMeta.type === "structured";

                if (hasPdf) {
                  // Generate a fallback menuId if the new field doesn't exist yet
                  let fallbackMenuId = (club as any)?.pdfMenuId ?? (clubSSR as any)?.pdfMenuId;
                  
                  if (!fallbackMenuId) {
                    // Extract menuId from existing PDF URL or filename
                    const pdfUrl = menuMeta.pdf as string;
                    const pdfName = (club as any)?.pdfMenuName ?? (clubSSR as any)?.pdfMenuName;
                    
                    if (pdfUrl && pdfUrl.includes('/menu/')) {
                      // Extract from URL: .../menu/menu-1234567890.pdf
                      const urlMatch = pdfUrl.match(/\/menu\/([^\/]+)\.pdf/);
                      if (urlMatch) {
                        fallbackMenuId = urlMatch[1]; // menu-1234567890
                      }
                    } else if (pdfName && pdfName.startsWith('menu-')) {
                      // Extract from filename: menu-1234567890.pdf
                      fallbackMenuId = pdfName.replace('.pdf', '');
                    } else {
                      // Last resort: generate from timestamp
                      fallbackMenuId = `menu-${Date.now()}`;
                    }
                  }
                  
                  return (
                    <PdfMenu
                      url={menuMeta.pdf as string}
                      filename={(club as any)?.pdfMenuName ?? (clubSSR as any)?.pdfMenuName ?? "Menú"}
                      height="70vh"
                      clubId={clubId}
                      menuId={fallbackMenuId}
                    />
                  );
                }

                if (isStructured) {
                  return <StructuredMenu clubId={String((club as any).id)} />;
                }

                // Empty state (no redirect): friendly message for deep links or missing menu
                return (
                  <div className="rounded-2xl border border-white/10 p-6 bg-white/5 text-white/80">
                    <h3 className="text-white font-semibold mb-2">Sin carta disponible</h3>
                    <p className="text-sm">
                      Este club no tiene una carta publicada en este momento. Puedes revisar{" "}
                      <a
                        href="#reservas"
                        className="underline decoration-white/40 hover:decoration-white"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      >
                        Reservas
                      </a>{" "}
                      o volver a la pestaña{" "}
                      <a
                        href="#general"
                        className="underline decoration-white/40 hover:decoration-white"
                        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                      >
                        General
                      </a>
                      .
                    </p>
                  </div>
                );
              })()}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
