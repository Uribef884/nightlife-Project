// src/services/clubs.service.ts
import { API_BASE_CSR, API_BASE_SSR, joinUrl } from "@/lib/env";

/* Shared list item shapes used by the UI */
export type ClubListItem = {
  id: string;
  name: string;
  address: string;
  city: string;
  profileImageUrl?: string | null;
  /** Sort key 1: smaller means higher priority (ASC). Missing = lowest (bottom). */
  priority?: number | null;
};

export type ClubListResponse = {
  items: ClubListItem[];
  page: number;
  pageSize: number;
  total: number;
};

/* Raw query shape coming from UI / URL (can be string OR string[]) */
export type ClubQuery = {
  q?: string;
  city?: string;
  musicType?: string | string[];
  openDays?: string | string[];
  page?: number;     // 1-based
  pageSize?: number; // clamped later
};

/* ── Internal normalized type: arrays are ALWAYS arrays ───────────── */
type NormalizedClubQuery = {
  q: string;
  city: string;
  musicType: string[];
  openDays: string[];
  page: number;
  pageSize: number;
};

/* Utilities + security-oriented normalization */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const isNonEmpty = (s?: string) => !!s && s.trim().length > 0;
// allow letters, spaces, accents, hyphen, apostrophe, dot
const SAFE_TEXT = /^[\p{L}\s\-'.]+$/u;
// ES + EN day names (lowercased)
const DAY_SET = new Set([
  "monday","tuesday","wednesday","thursday","friday","saturday","sunday",
  "lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo",
]);

/** Normalize + validate query. Guarantees arrays for musicType/openDays. */
export function normalizeQuery(raw: ClubQuery): NormalizedClubQuery {
  let q = (raw.q ?? "").toString().normalize("NFKC").trim();
  if (q.length > 64) q = q.slice(0, 64);

  let city = (raw.city ?? "").toString().normalize("NFKC").trim();
  if (city.length > 48) city = city.slice(0, 48);
  if (city && !SAFE_TEXT.test(city)) city = ""; // drop unsafe

  const toArray = (v?: string | string[]): string[] =>
    v === undefined ? [] : (Array.isArray(v) ? v : [v]);

  const musicType = toArray(raw.musicType)
    .map((v) => v.toString().normalize("NFKC").trim())
    .filter((v) => v.length > 0 && v.length <= 32 && SAFE_TEXT.test(v));

  const openDays = toArray(raw.openDays)
    .map((v) => v.toString().normalize("NFKC").trim().toLowerCase())
    .filter((v) => DAY_SET.has(v));

  let page = Number(raw.page ?? 1);
  let pageSize = Number(raw.pageSize ?? 20);
  if (!Number.isFinite(page)) page = 1;
  if (!Number.isFinite(pageSize)) pageSize = 20;
  page = clamp(page, 1, 100_000);
  pageSize = clamp(pageSize, 1, 50);

  return { q, city, musicType, openDays, page, pageSize };
}

const SSR_TIMEOUT_MS = 8000;

/**
 * Server-side render path (kept as-is).
 * Fetches directly from BACKEND_URL and returns a normalized list response.
 */
export async function fetchClubsSSR(raw: ClubQuery): Promise<ClubListResponse> {
  const { q, city, musicType, openDays, page, pageSize } = normalizeQuery(raw);
  const hasFilters =
    isNonEmpty(q) || isNonEmpty(city) || musicType.length > 0 || openDays.length > 0;

  const endpoint = hasFilters ? "/clubs/filter" : "/clubs";
  // Use API_BASE_SSR from env
  const u = new URL(endpoint, API_BASE_SSR || "http://localhost");
  const sp = u.searchParams;

  if (isNonEmpty(q)) sp.set("query", q); // q -> query for backend
  if (isNonEmpty(city)) sp.set("city", city);
  for (const mt of musicType) sp.append("musicType", mt);
  for (const d of openDays) sp.append("openDays", d);
  sp.set("page", String(page));
  sp.set("pageSize", String(pageSize));

  const urlStr = u.toString();

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), SSR_TIMEOUT_MS);

  try {
    const resp = await fetch(urlStr, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "nightlife-frontend/ssr",
      },
      signal: ac.signal,
      cache: "no-store",
    });

    clearTimeout(to);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.warn("[SSR] upstream not OK", { url: urlStr, status: resp.status, text });
      }
      throw new Error(`SSR fetchClubs failed (${resp.status}): ${text}`);
    }

    const rawJson = await resp.json();

    // Tolerant normalization to the shape { items, page, pageSize, total }
    const normalized = coerceClubListResponse(rawJson);

    // Minimal sanity check
    if (!normalized || !Array.isArray(normalized.items)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[SSR] invalid payload shape", { url: urlStr, payload: rawJson });
      }
      return { items: [], page: 1, pageSize: 20, total: 0 };
    }

    return normalized;
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[SSR] fetch error", { url: urlStr, error: String(e) });
    }
    // Surface predictable empty state to the page
    return { items: [], page: 1, pageSize: 20, total: 0 };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   Helper functions to coerce various backend payload shapes to our UI contract
   ──────────────────────────────────────────────────────────────────────────── */

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safePriority(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Map a single backend record to the list item we need.
// Accepts multiple possible field names and simple nesting (location.*).
function mapBackendRecord(rec: unknown): ClubListItem | null {
  if (!rec || typeof rec !== "object") return null;
  const r = rec as Record<string, any>;

  const idRaw =
    r.id ?? r._id ?? r.uuid ?? r.clubId ?? r.club_id ?? r.identifier ?? null;
  const nameRaw = r.name ?? r.title ?? r.clubName ?? r.club_name ?? null;

  if (!idRaw || !nameRaw) return null; // skip invalid rows

  const addressRaw =
    r.address ??
    r.addressLine ??
    r.address_line ??
    r.location?.address ??
    r.location?.addressLine ??
    r.location?.address_line ??
    "";

  const cityRaw =
    r.city ??
    r.location?.city ??
    r.town ??
    r.locality ??
    "";

  const imgRaw =
    r.profileImageUrl ??
    r.profile_image_url ??
    r.imageUrl ??
    r.image_url ??
    r.logoUrl ??
    r.logo_url ??
    r.images?.profile ??
    r.images?.logo ??
    null;

  // Tolerant priority mapping (common field aliases)
  const priorityRaw =
    r.priority ??
    r.rank ??
    r.order ??
    r.ordering ??
    r.sort ??
    r.weight ??
    null;

  return {
    id: String(idRaw),
    name: String(nameRaw),
    address: addressRaw ? String(addressRaw) : "",
    city: cityRaw ? String(cityRaw) : "",
    profileImageUrl: imgRaw != null ? String(imgRaw) : null,
    priority: safePriority(priorityRaw), // may be null
  };
}

// Accept common server shapes: array, {items}, {data}, {results}, {clubs}, {rows}
function coerceClubListResponse(raw: any): ClubListResponse {
  let rows: any[] = [];

  if (Array.isArray(raw)) rows = raw;
  else if (Array.isArray(raw?.items)) rows = raw.items;
  else if (Array.isArray(raw?.data)) rows = raw.data;
  else if (Array.isArray(raw?.results)) rows = raw.results;
  else if (Array.isArray(raw?.clubs)) rows = raw.clubs;
  else if (Array.isArray(raw?.rows)) rows = raw.rows;

  const items = rows
    .map((r) => mapBackendRecord(r))
    .filter((x): x is ClubListItem => !!x);

  // ── Sorting: priority ASC, then name A→Z, then id A→Z (stable) ────────────
  // Assumption: smaller numeric priority = more important (shown first).
  const effPriority = (p?: number | null) =>
    (typeof p === "number" && Number.isFinite(p)) ? p : Number.POSITIVE_INFINITY;

  const collator = new Intl.Collator(["es", "en"], {
    sensitivity: "accent",
    numeric: true,
  });

  items.sort((a, b) => {
    // 1) priority ASC
    const pa = effPriority(a.priority);
    const pb = effPriority(b.priority);
    if (pa !== pb) return pa - pb;

    // 2) name ASC (locale-aware)
    const byName = collator.compare(a.name ?? "", b.name ?? "");
    if (byName !== 0) return byName;

    // 3) final tie-break: id ASC
    return String(a.id).localeCompare(String(b.id));
  });

  const page =
    toInt(raw?.page ?? raw?.pagination?.page, 1);
  const pageSize =
    toInt(
      raw?.pageSize ??
        raw?.page_size ??
        raw?.pagination?.pageSize ??
        raw?.pagination?.per_page,
      items.length || 20
    );
  const total =
    toInt(raw?.total ?? raw?.count ?? raw?.pagination?.total, items.length);

  return { items, page, pageSize, total };
}

/* ────────────────────────────────────────────────────────────────────────────
   CLIENT-SIDE, RATE-LIMIT-FRIENDLY SEARCH
   - Abort stale requests
   - Single-flight dedupe
   - 30s tiny cache (max 20 keys)
   - 429-aware backoff (Retry-After support)
   - Local token-bucket with accurate retry (per tab)
   ──────────────────────────────────────────────────────────────────────────── */

import { rateLimitWithRetry } from "@/middlewares/rateLimit"; // client-safe (Map in-memory)

// Toggle this to false if you don't expose a Next.js proxy at /api
const USE_RELATIVE_API = true;

const CSR_TIMEOUT_MS = 8000;
const CSR_CACHE_TTL_MS = 30_000; // 30 seconds
const CSR_CACHE_MAX = 20;        // keep last 20 queries

let currentAbort: AbortController | null = null;
const inFlight = new Map<string, Promise<ClubListResponse>>();
const cache = new Map<string, { data: ClubListResponse; expires: number }>();
let backoffUntil = 0; // epoch ms until which we avoid hitting the server

const now = () => Date.now();

function makeKey(nq: NormalizedClubQuery): string {
  // sort arrays so ["salsa","reggaeton"] == ["reggaeton","salsa"]
  const mt = [...nq.musicType].sort().join(",");
  const od = [...nq.openDays].sort().join(",");
  return `clubs:q=${nq.q.toLowerCase()}|city=${nq.city.toLowerCase()}|mt=${mt}|od=${od}|p=${nq.page}|ps=${nq.pageSize}`;
}

function lruGet(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires < now()) {
    cache.delete(key);
    return null;
  }
  // refresh recency (move to end)
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function lruSet(key: string, data: ClubListResponse) {
  cache.set(key, { data, expires: now() + CSR_CACHE_TTL_MS });
  if (cache.size > CSR_CACHE_MAX) {
    // evict oldest
    const first = cache.keys().next().value as string | undefined;
    if (first) cache.delete(first);
  }
}

function parseRetryAfter(h: string | null): number {
  if (!h) return 0;
  // Spec: either delta-seconds or HTTP-date
  const secs = Number(h);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const d = Date.parse(h);
  if (Number.isFinite(d)) return Math.max(0, d - now());
  return 0;
}

function buildCSRUrl(nq: NormalizedClubQuery): string {
  const hasFilters =
    isNonEmpty(nq.q) || isNonEmpty(nq.city) || nq.musicType.length > 0 || nq.openDays.length > 0;
  const endpoint = hasFilters ? "/clubs/filter" : "/clubs";

  // If using Next proxy, hit /api; otherwise go straight to API_BASE_CSR
  const base = USE_RELATIVE_API ? "/api" : (API_BASE_CSR || "/");
  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : API_BASE_CSR || "http://localhost";

  const u = new URL(`${base}${endpoint}`, origin);
  const sp = u.searchParams;

  if (isNonEmpty(nq.q)) sp.set("query", nq.q);
  if (isNonEmpty(nq.city)) sp.set("city", nq.city);
  for (const mt of nq.musicType) sp.append("musicType", mt);
  for (const d of nq.openDays) sp.append("openDays", d);
  sp.set("page", String(nq.page));
  sp.set("pageSize", String(nq.pageSize));

  return u.toString();
}

function getClientId(): string {
  // Per-tab ID so parallel tabs don't throttle each other.
  if (typeof window === "undefined") return "ssr";
  try {
    const k = "nl_client_id";
    const existing = window.sessionStorage.getItem(k);
    if (existing) return existing;
    // Prefer crypto.randomUUID(); fallback if not available.
    const id = (window.crypto && "randomUUID" in window.crypto)
      ? (window.crypto as any).randomUUID()
      : `cid_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(k, id);
    return id;
  } catch {
    return `cid_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * CSR-safe search with abort, single-flight, cache, 429 backoff,
 * and local token bucket (per tab) with accurate retry.
 */
export async function searchClubsCSR(raw: ClubQuery): Promise<ClubListResponse> {
  const nq = normalizeQuery(raw);
  const key = makeKey(nq);

  // Respect any active backoff window first
  if (now() < backoffUntil) {
    const cached = lruGet(key);
    if (cached) return cached;
    return { items: [], page: nq.page, pageSize: nq.pageSize, total: 0 };
  }

  // Serve from cache when fresh
  const cached = lruGet(key);
  if (cached) return cached;

  // Single-flight: if same key is already loading, reuse that promise
  const existing = inFlight.get(key);
  if (existing) return existing;

  // LOCAL TOKEN-BUCKET GUARD (per tab)
  const clientKey = `clubs-search:${getClientId()}`;
  const { allowed, retryAfterMs } = rateLimitWithRetry(clientKey, { tokens: 4, intervalMs: 5000 });
  if (!allowed) {
    // Set/extend a local backoff window to prevent thrash, prefer cached data if we have it
    backoffUntil = Math.max(backoffUntil, now() + retryAfterMs);
    const fallback = lruGet(key);
    return fallback ?? { items: [], page: nq.page, pageSize: nq.pageSize, total: 0 };
  }

  // Abort previous request (latest-search-wins)
  if (currentAbort) {
    try { currentAbort.abort(); } catch { /* ignore */ }
  }
  currentAbort = new AbortController();

  const urlStr = buildCSRUrl(nq);

  const p = (async (): Promise<ClubListResponse> => {
    const timeout = setTimeout(() => currentAbort?.abort(), CSR_TIMEOUT_MS);
    try {
      const resp = await fetch(urlStr, {
        method: "GET",
        headers: { Accept: "application/json" },
        // include credentials so cookie-based sessions work via the /api proxy
        credentials: "include",
        signal: currentAbort.signal,
        cache: "no-store",
      });

      clearTimeout(timeout);

      // 429: Respect server Retry-After and set local backoff
      if (resp.status === 429) {
        const retryAfterMs = parseRetryAfter(resp.headers.get("Retry-After")) || 1500;
        backoffUntil = now() + retryAfterMs;

        const fallback = lruGet(key);
        return fallback ?? { items: [], page: nq.page, pageSize: nq.pageSize, total: 0 };
      }

      if (!resp.ok) {
        if (process.env.NODE_ENV !== "production") {
          const txt = await resp.text().catch(() => "");
          console.warn("[CSR] upstream not OK", { url: urlStr, status: resp.status, txt });
        }
        const fallback = lruGet(key);
        return fallback ?? { items: [], page: nq.page, pageSize: nq.pageSize, total: 0 };
      }

      const rawJson = await resp.json();
      const normalized = coerceClubListResponse(rawJson);

      // Minimal sanity
      if (!normalized || !Array.isArray(normalized.items)) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[CSR] invalid payload shape", { url: urlStr, payload: rawJson });
        }
        const fallback = lruGet(key);
        const empty = { items: [], page: nq.page, pageSize: nq.pageSize, total: 0 };
        if (fallback) return fallback;
        lruSet(key, empty); // cache empty briefly to avoid thrash
        return empty;
      }

      // Cache success
      lruSet(key, normalized);
      return normalized;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError" || String(err).includes("AbortError")) {
        // Let callers ignore silently; do not set backoff on abort
        throw err;
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn("[CSR] fetch error", { url: urlStr, error: String(err) });
      }
      const fallback = lruGet(key);
      return fallback ?? { items: [], page: nq.page, pageSize: nq.pageSize, total: 0 };
    } finally {
      // Clean up single-flight entry
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, p);
  return p;
}

// ─────────────────────────────── Club Details fetchers ───────────────────────

export type ClubDTO = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  googleMaps?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  instagram?: string | null;
  whatsapp?: string | null;
  openDays?: string[];
  openHours?: { day: string; open: string; close: string }[];
  profileImageUrl?: string | null;
  menuType?: "structured" | "pdf" | "none";
  pdfMenuUrl?: string | null;
  pdfMenuName?: string | null;
};

export type EventDTO = {
  id: string;
  name: string;
  description?: string | null;
  bannerUrl?: string | null;
  availableDate: string; // YYYY-MM-DD
  tickets?: TicketDTO[]; // ⬅️ keep event tickets when provided
};

export type TicketDTO = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  dynamicPricingEnabled: boolean;
  dynamicPrice?: string | number;
  maxPerPerson: number;
  priority: number;
  isActive: boolean;
  includesMenuItem: boolean;
  availableDate?: string | null;
  quantity?: number | null;
  originalQuantity?: number | null;
  category: "general" | "event" | "free";
  clubId: string;
  eventId?: string | null;
  includedMenuItems?: Array<{
    id: string;
    menuItemId: string;
    menuItemName: string;
    variantId: string | null;
    variantName: string | null;
    quantity: number;
  }>;
};

export type ClubAdDTO = {
  id: string;
  imageUrl: string;
  priority: number;
  link?: string | null;
  targetType?: "ticket" | "event" | "club";
  targetId?: string | null;
  clubId?: string | null;
  resolvedDate?: string | null;
};

// SSR: club by id
export async function getClubByIdSSR(clubId: string): Promise<ClubDTO | null> {
  const url = joinUrl(API_BASE_SSR, `/clubs/${encodeURIComponent(clubId)}`);
  try {
    const resp = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// CSR: club by id
export async function getClubByIdCSR(clubId: string): Promise<ClubDTO | null> {
  const url = joinUrl(API_BASE_CSR, `/clubs/${encodeURIComponent(clubId)}`);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function getClubAdsCSR(clubId: string): Promise<ClubAdDTO[]> {
  const url = joinUrl(API_BASE_CSR, `/ads/club/${encodeURIComponent(clubId)}`);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!resp.ok) return [];

    const json = await resp.json();

    const rows: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.results) ? json.results
      : [];

    const filtered = rows.filter((a) => {
      if (!a) return false;
      const label = (a.label ?? a.scope ?? a.type ?? "").toString().toLowerCase();
      if (label === "global") return false;
      if (a.isGlobal === true) return false;
      if (a.clubId && String(a.clubId) !== String(clubId)) return false;
      const img = a.imageUrl ?? a.image_url ?? null;
      if (!img || String(img).trim() === "") return false;
      return true;
    });

    return filtered.map((a) => ({
      id: String(a.id ?? a._id ?? a.uuid),
      imageUrl: String(a.imageUrl ?? a.image_url),
      priority: Number(a.priority ?? 0),
      link: a.link ?? a.href ?? null,
    })) as ClubAdDTO[];
  } catch {
    return [];
  }
}

// Always return an array for events
export async function getEventsForClubCSR(clubId: string): Promise<EventDTO[]> {
  try {
    const url = joinUrl(API_BASE_CSR, `/events/club/${encodeURIComponent(clubId)}`);
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return Array.isArray(json)
      ? json.map((e: any) => ({
          id: String(e.id),
          name: String(e.name),
          description: e.description ?? null,
          bannerUrl: e.bannerUrl ?? null,
          availableDate: String(e.availableDate),
          tickets: Array.isArray(e.tickets)
            ? e.tickets.map((t: any) => ({
                id: String(t.id),
                name: String(t.name),
                description: t.description ?? null,
                price: t.price,
                dynamicPricingEnabled: !!t.dynamicPricingEnabled,
                dynamicPrice: t.dynamicPrice,
                maxPerPerson: Number(t.maxPerPerson ?? 0),
                priority: Number(t.priority ?? 0),
                isActive: !!t.isActive,
                includesMenuItem: !!t.includesMenuItem,
                availableDate: t.availableDate ?? null,
                quantity: t.quantity ?? null,
                originalQuantity: t.originalQuantity ?? null,
                category: t.category,
                clubId: String(t.clubId),
                eventId: t.eventId ?? null,
                includedMenuItems: Array.isArray(t.includedMenuItems)
                  ? t.includedMenuItems.map((inc: any) => ({
                      id: String(inc.id),
                      menuItemId: String(inc.menuItemId),
                      menuItemName: String(inc.menuItemName),
                      variantId: inc.variantId ?? null,
                      variantName: inc.variantName ?? null,
                      quantity: Number(inc.quantity ?? 1),
                    }))
                  : [],
              }))
            : undefined,
        }))
      : [];
  } catch {
    return [];
  }
}

// Always return an array for tickets
export async function getTicketsForClubCSR(clubId: string): Promise<TicketDTO[]> {
  const url = joinUrl(API_BASE_CSR, `/tickets/club/${encodeURIComponent(clubId)}`);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
      cache: "no-store",
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.items) ? json.items
      : Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.results) ? json.results
      : [];
    
    // Map the rows to ensure includedMenuItems are properly structured
    return rows.map((t: any) => ({
      id: String(t.id),
      name: String(t.name),
      description: t.description ?? null,
      price: t.price,
      dynamicPricingEnabled: !!t.dynamicPricingEnabled,
      dynamicPrice: t.dynamicPrice,
      maxPerPerson: Number(t.maxPerPerson ?? 0),
      priority: Number(t.priority ?? 0),
      isActive: !!t.isActive,
      includesMenuItem: !!t.includesMenuItem,
      availableDate: t.availableDate ?? null,
      quantity: t.quantity ?? null,
      originalQuantity: t.originalQuantity ?? null,
      category: t.category,
      clubId: String(t.clubId),
      eventId: t.eventId ?? null,
      includedMenuItems: Array.isArray(t.includedMenuItems)
        ? t.includedMenuItems.map((inc: any) => ({
            id: String(inc.id),
            menuItemId: String(inc.menuItemId),
            menuItemName: String(inc.menuItemName),
            variantId: inc.variantId ?? null,
            variantName: inc.variantName ?? null,
            quantity: Number(inc.quantity ?? 1),
          }))
        : [],
    })) as TicketDTO[];
  } catch {
    return [];
  }
}
