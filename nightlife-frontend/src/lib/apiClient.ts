// src/lib/apiClient.ts
// One gate for all HTTP calls: credentials, JSON parsing, CSRF header, and typed helpers.

import { getCsrfToken } from "./csrf";

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type BodyInitish = BodyInit | Record<string, unknown> | undefined;

export type ApiOptions = {
  method?: HttpMethod;
  body?: BodyInitish;
  headers?: Record<string, string>;
  csrf?: boolean; // add X-CSRF-Token automatically
  // if you need form-data later, pass a FormData in body (we will not set JSON header)
};

// ---------- NEW: shared base URL helper ----------
export const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:4000";

export const apiUrl = (path: string) => {
  if (path.startsWith("/")) return `${API_BASE}${path}`;
  return `${API_BASE}/${path}`;
};

export async function apiFetch<T = unknown>(url: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, csrf = false } = opts;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  let finalBody: BodyInit | undefined = undefined;

  // If body is plain object (and not FormData), send JSON
  if (body instanceof FormData) {
    finalBody = body;
    // Do NOT set Content-Type; the browser will set boundary automatically
  } else if (body && typeof body === "object") {
    finalHeaders["Content-Type"] = "application/json";
    finalBody = JSON.stringify(body);
  } else if (typeof body !== "undefined") {
    finalBody = body as BodyInit;
  }

  if (csrf && method !== "GET") {
    const token = await getCsrfToken();
    if (token) finalHeaders["X-CSRF-Token"] = token;
  }

  // ---------- NEW: forward cookies on the server ----------
  if (typeof window === "undefined") {
    try {
      // Import at runtime so this never ends up in the client bundle
      const { cookies } = await import("next/headers");

      // Next 15: cookies() is async; in older versions await is harmless
      const store = await (cookies as unknown as () => Promise<any>)();

      const all =
        store && typeof store.getAll === "function"
          ? (store.getAll() as Array<{ name: string; value: string }>)
          : [];

      const cookieHeader = all
        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
        .join("; ");

      if (cookieHeader && !finalHeaders.Cookie) {
        finalHeaders.Cookie = cookieHeader;
      }
    } catch {
      // If we can't read cookies in this context, just proceed without them
    }
  }

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    credentials: "include", // client-side sends cookies; server-side we set Cookie header above
    body: ["GET", "HEAD"].includes(method) ? undefined : finalBody,
    // NOTE: you could add `cache: 'no-store'` here for highly dynamic endpoints if needed
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (!res.ok) {
    let message = `Request failed with ${res.status}`;
    let details: unknown;
    if (isJson) {
      const data = await res.json().catch(() => ({}));
      message = (data as any)?.message ?? message;
      details = data;
    } else {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    const error: ApiError = { status: res.status, message, details };
    throw error;
  }

  if (isJson) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

// (rest of the file unchanged: api helpers, types, getGlobalAds/getClubs/... )

// Convenience helpers (unchanged)
export const api = {
  get:   <T>(url: string, headers?: Record<string, string>) => apiFetch<T>(url, { method: "GET", headers }),
  post:  <T>(url: string, body?: BodyInitish, csrf = true) => apiFetch<T>(url, { method: "POST", body, csrf }),
  patch: <T>(url: string, body?: BodyInitish, csrf = true) => apiFetch<T>(url, { method: "PATCH", body, csrf }),
  put:   <T>(url: string, body?: BodyInitish, csrf = true) => apiFetch<T>(url, { method: "PUT", body, csrf }),
  delete:<T>(url: string, csrf = true) => apiFetch<T>(url, { method: "DELETE", csrf }),
};

// ---------- NEW: domain types ----------
export type Club = {
  id: string;
  name: string;
  address: string;
  city: string;
  profileImageUrl: string;
  priority: number;
};

export type Ad = {
  id: string;
  clubId: string | null;
  imageUrl: string;
  imageBlurhash?: string | null;
  priority: number;
  isVisible: boolean;
  targetType?: "ticket" | "event" | "club";
  targetId?: string | null;
  label?: "global" | "club"; // you mentioned this field exists
  link?: string | null;      // ignored for navigation by design
  createdAt?: string;
  updatedAt?: string;
};

export type EventDto = {
  id: string;
  clubId: string;
  availableDate: string; // ISO or YYYY-MM-DD (we'll normalize)
};

export type TicketDto = {
  id: string;
  clubId: string;
  eventId?: string | null;
  availableDate?: string | null; // for free/special tickets
};

// ---------- NEW: small date utility ----------
export function toYmd(dateLike: string | Date): string | null {
  try {
    const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const da = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${da}`;
  } catch {
    return null;
  }
}

// ---- helper: normalize results regardless of endpoint shape ----
function filterAndSortGlobalAds(ads: Ad[] | undefined | null): Ad[] {
  if (!Array.isArray(ads)) return [];
  return ads
    .filter((a) => {
      // If server already returned only global ads, "label" may be absent;
      // in that case, we only check isVisible.
      const isGlobal = typeof a.label === "string" ? a.label === "global" : true;
      return a.isVisible && isGlobal;
    })
    .sort((a, b) => a.priority - b.priority);
}

// ---------- SAFE VERSION w/ /ads/global + fallback to /ads ----------
export async function getGlobalAds(): Promise<Ad[]> {
  // 1) Preferred: /ads/global (smaller payload, consistent)
  try {
    const adsGlobal = await api.get<Ad[]>(apiUrl("/ads/global"));
    return filterAndSortGlobalAds(adsGlobal);
  } catch (e) {
    // Continue to fallback; only warn in dev
    if (process.env.NODE_ENV !== "production") {
      console.warn("[getGlobalAds] /ads/global failed, falling back to /ads", e);
    }
  }

  // 2) Fallback: /ads → filter label === 'global'
  try {
    const adsAll = await api.get<Ad[]>(apiUrl("/ads"));
    return filterAndSortGlobalAds(adsAll);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[getGlobalAds] /ads fallback failed, returning []", e);
    }
    return [];
  }
}

export async function getCities(): Promise<string[]> {
  try {
    // If backend has a dedicated endpoint:
    const cities = await api.get<string[]>(apiUrl("/clubs/cities"));
    if (Array.isArray(cities) && cities.length) return cities;
    return [];
  } catch {
    // Fallback happens server-side in page.tsx if needed
    return [];
  }
}

export async function getClubs(params: { city?: string; q?: string } = {}): Promise<Club[]> {
  const qp = new URLSearchParams();
  if (params.city) qp.set("city", params.city);
  if (params.q) qp.set("q", params.q);

  const url = apiUrl(`/clubs${qp.toString() ? `?${qp.toString()}` : ""}`);
  const clubs = await api.get<Club[]>(url);

  // Defensive ordering: priority ASC, then name ASC
  return (clubs || []).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

// ---------- NEW: event/ticket fetchers for server-side date resolution ----------
export async function getEventById(id: string): Promise<EventDto | null> {
  try {
    const dto = await api.get<EventDto>(apiUrl(`/events/${encodeURIComponent(id)}`));
    return dto ?? null;
  } catch {
    return null;
  }
}

export async function getTicketById(id: string): Promise<TicketDto | null> {
  try {
    const dto = await api.get<TicketDto>(apiUrl(`/tickets/${encodeURIComponent(id)}`));
    return dto ?? null;
  } catch {
    return null;
  }
}
