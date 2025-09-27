// src/middleware.ts
// Security headers built from env (no hard-coded hosts).
// Runs on Edge Runtime. Keep dev HMR working, but tighten in prod.

import { NextResponse, type NextRequest } from "next/server";

/** Return a safe origin string like "https://api.example.com" or "" if invalid. */
function toOrigin(value?: string | null): string {
  if (!value) return "";
  try {
    const u = new URL(value);
    // Normalize to origin (scheme + host + optional port)
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return "";
  }
}

/** Build a unique, space-joined directive value from hosts/tokens. */
function joinSources(...parts: Array<string | string[] | undefined | null>): string {
  const set = new Set<string>();
  for (const p of parts) {
    if (!p) continue;
    if (Array.isArray(p)) p.forEach((x) => x && set.add(x));
    else set.add(p);
  }
  return Array.from(set).join(" ");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function middleware(_req: NextRequest) {
  const res = NextResponse.next();

  const isDev = process.env.NODE_ENV !== "production";

  // ── External origins from env (no hard-coded localhost) ────────────────────
  // Used in connect-src (your API/backend). Example: http://localhost:4000 in dev
  const API_ORIGIN = toOrigin(process.env.NEXT_PUBLIC_API_URL);

  // Public assets host (e.g., S3/CloudFront) if you have one (optional)
  const ASSETS_ORIGIN = toOrigin(process.env.NEXT_PUBLIC_ASSETS_HOST);

  // Static map fallback (OSM) — default to the canonical host if unset
  const OSM_STATIC_ORIGIN =
    toOrigin(process.env.NEXT_PUBLIC_OSM_STATIC) || "https://staticmap.openstreetmap.de";

  // Google Maps hosts (always allow these for SDK + images)
  const GOOGLE_MAPS_HOSTS = ["https://maps.googleapis.com", "https://maps.gstatic.com"];

  // ── CSP directives (dev vs prod) ───────────────────────────────────────────
  const defaultSrc = joinSources("'self'");

  // NOTE:
  // - script-src: allow Google Maps SDK; in dev, permit 'unsafe-eval' & 'unsafe-inline' for HMR.
  // - script-src-elem: some browsers separate element-src; mirror script-src.
  // - script-src-attr: deny inline event handlers (safer).
  const scriptCommon = joinSources("'self'", GOOGLE_MAPS_HOSTS);
  const scriptDevAdds = isDev ? "'unsafe-eval' 'unsafe-inline'" : "";
  const scriptSrc = `${scriptCommon} ${scriptDevAdds}`.trim();
  const scriptSrcElem = `${scriptCommon} ${scriptDevAdds}`.trim();
  const scriptSrcAttr = "'none'";

  // connect-src: your API + Google Maps; add ws/wss only in dev; no localhost hardcode.
  const connectSrc = joinSources(
    "'self'",
    API_ORIGIN,
    GOOGLE_MAPS_HOSTS,
    isDev ? ["ws:", "wss:"] : undefined
  );

  // img-src: self + data/blob + assets (optional) + Google Maps static + OSM static + S3
  const imgSrc = joinSources(
    "'self'",
    "data:",
    "blob:",
    ASSETS_ORIGIN,
    GOOGLE_MAPS_HOSTS,
    OSM_STATIC_ORIGIN,
    "https://nightlife-files.s3.amazonaws.com"
  );

  // style-src: Tailwind uses runtime styles; keep 'unsafe-inline'.
  const styleSrc = joinSources("'self'", "'unsafe-inline'", "https://fonts.googleapis.com");
  const fontSrc = joinSources("'self'", "data:", "https://fonts.gstatic.com");

  // Lock down legacy vectors
  const objectSrc = "'none'";
  // Allow same-origin embedding for PDF iframes
  const frameAncestors = "'self'";
  const baseUri = "'self'";
  const formAction = "'self'";
  
  // Allow iframes only from same origin (PDF proxy)
  const frameSrc = "'self'";

  const csp = [
    `default-src ${defaultSrc}`,
    `script-src ${scriptSrc}`,
    `script-src-elem ${scriptSrcElem}`,
    `script-src-attr ${scriptSrcAttr}`,
    `connect-src ${connectSrc}`,
    `img-src ${imgSrc}`,
    `style-src ${styleSrc}`,
    `font-src ${fontSrc}`,
    `object-src ${objectSrc}`,
    `frame-src ${frameSrc}`,
    `frame-ancestors ${frameAncestors}`,
    `base-uri ${baseUri}`,
    `form-action ${formAction}`,
  ].join("; ");

  // ── Apply headers ──────────────────────────────────────────────────────────
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "SAMEORIGIN");
  // Keep permissions tight by default; open up explicitly if needed
  res.headers.set(
    "Permissions-Policy",
    [
      "camera=()",         // disallow
      "geolocation=()",    // disallow (Maps still works without browser geolocation)
      "microphone=()",     // disallow
      "fullscreen=(self)", // allow on same-origin
    ].join(", ")
  );

  return res;
}

// Apply to all routes
export const config = {
  matcher: "/:path*",
};
