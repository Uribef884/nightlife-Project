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

  // Optional: quick sanity normalization for arrays
  data.eventTickets = Array.isArray(data.eventTickets) ? data.eventTickets : [];
  data.generalTickets = Array.isArray(data.generalTickets) ? data.generalTickets : [];
  data.freeTickets = Array.isArray(data.freeTickets) ? data.freeTickets : [];

  return data;
}
