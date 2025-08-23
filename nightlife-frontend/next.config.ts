// next.config.ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy
 * - Allows the Google Maps JS SDK to load/execute.
 * - Permits images/tiles from maps domains.
 * - Adds OpenStreetMap static fallback host (prevents "blocked iframe" issue).
 * - Keeps dev HMR working (ws: and 'unsafe-eval' only in dev).
 */
const csp = [
  "default-src 'self'",
  // SDK script + inline handlers used by the SDK; add 'unsafe-eval' only in dev for Next HMR
  // NOTE: 'unsafe-inline' is kept here to avoid nonce wiring; we can harden later if you want.
  `script-src 'self' https://maps.googleapis.com https://maps.gstatic.com 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""}`,
  // websocket for HMR in dev + Maps network calls
  `connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com ${isDev ? "ws:" : ""}`,
  // ✅ allow static map images (Google + OpenStreetMap fallback) + S3 images
  "img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://staticmap.openstreetmap.de https://nightlife-files.s3.amazonaws.com",
  // fonts and styles (optional, keep if you use Google Fonts)
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // (optional but good defaults)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // ok; we no longer use iframes for the map
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Your S3 buckets
      { protocol: "https", hostname: "nightlife-files.s3.amazonaws.com" },
      { protocol: "https", hostname: "s3.amazonaws.com", pathname: "/nightlife/**" },

      // Google Maps images (Static Maps / tiles / marker sprites)
      { protocol: "https", hostname: "maps.googleapis.com" },
      { protocol: "https", hostname: "maps.gstatic.com" },

      // ✅ OpenStreetMap static fallback
      { protocol: "https", hostname: "staticmap.openstreetmap.de" },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
