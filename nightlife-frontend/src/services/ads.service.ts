/**
 * Client-side helpers for resolving Ad CTAs (ticket/event → reservas link)
 * Reads API base from src/lib/env.ts (no hard-coded URLs).
 *
 * Backend endpoints used:
 *   GET /tickets/:id
 *   GET /events/:id
 *   GET /clubs/:id  (only if we must compute "closest day")
 */

import { pickBestDateForTicket, dateToYMD, parseYMD } from "@/lib/adDateUtils";
import type { AdDTO } from "@/components/common/AdLightbox";
import { API_BASE_CSR, API_BASE_SSR, joinUrl } from "@/lib/env";

// -------------------- Types used by this service --------------------
type TicketDTO = {
  id: string;
  clubId: string;
  name?: string;
  availableDate?: string | null; // "YYYY-MM-DD" or ISO
  eventId?: string | null;
};

type EventDTO = {
  id: string;
  clubId: string;
  availableDate?: string | null; // preferred name in your backend
  date?: string | null;          // fallback if backend uses "date"
};

type ClubDTO = {
  id: string;
  name: string;
  // 0=Sun..6=Sat (number[] or string[] supported)
  openDays?: number[] | string[];
};

// -------------------- Helpers --------------------
function apiBase(): string {
  // Use CSR base in the browser and SSR base on the server.
  return typeof window === "undefined" ? API_BASE_SSR : API_BASE_CSR;
}

function requireApiBase(): string {
  const base = apiBase();
  if (!base) {
    // Fail fast so we don't silently fetch a wrong origin.
    throw new Error(
      "[ads.service] API base URL missing. Set NEXT_PUBLIC_API_URL (and BACKEND_URL for SSR) in your environment."
    );
  }
  return base;
}

async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function isUuidLike(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f-]{10,}$/i.test(s);
}

// -------------------- Fetchers (use env + joinUrl) --------------------
export async function fetchTicketById(id: string): Promise<TicketDTO> {
  if (!isUuidLike(id)) throw new Error("Bad ticket id");
  const base = requireApiBase();
  const url = joinUrl(base, `/tickets/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  return safeJson<TicketDTO>(res);
}

export async function fetchEventById(id: string): Promise<EventDTO> {
  if (!isUuidLike(id)) throw new Error("Bad event id");
  const base = requireApiBase();
  const url = joinUrl(base, `/events/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  return safeJson<EventDTO>(res);
}

export async function fetchClubById(id: string): Promise<ClubDTO> {
  if (!isUuidLike(id)) throw new Error("Bad club id");
  const base = requireApiBase();
  const url = joinUrl(base, `/clubs/${id}`);
  const res = await fetch(url, { cache: "no-store" });
  return safeJson<ClubDTO>(res);
}

/** Build the reservas URL with date (and focusTicket when applicable). */
function reservasHref(clubId: string, dateYMD: string, focusTicket?: string) {
  const p = new URLSearchParams();
  p.set("tab", "reservas");
  p.set("date", dateYMD);
  if (focusTicket) p.set("focusTicket", focusTicket);
  return `/clubs/${clubId}?${p.toString()}`;
}

// -------------------- Public resolver --------------------
/**
 * Resolve CTA for an ad:
 * - ticket → /clubs/[clubId]?tab=reservas&date=YYYY-MM-DD&focusTicket=[id]
 * - event  → /clubs/[clubId]?tab=reservas&date=YYYY-MM-DD
 * - none   → null
 */
export async function resolveAdCTA(
  ad: AdDTO
): Promise<{ label: string; href: string } | null> {
  try {
    if (ad.targetType === "ticket" && ad.targetId) {
      const ticket = await fetchTicketById(ad.targetId);
      const club = await fetchClubById(ticket.clubId);

      const bestDate = await pickBestDateForTicket(ticket, club);
      if (!bestDate) return null;

      const dateYMD = dateToYMD(bestDate);
      return {
        label: `Ir a Reservas – ${dateYMD}`,
        href: reservasHref(ticket.clubId, dateYMD, ticket.id),
      };
    }

    if (ad.targetType === "event" && ad.targetId) {
      const ev = await fetchEventById(ad.targetId);
      const raw = ev.availableDate ?? ev.date;
      if (!raw) return null;

      const d = parseYMD(raw);
      const dateYMD = dateToYMD(d);
      return {
        label: `Ir a Reservas – ${dateYMD}`,
        href: reservasHref(ev.clubId, dateYMD),
      };
    }

    return null;
  } catch {
    return null;
  }
}
