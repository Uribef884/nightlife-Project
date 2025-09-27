// src/services/tickets.service.ts
// Small client/SSR-safe fetcher for tickets available by date.

import type { TicketDTO } from "@/services/clubs.service";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

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
// Local type for ticket objects with priority fields
type TicketWithPriority = {
  priority?: unknown;
  rank?: unknown;
  order?: unknown;
  ordering?: unknown;
  sort?: unknown;
  weight?: unknown;
  name?: unknown;
  id?: unknown;
};

/** Accept common aliases for priority so different backends still sort correctly. */
function priorityOf(t: unknown): number | null {
  const ticket = t as TicketWithPriority;
  const candidates = [
    ticket?.priority,
    ticket?.rank,
    ticket?.order,
    ticket?.ordering,
    ticket?.sort,
    ticket?.weight,
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
  list.sort((a: TicketDTO, b: TicketDTO) => {
    const pa = priorityOf(a);
    const pb = priorityOf(b);
    const ap = pa === null ? Number.POSITIVE_INFINITY : pa;
    const bp = pb === null ? Number.POSITIVE_INFINITY : pb;

    if (ap !== bp) return ap - bp;

    const byName = collator.compare(a.name ?? "", b.name ?? "");
    if (byName !== 0) return byName;

    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
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

  // Local types for backend ticket data
  type BackendTicket = {
    id: unknown;
    name: unknown;
    description?: unknown;
    price: unknown;
    dynamicPricingEnabled?: unknown;
    dynamicPrice?: unknown;
    maxPerPerson?: unknown;
    priority?: unknown;
    isActive?: unknown;
    includesMenuItem?: unknown;
    availableDate?: unknown;
    quantity?: unknown;
    originalQuantity?: unknown;
    category: unknown;
    clubId: unknown;
    eventId?: unknown;
    event?: {
      id: unknown;
      name: unknown;
      description?: unknown;
      availableDate: unknown;
      openHours?: {
        open: unknown;
        close: unknown;
      };
    };
    includedMenuItems?: BackendIncludedMenuItem[];
  };

  type BackendIncludedMenuItem = {
    id: unknown;
    menuItemId: unknown;
    menuItemName: unknown;
    variantId?: unknown;
    variantName?: unknown;
    quantity?: unknown;
  };

  // Normalize arrays defensively and ensure includedMenuItems are properly structured
  const normalizeTicket = (ticket: unknown): TicketDTO => {
    const t = ticket as BackendTicket;
    return {
      id: String(t.id),
      name: String(t.name),
      description: t.description ? String(t.description) : null,
      price: typeof t.price === 'number' ? t.price : 
             typeof t.price === 'string' ? t.price : 0,
      dynamicPricingEnabled: !!t.dynamicPricingEnabled,
      dynamicPrice: typeof t.dynamicPrice === 'number' ? t.dynamicPrice :
                   typeof t.dynamicPrice === 'string' ? t.dynamicPrice : undefined,
      maxPerPerson: Number(t.maxPerPerson ?? 0),
      priority: Number(t.priority ?? 0),
      isActive: !!t.isActive,
      includesMenuItem: !!t.includesMenuItem,
      availableDate: t.availableDate ? String(t.availableDate) : null,
      quantity: typeof t.quantity === 'number' ? t.quantity : null,
      originalQuantity: typeof t.originalQuantity === 'number' ? t.originalQuantity : null,
      category: t.category as "general" | "event" | "free",
      clubId: String(t.clubId),
      eventId: t.eventId ? String(t.eventId) : null,
      // Add event data if available
      event: t.event ? {
        id: String(t.event.id),
        name: String(t.event.name),
        description: t.event.description ? String(t.event.description) : null,
        availableDate: String(t.event.availableDate),
        openHours: t.event.openHours ? {
          open: String(t.event.openHours.open),
          close: String(t.event.openHours.close)
        } : undefined
      } : null,
      includedMenuItems: Array.isArray(t.includedMenuItems)
        ? t.includedMenuItems.map((inc: BackendIncludedMenuItem) => ({
            id: String(inc.id),
            menuItemId: String(inc.menuItemId),
            menuItemName: String(inc.menuItemName),
            variantId: inc.variantId ? String(inc.variantId) : null,
            variantName: inc.variantName ? String(inc.variantName) : null,
            quantity: Number(inc.quantity ?? 1),
          }))
        : [],
    };
  };

  data.eventTickets = Array.isArray(data.eventTickets) ? data.eventTickets.map(normalizeTicket) : [];
  data.generalTickets = Array.isArray(data.generalTickets) ? data.generalTickets.map(normalizeTicket) : [];
  data.freeTickets = Array.isArray(data.freeTickets) ? data.freeTickets.map(normalizeTicket) : [];

  // Apply sorting: priority ASC, then name, then id
  sortTicketsByPriorityThenName(data.eventTickets);
  sortTicketsByPriorityThenName(data.generalTickets);
  sortTicketsByPriorityThenName(data.freeTickets);

  return data;
}
