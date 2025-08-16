// src/middleware.ts
// Development-friendly security headers (tighten for production).
// NOTE: Next.js middleware runs on the Edge runtime.

import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // In dev, Next uses eval for HMR; allow unsafe-eval only in development.
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    `default-src 'self'`,
    `script-src 'self'${isDev ? " 'unsafe-eval' 'unsafe-inline'" : ""}`,
    // Next dev server and hot-reload use websockets; allow ws: in dev
    `connect-src 'self' http://localhost:4000 ws:`,
    // Allow data: for inline images (QRs) and S3 later (we'll add explicit domain when you give it)
    `img-src 'self' data: https:`,
    `style-src 'self' 'unsafe-inline'`, // Tailwind injects styles; in prod, consider hashing
    `font-src 'self' data:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ");

  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(self), geolocation=(), microphone=()");

  return res;
}

// Apply to all routes
export const config = {
  matcher: "/:path*",
};
