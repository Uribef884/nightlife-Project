// src/app/api/clubs/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/middlewares/rateLimit";

/** Config */
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const TIMEOUT_MS = 8000;

/** Helpers */
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const isNonEmpty = (s?: string) => !!s && s.trim().length > 0;

// allow letters, spaces, accents, hyphen, apostrophe, dot
const SAFE_TEXT = /^[\p{L}\s\-'.]+$/u;
// Days allow-list (case-insensitive)
const DAY_SET = new Set(["monday","tuesday","wednesday","thursday","friday","saturday","sunday","lunes","martes","miércoles","jueves","viernes","sábado","domingo"]);

function normalizeParams(req: NextRequest) {
  const url = new URL(req.url);

  // q maps to backend's `query`
  let q = (url.searchParams.get("q") ?? "").normalize("NFKC").trim();
  if (q.length > 64) q = q.slice(0, 64);

  // city (optional, enforce safe chars)
  let city = (url.searchParams.get("city") ?? "").normalize("NFKC").trim();
  if (city.length > 48) city = city.slice(0, 48);
  if (city && !SAFE_TEXT.test(city)) city = ""; // drop unsafe input

  // musicType can be repeated; keep simple safe values
  const musicType = url.searchParams.getAll("musicType")
    .map((v) => v.normalize("NFKC").trim())
    .filter((v) => v.length <= 32 && SAFE_TEXT.test(v));

  // openDays can be repeated; map/validate to known days
  const openDays = url.searchParams.getAll("openDays")
    .map((v) => v.normalize("NFKC").trim().toLowerCase())
    .filter((v) => DAY_SET.has(v));

  // pagination (bounded)
  let page = Number(url.searchParams.get("page") || "1");
  let pageSize = Number(url.searchParams.get("pageSize") || "20");
  if (!Number.isFinite(page)) page = 1;
  if (!Number.isFinite(pageSize)) pageSize = 20;
  page = clamp(page, 1, 100_000);
  pageSize = clamp(pageSize, 1, 50); // protect backend

  return { q, city, musicType, openDays, page, pageSize };
}

function buildBackendURL(endpoint: string, params: Record<string, string | string[] | number | undefined>) {
  const u = new URL(endpoint, BACKEND_URL);
  const sp = u.searchParams;

  // append supports arrays
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((vv) => isNonEmpty(vv) && sp.append(k, vv));
    } else if (typeof v === "number") {
      sp.set(k, String(v));
    } else if (isNonEmpty(v)) {
      sp.set(k, v);
    }
  }
  return u.toString();
}

export async function GET(req: NextRequest) {
  // Rate limit (defense-in-depth; you can also rate limit on the backend)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  if (!rateLimit(ip, { tokens: 60, intervalMs: 60_000 })) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": "60" } });
  }

  const { q, city, musicType, openDays, page, pageSize } = normalizeParams(req);

  // Decide which backend endpoint to call
  const hasFilters = isNonEmpty(q) || isNonEmpty(city) || musicType.length > 0 || openDays.length > 0;
  const endpoint = hasFilters ? "/clubs/filter" : "/clubs";

  // Map to backend params (q -> query)
  const backendUrl = buildBackendURL(endpoint, {
    ...(isNonEmpty(q) ? { query: q } : {}),
    ...(isNonEmpty(city) ? { city } : {}),
    ...(musicType.length ? { musicType } : {}),
    ...(openDays.length ? { openDays } : {}),
    page,
    pageSize,
  });

  // Server-to-server fetch with timeout
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "nightlife-frontend/1.0",
      },
      signal: ac.signal,
      // If your backend needs auth, add it here from server env (never expose to browser):
      // Authorization: `Bearer ${process.env.BACKEND_TOKEN}`,
    });

    clearTimeout(to);

    if (!resp.ok) {
      // Surface a clean error code
      const status = resp.status;
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: "Upstream error", status, details: process.env.NODE_ENV === "production" ? undefined : text },
        { status: status >= 400 && status < 600 ? status : 502 }
      );
    }

    const data = await resp.json();

    // Set safe caching headers (tune as you like)
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=0",
        "CDN-Cache-Control": "s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (err: any) {
    const aborted = err?.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Upstream timeout" : "Bad gateway" },
      { status: aborted ? 504 : 502 }
    );
  }
}
