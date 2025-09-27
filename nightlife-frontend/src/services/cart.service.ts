// src/services/cart.service.ts
// Reads base URLs from .env via src/lib/env.ts
import { API_BASE_CSR, joinUrl } from "@/lib/env";

type Id = string;

// ───────────────────────── Unified Cart Types ─────────────────────────
export type AddTicketBody = {
  itemType: 'ticket';
  ticketId: string;   // ticket UUID
  date: string;       // YYYY-MM-DD
  quantity: number;   // >= 1
};

export type AddMenuBody = {
  itemType: 'menu';
  menuItemId: string;   // item uuid (parent or variant's parent)
  variantId?: string;   // optional; include when adding a variant
  date: string;         // YYYY-MM-DD
  quantity: number;     // >= 1
};

export type UpdateQtyBody = {
  id: Id;             // cart item id
  quantity: number;   // >= 0 (0 means remove)
};

export type CartItem = {
  id: string;
  itemType: 'ticket' | 'menu';
  quantity: number;
  date: string;
  clubId: string;
  
  // Ticket-specific
  ticketId?: string;
  ticket?: {
    id: string;
    name: string;
    price: number;
    category: 'general' | 'event' | 'free';
    description?: string;
    dynamicPricingEnabled: boolean;
    maxPerPerson: number;
    includesMenuItem: boolean;
  };
  
  // Menu-specific
  menuItemId?: string;
  variantId?: string;
  menuItem?: {
    id: string;
    name: string;
    price?: number;
    description?: string;
    imageUrl?: string;
    hasVariants: boolean;
    maxPerPerson?: number;
  };
  variant?: {
    id: string;
    name: string;
    price: number;
    maxPerPerson?: number;
  };
  
  // Pricing
  unitPrice: number;
  subtotal: number;
  dynamicPrice?: number;
  priceBreakdown?: {
    basePrice?: number;
    dynamicAdjustment?: number;
    discounts?: number;
    fees?: number;
    [key: string]: unknown;
  };
};

export type CartSummary = {
  items: CartItem[];
  ticketSubtotal: number;
  menuSubtotal: number;
  totalSubtotal: number;
  itemCount: number;
  clubId: string;
};

// Local types for API responses
type AddItemResponse = {
  success: boolean;
  item?: CartItem;
  message?: string;
};

type UpdateQuantityResponse = {
  success: boolean;
  item?: CartItem;
  message?: string;
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

/** POST /unified-cart/add - Add ticket to cart */
export async function addTicketToCart(body: AddTicketBody): Promise<AddItemResponse> {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/add"), {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  assertOk(resp, "addTicketToCart");
  const data: unknown = await parseJsonSafe<unknown>(resp);
  
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Invalid response format' };
  }
  
  const response = data as Partial<AddItemResponse>;
  return {
    success: Boolean(response.success),
    item: response.item,
    message: response.message
  };
}

/** POST /unified-cart/add - Add menu item to cart */
export async function addMenuItemToCart(body: AddMenuBody): Promise<AddItemResponse> {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/add"), {
    method: "POST",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify(body),
  });
  assertOk(resp, "addMenuItemToCart");
  const data: unknown = await parseJsonSafe<unknown>(resp);
  
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Invalid response format' };
  }
  
  const response = data as Partial<AddItemResponse>;
  return {
    success: Boolean(response.success),
    item: response.item,
    message: response.message
  };
}

/** PATCH /unified-cart/line/:id - Update item quantity */
export async function updateCartItemQuantity(itemId: Id, quantity: number): Promise<UpdateQuantityResponse> {
  const resp = await fetch(joinUrl(API_BASE_CSR, `/unified-cart/line/${encodeURIComponent(itemId)}`), {
    method: "PATCH",
    headers: JSON_HEADERS,
    credentials: "include",
    body: JSON.stringify({ quantity }),
  });
  assertOk(resp, "updateCartItemQuantity");
  const data: unknown = await parseJsonSafe<unknown>(resp);
  
  if (!data || typeof data !== 'object') {
    return { success: false, message: 'Invalid response format' };
  }
  
  const response = data as Partial<UpdateQuantityResponse>;
  return {
    success: Boolean(response.success),
    item: response.item,
    message: response.message
  };
}

/** DELETE /unified-cart/line/:id - Remove item from cart */
export async function removeCartItem(itemId: Id) {
  const resp = await fetch(joinUrl(API_BASE_CSR, `/unified-cart/line/${encodeURIComponent(itemId)}`), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "removeCartItem");
  return true;
}

/** GET /unified-cart - Get all cart items */
export async function getCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getCart");
  return parseJsonSafe<CartItem[]>(resp);
}

/** DELETE /unified-cart/clear - Clear entire cart */
export async function clearCart() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/clear"), {
    method: "DELETE",
    credentials: "include",
  });
  assertOk(resp, "clearCart");
  return true;
}

/** GET /unified-cart/summary - Get cart summary with totals */
export async function getCartSummary() {
  const resp = await fetch(joinUrl(API_BASE_CSR, "/unified-cart/summary"), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  assertOk(resp, "getCartSummary");
  return parseJsonSafe<CartSummary>(resp);
}

// ───────────────────────── Legacy Support ─────────────────────────
// These functions are kept for backward compatibility but use the unified cart

/** @deprecated Use addTicketToCart instead */
export async function updateTicketQty(body: UpdateQtyBody) {
  return updateCartItemQuantity(body.id, body.quantity);
}

/** @deprecated Use removeCartItem instead */
export async function removeTicketItem(itemId: Id) {
  return removeCartItem(itemId);
}

/** @deprecated Use getCart instead */
export async function getTicketCart() {
  return getCart();
}

/** @deprecated Use clearCart instead */
export async function clearTicketCart() {
  return clearCart();
}

/** @deprecated Use getCartSummary instead */
export async function getTicketCartSummary() {
  return getCartSummary();
}

/** @deprecated Use addMenuItemToCart instead */
export async function updateMenuItemQty(body: UpdateQtyBody) {
  return updateCartItemQuantity(body.id, body.quantity);
}

/** @deprecated Use removeCartItem instead */
export async function removeMenuItem(itemId: Id) {
  return removeCartItem(itemId);
}

/** @deprecated Use getCart instead */
export async function getMenuCart() {
  return getCart();
}

/** @deprecated Use clearCart instead */
export async function clearMenuCart() {
  return clearCart();
}

/** @deprecated Use getCartSummary instead */
export async function getMenuCartSummary() {
  return getCartSummary();
}

