// src/services/tickets.service.ts
// Small client/SSR-safe fetcher for tickets available by date.

import type { TicketDTO } from "@/services/clubs.service";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:4000";

export type AvailableTicketsResponse = {
  clubId: string;
  date: string; // YYYY-MM-DD
  dateHasEvent: boolean;
  event: {
    id: string;
    name: string;
    availableDate: string; // YYYY-MM-DD
    bannerUrl: string | null;
  } | null;
  eventTickets: TicketDTO[];
  generalTickets: TicketDTO[];
  freeTickets: TicketDTO[];
};

/* ───────────────────────── Sorting helpers (priority ASC) ────────────────── */
/** Accept common aliases for priority so different backends still sort correctly. */
function priorityOf(t: any): number | null {
  const candidates = [
    t?.priority,
    t?.rank,
    t?.order,
    t?.ordering,
    t?.sort,
    t?.weight,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const collator = new Intl.Collator(["es", "en"], {
  sensitivity: "accent",
  numeric: true,
});

/** Sort by: priority ASC (missing = bottom), then name A→Z, then id A→Z. */
function sortTicketsByPriorityThenName(list: TicketDTO[]) {
  list.sort((a: any, b: any) => {
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    const ap = pa === null ? Number.POSITIVE_INFINITY : pa;
    const bp = pb === null ? Number.POSITIVE_INFINITY : pb;

    if (ap !== bp) return ap - bp;

    const byName = collator.compare((a.name ?? "") as string, (b.name ?? "") as string);
    if (byName !== 0) return byName;

    return String((a.id ?? "") as string).localeCompare(String((b.id ?? "") as string));
  });
}

/**
 * Fetch tickets available for a club on a given local date (YYYY-MM-DD).
 * - Uses no-store to avoid stale cache while selecting dates
 * - Throws on non-2xx status so callers can handle/display errors
 */
export async function getAvailableTicketsForDate(
  clubId: string,
  dateISO: string
): Promise<AvailableTicketsResponse> {
  if (!clubId || !dateISO) {
    throw new Error("clubId and dateISO are required");
  }

  const url = `${API_BASE}/tickets/available/${encodeURIComponent(
    clubId
  )}/${encodeURIComponent(dateISO)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Failed to fetch available tickets (${res.status}): ${text || res.statusText}`
    );
  }

  const data = (await res.json()) as AvailableTicketsResponse;

  // Normalize arrays defensively
  data.eventTickets = Array.isArray(data.eventTickets) ? data.eventTickets : [];
  data.generalTickets = Array.isArray(data.generalTickets) ? data.generalTickets : [];
  data.freeTickets = Array.isArray(data.freeTickets) ? data.freeTickets : [];

  // Apply sorting: priority ASC, then name, then id
  sortTicketsByPriorityThenName(data.eventTickets);
  sortTicketsByPriorityThenName(data.generalTickets);
  sortTicketsByPriorityThenName(data.freeTickets);

  return data;
}
