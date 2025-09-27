// next.config.ts
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Security headers configuration
 * - CSP is now handled by middleware.ts to avoid conflicts
 * - Keeps other security headers for additional protection
 */

const securityHeaders = [
  // CSP is now handled by middleware.ts to avoid conflicts
  // { key: "Content-Security-Policy", value: csp },
  // (optional but good defaults)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // X-Frame-Options is now handled by middleware.ts
  // { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  // Allow external access for mobile testing
  serverExternalPackages: [],
  
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
