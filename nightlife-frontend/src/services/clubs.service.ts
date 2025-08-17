// src/services/clubs.service.ts

/* Shared list item shapes used by the UI */
export type ClubListItem = {
    id: string;
    name: string;
    address: string;
    city: string;
    profileImageUrl?: string | null;
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
  
  /* Client fetch (through our /api/clubs proxy) */
  const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
  const SSR_TIMEOUT_MS = 8000;
  
  export async function fetchClubsSSR(raw: ClubQuery): Promise<ClubListResponse> {
    const { q, city, musicType, openDays, page, pageSize } = normalizeQuery(raw);
    const hasFilters =
      isNonEmpty(q) || isNonEmpty(city) || musicType.length > 0 || openDays.length > 0;
  
    const endpoint = hasFilters ? "/clubs/filter" : "/clubs";
    const u = new URL(endpoint, BACKEND_URL);
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
          // Authorization: `Bearer ${process.env.BACKEND_TOKEN}`, // if needed
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
  
    return {
      id: String(idRaw),
      name: String(nameRaw),
      address: addressRaw ? String(addressRaw) : "",
      city: cityRaw ? String(cityRaw) : "",
      profileImageUrl: imgRaw != null ? String(imgRaw) : null,
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
  