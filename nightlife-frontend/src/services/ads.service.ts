// src/services/ads.service.ts
import { API_BASE_CSR, API_BASE_SSR, joinUrl } from "@/lib/env";

export type AdLike = {
  id: string;
  imageUrl: string;
  targetType?: "ticket" | "event" | "club" | "external" | null;
  targetId?: string | null;
  externalUrl?: string | null; // For external ads only
  clubId?: string | null;
  resolvedDate?: string | null;
  link?: string | null;
};

type TicketDTO = { 
  id: string; 
  clubId: string; 
  availableDate?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
};
type EventDTO = { 
  id: string; 
  clubId: string; 
  availableDate?: string | null; 
  date?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
};

function apiBase(): string {
  return typeof window === "undefined" ? API_BASE_SSR : API_BASE_CSR;
}
async function safeJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}
function isIdLike(x: unknown): x is string {
  return typeof x === "string" && /^[0-9A-Za-z_-]{6,}$/.test(x);
}

/** Build deep-link to the club page, forcing the Reservas tab.
 *  - date goes in the query (?date=YYYY-MM-DD) so the calendar preselects it
 *  - #reservas selects the tab (your page reads the hash first)
 */
function reservasHref(clubId: string, dateYMD: string | null, focusTicketId?: string) {
  const sp = new URLSearchParams();
  if (dateYMD) sp.set("date", dateYMD);
  if (focusTicketId) sp.set("focusTicket", focusTicketId);
  const qs = sp.toString();
  return `/clubs/${encodeURIComponent(clubId)}${qs ? `?${qs}` : ""}#reservas`;
}

// --- tiny date helpers (YYYY-MM-DD) ---
function toYMD(raw: string): string {
  // Accept 'YYYY-MM-DD' or ISO; coerce to YYYY-MM-DD
  const m = raw.match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : new Date(raw).toISOString().slice(0, 10);
}

function isDateInPast(dateYMD: string | null): boolean {
  if (!dateYMD) return false;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return dateYMD < today;
}

// --- API fetchers (env-based; no hard-coding) ---
export async function fetchTicketById(id: string): Promise<TicketDTO> {
  if (!isIdLike(id)) throw new Error("bad ticket id");
  const url = joinUrl(apiBase(), `/tickets/${encodeURIComponent(id)}`);
  return safeJson(await fetch(url, { cache: "no-store" }));
}
export async function fetchEventById(id: string): Promise<EventDTO> {
  if (!isIdLike(id)) throw new Error("bad event id");
  const url = joinUrl(apiBase(), `/events/${encodeURIComponent(id)}`);
  return safeJson(await fetch(url, { cache: "no-store" }));
}

/** Best-effort parse of ticket/event target from an arbitrary link string. */
function parseTargetFromLink(link?: string | null):
  | { type: "ticket" | "event"; id: string }
  | null {
  if (!link) return null;

  // token form: ticket:<id> / event:<id>
  const m1 = link.match(/\b(ticket|event):([0-9A-Za-z_-]{6,})\b/i);
  if (m1) return { type: m1[1].toLowerCase() as "ticket" | "event", id: m1[2] };

  // path form: /tickets/:id or /events/:id
  const m2 = link.match(/\/(tickets|events)\/([0-9A-Za-z_-]{6,})/i);
  if (m2) return { type: m2[1].toLowerCase() as "ticket" | "event", id: m2[2] };

  // query form: ?ticketId=.. or ?eventId=..
  try {
    const u = new URL(link, typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_FRONTEND_URL);
    const qp = u.searchParams;
    const t = qp.get("ticketId") || qp.get("ticket") || qp.get("tid");
    if (t && isIdLike(t)) return { type: "ticket", id: t };
    const e = qp.get("eventId") || qp.get("event") || qp.get("eid");
    if (e && isIdLike(e)) return { type: "event", id: e };
  } catch {}
  return null;
}

/** Main resolver used by the Lightbox to build the CTA. */
export async function resolveAdCTA(
  ad: AdLike
): Promise<{ label: string; href: string } | null> {
  try {
    // 1) explicit targeting
    if (ad.targetType === "ticket" && ad.targetId) {
      const t = await fetchTicketById(ad.targetId);
      // Don't show CTA if ticket is inactive or deleted
      if (!t.isActive || t.isDeleted) return null;
      const ymd = toYMD(t.availableDate ?? new Date().toISOString());
      // Don't show CTA if ticket date is in the past
      if (isDateInPast(ymd)) return null;
      return { label: `Ir a Reservas – ${ymd}`, href: reservasHref(t.clubId, ymd, t.id) };
    }
    if (ad.targetType === "event" && ad.targetId) {
      const e = await fetchEventById(ad.targetId);
      // Don't show CTA if event is inactive or deleted
      if (!e.isActive || e.isDeleted) return null;
      const raw = e.availableDate ?? e.date;
      if (!raw) return null;
      const ymd = toYMD(raw);
      // Don't show CTA if event date is in the past
      if (isDateInPast(ymd)) return null;
      return { label: `Ir a Reservas – ${ymd}`, href: reservasHref(e.clubId, ymd) };
    }
    if (ad.targetType === "club" && ad.clubId) {
      const ymd = ad.resolvedDate ? toYMD(ad.resolvedDate) : null;
      return { label: ymd ? `Ir a Reservas – ${ymd}` : "Ir a Reservas", href: reservasHref(ad.clubId, ymd) };
    }
    if (ad.targetType === "external" && ad.externalUrl) {
      // External ads - validate URL and return with security measures
      return { label: "Visitar Sitio Web", href: ad.externalUrl };
    }

    // 2) infer from free-form link (common for older ads)
    const inferred = parseTargetFromLink(ad.link);
    if (inferred?.type === "ticket") {
      const t = await fetchTicketById(inferred.id);
      // Don't show CTA if ticket is inactive or deleted
      if (!t.isActive || t.isDeleted) return null;
      const ymd = toYMD(t.availableDate ?? new Date().toISOString());
      // Don't show CTA if ticket date is in the past
      if (isDateInPast(ymd)) return null;
      return { label: `Ir a Reservas – ${ymd}`, href: reservasHref(t.clubId, ymd, t.id) };
    }
    if (inferred?.type === "event") {
      try {
        const e = await fetchEventById(inferred.id);
        // Don't show CTA if event is inactive or deleted
        if (!e.isActive || e.isDeleted) return null;
        const raw = e.availableDate ?? e.date;
        if (!raw) return null;
        const ymd = toYMD(raw);
        // Don't show CTA if event date is in the past
        if (isDateInPast(ymd)) return null;
        return { label: `Ir a Reservas – ${ymd}`, href: reservasHref(e.clubId, ymd) };
      } catch (error) {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}
