// src/lib/csrf.ts
// Minimal CSRF token store + fetch helper.

import { ENDPOINTS } from "./endpoints";

let cachedToken: string | null = null;
let lastFetchedAt = 0;

// Fetches a CSRF token from the backend and caches it briefly.
// Backend should set a cookie (double-submit) AND return { csrfToken } in JSON.
export async function getCsrfToken(force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && cachedToken && now - lastFetchedAt < 5 * 60 * 1000) {
    return cachedToken;
  }
  try {
    const res = await fetch(ENDPOINTS.auth.csrf, {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken?: string };
    cachedToken = data?.csrfToken ?? null;
    lastFetchedAt = Date.now();
    return cachedToken;
  } catch {
    return null;
  }
}
