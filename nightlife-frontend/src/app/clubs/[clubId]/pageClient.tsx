// src/app/clubs/[clubId]/pageClient.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion, type Transition } from "framer-motion";

import { ClubHeader } from "@/components/domain/club/ClubHeader";
import { ClubAdsCarousel } from "@/components/domain/club/ClubAdsCarousel";
import { ClubSocials } from "@/components/domain/club/ClubSocials";
import MapGoogle from "@/components/domain/club/MapGoogle.client";
// NOTE: we no longer import ClubCalendar directly here; GlobalCalendarPortal owns it.
// import { ClubCalendar } from "@/components/domain/club/ClubCalendar";
import { ClubEvents } from "@/components/domain/club/ClubEvents";
import TicketsGrid from "@/components/domain/club/TicketsGrid";
import { PdfMenu } from "@/components/domain/club/PdfMenu";
import { StructuredMenu } from "@/components/domain/club/menu/StructuredMenu";
import GlobalCalendarPortal from "@/components/domain/club/GlobalCalendarPortal";
import { CartDateChangeModal } from "@/components/cart";
import { useCartContext } from "@/contexts/CartContext";

import {
  getClubAdsCSR,
  getClubByIdCSR,
  getEventsForClubCSR,
  // Removed getTicketsForClubCSR import - no longer needed
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
function pickEventDate(e: unknown): string | null {
  if (!e || typeof e !== 'object') return null;
  const eventObj = e as Record<string, unknown>;
  const raw: unknown = eventObj?.availableDate ?? eventObj?.date ?? eventObj?.eventDate ?? null;
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
  const merged: ClubDTO = { ...prev, ...next };

  // Protect SSR menu meta if CSR omitted or nullish
  const nMenuType = next?.menuType ?? undefined;
  const nPdfUrl = next?.pdfMenuUrl ?? undefined;
  const nPdfName = next?.pdfMenuName ?? undefined;

  if (nMenuType === undefined || nMenuType === null || nMenuType === "none") {
    merged.menuType = prev.menuType;
  }
  if (nPdfUrl === undefined || nPdfUrl === null || nPdfUrl === "") {
    merged.pdfMenuUrl = prev.pdfMenuUrl;
  }
  if (nPdfName === undefined || nPdfName === null || nPdfName === "") {
    merged.pdfMenuName = prev.pdfMenuName;
  }

  return merged;
}

/** Normalize menu meta strictly to your entity. Falls back intelligently. */
function normalizeMenuMeta(
  club: Partial<ClubDTO> | null | undefined,
  clubSSR: Partial<ClubDTO> | null | undefined
) {
  // Pull raw values from both sources (CSR wins if defined)
  const csr = club ?? {};
  const ssr = clubSSR ?? {};

  // Raw values and source tracking
  const rawType: string | null | undefined = csr.menuType ?? ssr.menuType;
  const typeSource: "csr" | "ssr" | "inferred" | "none" = rawType ? (csr.menuType !== undefined ? "csr" : "ssr") : "none";

  const rawPdf: string | null | undefined = csr.pdfMenuUrl ?? ssr.pdfMenuUrl;
  const pdfSource: "csr" | "ssr" | "none" = rawPdf ? (csr.pdfMenuUrl !== undefined ? "csr" : "ssr") : "none";

  // Canonicalize type
  let type = typeof rawType === "string" ? rawType.toLowerCase() : "";
  if (type !== "structured" && type !== "pdf" && type !== "none") {
    type = ""; // unknown
  }

  // If type unknown but we have a PDF URL, infer pdf
  if (!type && rawPdf) {
    type = "pdf";
  }

  // If still unknown, assume none
  if (!type) {
    type = "none";
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
  // Cart context
  const { items: cartItems, clearCart, isLoading } = useCartContext();
  
  // Modal state for date change warning
  const [showDateChangeModal, setShowDateChangeModal] = useState(false);
  const [tempDesiredDate, setTempDesiredDate] = useState<string | null>(null);
  const [isSettingDateFromModal, setIsSettingDateFromModal] = useState(false);
  const [tab, setTab] = useState<TabKey>("general");
  
  // Modal handlers
  const handleDateChangeBlocked = (desiredDate?: string) => {
    if (desiredDate) {
      setTempDesiredDate(desiredDate);
    }
    setShowDateChangeModal(true);
  };
  
  const handleClearCartAndClose = async () => {
    setIsSettingDateFromModal(true); // Flag to prevent syncFromLocation from interfering
    await clearCart();
    setShowDateChangeModal(false);
    
    // Use the temp desired date to change the date after cart is cleared
    if (tempDesiredDate) {
      setSelectedDate(tempDesiredDate);
      setTab("reservas");
      setTempDesiredDate(null);
    }
    
    // Reset flag after a delay
    setTimeout(() => {
      setIsSettingDateFromModal(false);
    }, 200);
  };

  const handleCancelNavigation = () => {
    setShowDateChangeModal(false);
    setTempDesiredDate(null);
  };

  // Safe date change handler that checks for cart items
  const handleDateChange = useCallback((newDate: string) => {
    if (cartItems.length > 0) {
      // Store the desired date in temp variable and show modal
      setTempDesiredDate(newDate);
      setShowDateChangeModal(true);
    } else {
      // Safe to change date
      setSelectedDate(newDate);
    }
  }, [cartItems.length]);

  // Handle ad date change requests
  useEffect(() => {
    const handleAdDateChangeRequest = (event: CustomEvent) => {
      const { date } = event.detail;
      
      if (cartItems.length > 0) {
        // Store the desired date in temp variable and show modal
        setTempDesiredDate(date);
        setShowDateChangeModal(true);
      } else {
        // Safe to change date immediately and switch to reservas tab
        setSelectedDate(date);
        setTab("reservas");
      }
    };

    window.addEventListener('adDateChangeRequest', handleAdDateChangeRequest as EventListener);
    
    return () => {
      window.removeEventListener('adDateChangeRequest', handleAdDateChangeRequest as EventListener);
    };
  }, [cartItems.length]);
  

  // Start with SSR club; CSR will MERGE into this (not overwrite)
  const [club, setClub] = useState<ClubDTO>(clubSSR);

  const [ads, setAds] = useState<ClubAdDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  // Removed tickets state - no longer needed since we only use getAvailableTicketsForDate
  const [calendarTickets, setCalendarTickets] = useState<TicketDTO[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [available, setAvailable] = useState<AvailableTicketsResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [dateCache, setDateCache] = useState<Record<string, AvailableTicketsResponse>>({});

  // Merged/normalized menu meta (CSR→SSR fallback)
  const menuMeta = useMemo(() => normalizeMenuMeta(club, clubSSR), [club, clubSSR]);
  const isStructuredMenu = menuMeta.type === "structured";

  // Active calendar host id for the portal
  const calendarHostId =
    tab === "reservas"
      ? "calendar-host-reservas"
      : tab === "carta" && isStructuredMenu
      ? "calendar-host-carta"
      : null;

  // Helper function to scroll to top of page
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* Publish effective menu type for global consumers (e.g., tabs CSS visibility) */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const nextType = menuMeta?.type ?? "unknown";

    if (root.getAttribute("data-club-menu") !== nextType) {
      root.setAttribute("data-club-menu", nextType);
    }
    if (root.getAttribute("data-club-id") !== String(clubId)) {
      root.setAttribute("data-club-id", String(clubId));
    }
    return () => {
      root.removeAttribute("data-club-id");
      root.removeAttribute("data-club-menu");
    };
  }, [menuMeta?.type, clubId]);

  /** Parse current URL and sync tab + date (non-destructive for date). */
  const syncFromLocation = useCallback(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    // Tab from hash or ?tab
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

    // Canonicalize ?tab away
    if (sp.has("tab")) {
      sp.delete("tab");
      const clean = `${url.pathname}${sp.toString() ? `?${sp}` : ""}${t ? `#${t}` : ""}`;
      history.replaceState({}, "", clean);
    }

    setTab((prev) => {
      if (prev !== t) {
        // Scroll to top when tab actually changes
        setTimeout(() => {
          scrollToTop();
        }, 100); // Shorter delay for URL-based changes
        return t;
      }
      return prev;
    });

    // Date from ?date (only when present); otherwise keep user's date (init once if null)
    const qdate = sp.get("date");
    const urlDate = qdate && /^\d{4}-\d{2}-\d{2}$/.test(qdate) ? qdate : null;

    setSelectedDate((prev) => {
      // Don't change date if we're setting it from the modal
      if (isSettingDateFromModal) {
        return prev;
      }
      
      if (urlDate && prev !== urlDate) {
        // Reset caches only when date actually changes to avoid noise
        setAvailable(null);
        setAvailError(null);
        setDateCache({});
        return urlDate;
      }
      
      // If cart is still loading, don't set any date yet - let CartEffect handle it
      if (isLoading) {
        return prev;
      }
      
      // Check if there are items in cart first, use most common date
      // This applies only when prev is null (initial load), NOT when switching tabs
      if (cartItems.length > 0 && prev == null) {
        const dateCounts = new Map<string, number>();
        cartItems.forEach(item => {
          if (item.date) {
            dateCounts.set(item.date, (dateCounts.get(item.date) || 0) + 1);
          }
        });
        
        if (dateCounts.size > 0) {
          const mostCommonDate = Array.from(dateCounts.entries())
            .sort(([,a], [,b]) => b - a)[0][0];
          
          // Only change date if it's different from current
          if (prev !== mostCommonDate) {
            setAvailable(null);
            setAvailError(null);
            setDateCache({});
            return mostCommonDate;
          }
        }
      }
      
      // If no cart items and no previous date, fallback to today
      if (prev == null) {
        const today = todayLocal();
        setAvailable(null);
        setAvailError(null);
        setDateCache({});
        return today;
      }
      
      return prev;
    });
  }, [cartItems, isLoading, isSettingDateFromModal, setTab, setSelectedDate, setAvailable, setAvailError, setDateCache]);

  useEffect(() => {
    syncFromLocation();
    const off = installLocationObserver(syncFromLocation);
    return () => off();
  }, [clubId, clubSSR, syncFromLocation]); // removed cartItems to prevent reload on cart changes

  // Separate effect to handle cart-based date selection when cart loads
  useEffect(() => {
    // Only run when cart finishes loading and we have items but no selected date
    if (!isLoading && cartItems.length > 0 && !selectedDate) {
      const dateCounts = new Map<string, number>();
      cartItems.forEach(item => {
        if (item.date) {
          dateCounts.set(item.date, (dateCounts.get(item.date) || 0) + 1);
        }
      });
      
      if (dateCounts.size > 0) {
        const mostCommonDate = Array.from(dateCounts.entries())
          .sort(([,a], [,b]) => b - a)[0][0];
        
        setSelectedDate(mostCommonDate);
        setAvailable(null);
        setAvailError(null);
        setDateCache({});
      }
    }
  }, [isLoading, cartItems, selectedDate, setSelectedDate, setAvailable, setAvailError, setDateCache]);

  // Test scroll function on mount when coming from ad
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#reservas") {
      setTimeout(() => {
        scrollToTop();
      }, 500);
    }
  }, []); // Only run once on mount

  // Scroll to top whenever tab changes (backup to syncFromLocation)
  useEffect(() => {
    // Multiple attempts to ensure scroll to top works even with interfering components
    const scrollAttempts = [100, 300, 500]; // Try at different intervals
    
    scrollAttempts.forEach((delay) => {
      setTimeout(() => {
        scrollToTop();
      }, delay);
    });
  }, [tab]);

  // ── CSR data loads ──
  useEffect(() => {
    getClubByIdCSR(clubId)
      .then((c) => {
        if (c) setClub((prev) => safeMergeClub(prev, c as Partial<ClubDTO>));
      })
      .catch(() => {})
      .finally(() => {});

    getClubAdsCSR(clubId)
      .then((data) => setAds(data ?? []))
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
      } catch {
        // Silent fail
      }
    })();

    // We color the calendar via an aggregated calendar endpoint
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
      } catch {
        // Silent fail
      }
    })();
  }, [clubId]);

  // Calendar colors: Event dates
  const eventDates = useMemo(() => {
    const safeEvents: EventDTO[] = Array.isArray(events) ? events : [];
    const filtered = safeEvents.filter((e) => {
      const eventObj = e as Record<string, unknown>;
      const evClub = eventObj?.clubId;
      return !evClub || evClub === clubId;
    });
    const dates = filtered.map((e) => pickEventDate(e)).filter((d): d is string => !!d);
    return new Set<string>(dates);
  }, [events, clubId]);

  // Calendar colors: Free ticket dates (with availability + cache)
  const freeDates = useMemo(() => {
    const s = new Set<string>();
    const safeCalendarTickets: TicketDTO[] = Array.isArray(calendarTickets) ? calendarTickets : [];

    for (const t of safeCalendarTickets) {
      const ticketObj = t as Record<string, unknown>;
      const tClub = ticketObj?.clubId;
      if (tClub && tClub !== clubId) continue;
      if (ticketObj?.isActive === false) continue;

      const date = ticketObj?.availableDate;
      if (!date || typeof date !== 'string') continue;

      // Include tickets with quantity = 0 so they show as "AGOTADO" in calendar
      // const qty = ticketObj?.quantity;
      // if (qty != null && Number(qty) <= 0) continue;

      if (ticketObj.category !== "free") continue; // strict free category
      s.add(date);
    }

    if (available?.freeTickets?.length) {
      for (const ticket of available.freeTickets) {
        const ticketObj = ticket as Record<string, unknown>;
        if (ticketObj?.availableDate && typeof ticketObj.availableDate === 'string') {
          s.add(ticketObj.availableDate.split("T")[0]);
        }
      }
    }

    Object.entries(dateCache).forEach(([date, data]) => {
      if (data?.freeTickets && data.freeTickets.length > 0) s.add(date);
    });

    for (const d of eventDates) s.delete(d);

    return s;
  }, [calendarTickets, clubId, eventDates, available, dateCache]);

  const openDays = useMemo(
    () => new Set((club.openDays || []).map((d: string) => d.toLowerCase())),
    [club]
  );

  // Cart-based date selection is now handled in syncFromLocation function
  // This ensures it works both on initial load and when switching tabs

  // Auto-select date for first event when on reservas tab (fallback)
  useEffect(() => {
    const safeEvents: EventDTO[] = Array.isArray(events) ? events : [];
    if (!isLoading && !selectedDate && tab === "reservas" && safeEvents.length > 0) {
      const first = pickEventDate(safeEvents[0]);
      setSelectedDate(first);
    }
  }, [tab, selectedDate, events, isLoading]);


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
            <motion.section key="tab-general" data-tab="general" {...tabMotion} className="space-y-6">
              <ClubHeader
                club={club}
                onReservarClick={() => {
                  window.location.hash = "reservas";
                  scrollToTop();
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
                    scrollToTop();
                  }}
                  className="w-full rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white py-3 font-semibold shadow"
                >
                  Reservar
                </button>
              </div>
            </motion.section>
          )}

          {tab === "reservas" && (
            <motion.section 
              key="tab-reservas" 
              data-tab="reservas"
              {...tabMotion} 
              className="space-y-6"
            >
              <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
                <h3 className="text-white font-semibold mb-3">Selecciona la fecha</h3>

                {/* Host for the single global calendar (rendered via portal) */}
                <div id="calendar-host-reservas" />
              </div>

              {/* Events list; expands the selected event card on event days */}
              <div id="events-section">
                <ClubEvents
                  events={Array.isArray(events) ? events : []}
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
                  onChooseDate={handleDateChange}
                  clubId={club.id}
                  clubName={club.name}
                />
              </div>

              {availLoading && <div className="text-white/70">Cargando boletas...</div>}
              {availError && <div className="text-red-300">{availError}</div>}

              {/* Tickets grid — only when it is NOT an event day */}
              {!isEventDay && (
                <div data-tickets-content id="tickets-section">
                  <TicketsGrid
                    club={club}
                    selectedDate={selectedDate}
                    tickets={[]}
                    available={
                      available
                        ? {
                            dateHasEvent: available.dateHasEvent,
                            event: available.event,
                            eventTickets: available.eventTickets,
                            generalTickets: (available as Record<string, unknown>).generalTickets as TicketDTO[],
                            freeTickets: (available as Record<string, unknown>).freeTickets as TicketDTO[],
                          }
                        : undefined
                    }
                  />
                </div>
              )}
            </motion.section>
          )}

          {tab === "carta" && (
            <motion.section key="tab-carta" data-tab="carta" {...tabMotion} className="space-y-6">
              {(() => {
                const hasPdf = menuMeta.type === "pdf" && Boolean(menuMeta.pdf);

                if (hasPdf) {
                  // Generate a fallback menuId if the new field doesn't exist yet
                  const clubObj = club as Record<string, unknown>;
                  const clubSSRObj = clubSSR as Record<string, unknown>;
                  let fallbackMenuId = clubObj?.pdfMenuId ?? clubSSRObj?.pdfMenuId;
                  if (!fallbackMenuId) {
                    const pdfUrl = menuMeta.pdf as string;
                    const pdfName = clubObj?.pdfMenuName ?? clubSSRObj?.pdfMenuName;
                    if (pdfUrl && pdfUrl.includes("/menu/")) {
                      const urlMatch = pdfUrl.match(/\/menu\/([^\/]+)\.pdf/);
                      if (urlMatch) fallbackMenuId = urlMatch[1];
                    } else if (pdfName && typeof pdfName === 'string' && pdfName.startsWith("menu-")) {
                      fallbackMenuId = pdfName.replace(".pdf", "");
                    } else {
                      fallbackMenuId = `menu-${Date.now()}`;
                    }
                  }
                  return (
                    <PdfMenu
                      url={menuMeta.pdf as string}
                      filename={typeof (clubObj?.pdfMenuName ?? clubSSRObj?.pdfMenuName) === 'string' ? (clubObj?.pdfMenuName ?? clubSSRObj?.pdfMenuName) as string : "Menú"}
                      height="70vh"
                      clubId={clubId}
                      menuId={typeof fallbackMenuId === 'string' ? fallbackMenuId : `menu-${Date.now()}`}
                    />
                  );
                }

                if (isStructuredMenu) {
                  return (
                    <>
                      <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
                        <h3 className="text-white font-semibold mb-3">Fecha para la carta</h3>
                        {/* Host for the same single global calendar */}
                        <div id="calendar-host-carta" />
                      </div>

                      <StructuredMenu
                        clubId={String(club.id)}
                        clubName={club.name}
                        selectedDate={selectedDate || undefined}
                        openDays={openDays}
                        eventDates={eventDates}
                        freeDates={freeDates}
                      />
                    </>
                  );
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

        {/* Single calendar instance rendered into whichever tab is active */}
        {calendarHostId && (
          <GlobalCalendarPortal
            hostId={calendarHostId}
            eventDates={eventDates}
            freeDates={freeDates}
            openDays={openDays}
            selectedDate={selectedDate}
            onSelect={(val: unknown) => {
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
            hasCartItems={cartItems.length > 0}
            onDateChangeBlocked={handleDateChangeBlocked}
          />
        )}
        
        {/* Date Change Warning Modal */}
        <CartDateChangeModal
          isOpen={showDateChangeModal}
          onClose={handleCancelNavigation}
          onClearCart={handleClearCartAndClose}
        />
      </div>
    </div>
  );
}
