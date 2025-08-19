// src/lib/env.ts
// Centralized access to API bases + a safe joinUrl helper.

export const API_BASE_CSR =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "";

export const API_BASE_SSR =
  (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");

/** Join base + path with a single slash boundary. Path can be absolute or relative. */
export function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  if (!b) return `/${p}`;
  return `${b}/${p}`;
}

// Dev-time hints if misconfigured
if (typeof window === "undefined") {
  if (!API_BASE_SSR) console.warn("[env] BACKEND_URL / NEXT_PUBLIC_API_URL not set for SSR.");
} else {
  if (!API_BASE_CSR) console.warn("[env] NEXT_PUBLIC_API_URL not set for CSR.");
}
