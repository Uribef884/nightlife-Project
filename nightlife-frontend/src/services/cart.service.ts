// src/services/cart.service.ts
// Reads base URLs from .env via src/lib/env.ts
import { API_BASE_CSR, joinUrl } from "@/lib/env";

type Id = string;

// ───────────────────────── Tickets cart ─────────────────────────
export type AddTicketBody = {
  ticketId: string;   // ticket UUID
  date: string;       // YYYY-MM-DD
  quantity: number;   // >= 1
};

export type UpdateQtyBody = {
  id: Id;             // cart item id
  quantity: number;   // >= 0 (0 means remove)
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
} as const;

async function parseJsonSafe<T>(resp: Response): Promise<T> {
  // Some endpoints may return empty bodies on 204; be tolerant.
  const text = await resp.text().catch(() => "");
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Fallback when server returns plain text
    return {} as T;
  }
}

function assertOk(resp: Response, label: string) {
  if (!resp.ok) {
    throw new Error(`${label} failed (${resp.status})`);
  }
}

/** POST /cart/add */
export async function addTicketToCart(body: AddTicketBody) {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/add"), {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  assertOk(resp, "addTicketToCart");
  return parseJsonSafe<any>(resp);
}

/** PATCH /cart/update */
export async function updateTicketQty(body: UpdateQtyBody) {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/update"), {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  assertOk(resp, "updateTicketQty");
  return parseJsonSafe<any>(resp);
}

/** DELETE /cart/item/:id */
export async function removeTicketItem(itemId: Id) {
  const resp = await fetch(joinUrl(API_BASE_CSR, `/unified-cart/item/${encodeURIComponent(itemId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "removeTicketItem");
  return true;
}

/** GET /cart */
export async function getTicketCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getTicketCart");
  return parseJsonSafe<any>(resp);
}

/** DELETE /cart/clear */
export async function clearTicketCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/clear"), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "clearTicketCart");
  return true;
}

/** DELETE /cart/clear-other-cart */
export async function clearOtherTicketCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/clear-other-cart"), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "clearOtherTicketCart");
  return true;
}

/** GET /unified-cart/summary (used to calculate DP/mix rules) */
export async function getTicketCartSummary() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/summary"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getTicketCartSummary");
  return parseJsonSafe<any>(resp);
}

// ───────────────────────── Menu cart ─────────────────────────

export type AddMenuBody = {
  menuItemId: string;   // item uuid (parent or variant's parent)
  quantity: number;     // >= 1
  variantId?: string;   // optional; include when adding a variant
};

/** POST /menu/cart/add */
export async function addMenuItemToCart(body: AddMenuBody) {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/add"), {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  assertOk(resp, "addMenuItemToCart");
  return parseJsonSafe<any>(resp);
}

/** PATCH /menu/cart/update */
export async function updateMenuItemQty(body: UpdateQtyBody) {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/update"), {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  assertOk(resp, "updateMenuItemQty");
  return parseJsonSafe<any>(resp);
}

/** DELETE /menu/cart/item/:id */
export async function removeMenuItem(itemId: Id) {
  const resp = await fetch(joinUrl(API_BASE_CSR, `/unified-cart/item/${encodeURIComponent(itemId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "removeMenuItem");
  return true;
}

/** GET /menu/cart */
export async function getMenuCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/menu/cart"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getMenuCart");
  return parseJsonSafe<any>(resp);
}

/** DELETE /menu/cart/clear */
export async function clearMenuCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/clear"), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "clearMenuCart");
  return true;
}

/** DELETE /menu/cart/clear-other-cart */
export async function clearOtherMenuCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/clear-other-cart"), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "clearOtherMenuCart");
  return true;
}

/** GET /menu/cart/summary */
export async function getMenuCartSummary() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/summary"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getMenuCartSummary");
  return parseJsonSafe<any>(resp);
}
